import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTION_GAMES } from '../src/action-pack.js';
import { aimBubbles, bubbleNeighbors, bubblePosition, createBubbles, fireBubbles, stepBubbles, BUBBLE_LIMIT } from '../src/bubbles.js';
import { createFlappy, flapFlappy, stepFlappy, FLAPPY_GROUND } from '../src/flappy.js';
import { createPong, steerPong, servePong, stepPong } from '../src/pong.js';
import { createInvaders, steerInvaders, fireInvaders, stepInvaders } from '../src/invaders.js';
import { createMaze, turnMaze, stepMaze, mazeOpen, mazeNeighbor, MAZE_MAP, MAZE_DIRECTIONS } from '../src/maze.js';

function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
const zero = () => 0;

test('five definitions expose the expected shell metadata without needing a DOM', () => {
  assert.deepEqual(ACTION_GAMES.map(game => game.id), ['bubbles', 'flappy', 'pong', 'invaders', 'maze']);
  ACTION_GAMES.forEach((game, index) => {
    assert.equal(game.number, String(18 + index).padStart(3, '0'));
    assert.equal(game.filter, index === 0 ? 'puzzle' : 'arcade');
    for (const field of ['name', 'icon', 'category', 'description', 'welcome', 'hint', 'detail', 'art']) assert.ok(game[field]);
    assert.ok(game.rules.length >= 3); assert.equal(typeof game.setup, 'function');
  });
});

test('bubble generation is deterministic, supported, on-grid, and uses available colors', () => {
  for (const seed of [1, 37, 91]) {
    const game = createBubbles(seeded(seed));
    assert.deepEqual(game, createBubbles(seeded(seed))); assert.equal(game.board.length, 48);
    const slots = new Set(game.board.map(item => `${item.row}:${item.col}`)); assert.equal(slots.size, game.board.length);
    for (const item of game.board) {
      const point = bubblePosition(item);
      assert.ok(point.x >= 18 && point.x <= 342 && point.y + 18 < BUBBLE_LIMIT);
      assert.ok(item.color >= 0 && item.color < 4);
      if (item.row) assert.ok(bubbleNeighbors(item).some(neighbor => neighbor.row < item.row && slots.has(`${neighbor.row}:${neighbor.col}`)));
    }
    assert.ok(game.board.some(item => item.color === game.current)); assert.ok(game.board.some(item => item.color === game.next));
  }
});

test('bubble firing guards, aim limits, and wall reflection preserve the input', () => {
  const base = freeze(createBubbles(zero));
  assert.equal(aimBubbles(base, NaN), base);
  assert.ok(aimBubbles(base, 100).angle < 0); assert.ok(aimBubbles(base, -100).angle > -Math.PI);
  const fired = fireBubbles(base); assert.equal(fired.shots, 1); assert.equal(fireBubbles(fired), fired);
  const game = freeze({ ...fired, shot: { x: 19, y: 300, vx: -430, vy: -100, color: 0 } });
  const next = stepBubbles(game, 80, zero);
  assert.ok(next.shot.vx > 0); assert.ok(next.shot.x >= 18); assert.equal(game.shot.x, 19);
  assert.deepEqual(stepBubbles(game, 10000, zero), next);
});

test('bubbles snap into a neighboring hex slot, pop three, and drop disconnected bubbles', () => {
  const game = freeze({ ...createBubbles(zero), board: [{ row: 0, col: 4, color: 0 }, { row: 0, col: 5, color: 0 }, { row: 1, col: 3, color: 1 }, { row: 2, col: 3, color: 1 }], current: 0, next: 1, shot: { x: 216, y: 100, vx: 0, vy: -430, color: 0 } });
  let next = game;
  for (let i = 0; i < 4 && next.shot; i++) next = stepBubbles(next, 80, zero);
  assert.equal(next.status, 'won'); assert.equal(next.board.length, 0); assert.equal(next.lastPop, 3); assert.equal(next.lastDrop, 2); assert.equal(next.score, 70);
  assert.equal(game.board.length, 4);
});

test('five misses lower the ceiling and reaching the warning line loses', () => {
  const miss = { ...createBubbles(zero), board: [{ row: 0, col: 4, color: 1 }], misses: 4, current: 2, next: 3, shot: { x: 198, y: 22, vx: 0, vy: -430, color: 2 } };
  const next = stepBubbles(freeze(miss), 5, zero);
  assert.equal(next.ceiling, 18); assert.equal(next.misses, 0); assert.equal(next.board.length, 2); assert.equal(next.status, 'playing');
  assert.ok(next.board.some(item => item.color === next.current)); assert.ok(next.board.some(item => item.color === next.next));
  const tower = Array.from({ length: 11 }, (_, row) => ({ row, col: 4, color: row % 4 }));
  let losing = { ...createBubbles(zero), board: tower, shot: { x: 180, y: 395, vx: 0, vy: -430, color: 3 } };
  for (let i = 0; i < 3 && losing.shot; i++) losing = stepBubbles(losing, 80, zero);
  assert.equal(losing.status, 'lost'); assert.equal(stepBubbles(losing, 20), losing); assert.equal(fireBubbles(losing), losing);
});

test('bird waits for the first flap and integrates gravity without mutating input', () => {
  const game = freeze(createFlappy(seeded(4)));
  assert.equal(stepFlappy(game, 80), game); assert.deepEqual(createFlappy(seeded(4)), game);
  const flying = freeze(flapFlappy(game)), next = stepFlappy(flying, 80, zero);
  assert.ok(next.bird.y < flying.bird.y); assert.ok(next.bird.vy > flying.bird.vy); assert.ok(next.pipes[0].x < flying.pipes[0].x);
  assert.deepEqual(stepFlappy(flying, 10000, zero), next);
});

test('bird collides with pipes, ground, and ceiling even across a long frame', () => {
  const base = flapFlappy(createFlappy(zero));
  const pipe = { ...base, bird: { x: 86, y: 110, vy: 0 }, pipes: [{ id: 0, x: 102, gapY: 300, passed: false }] };
  assert.equal(stepFlappy(freeze(pipe), 80, zero).status, 'lost');
  assert.equal(stepFlappy({ ...base, bird: { x: 86, y: FLAPPY_GROUND - 13, vy: 200 } }, 40, zero).status, 'lost');
  const ceiling = stepFlappy({ ...base, bird: { x: 86, y: 13, vy: -200 } }, 40, zero);
  assert.equal(ceiling.status, 'lost'); assert.equal(flapFlappy(ceiling), ceiling);
});

test('bird scores a fully passed pipe only once and wins at twenty', () => {
  const game = freeze({ ...flapFlappy(createFlappy(zero)), bird: { x: 86, y: 214, vy: 0 }, pipes: [{ id: 0, x: 22, gapY: 214, passed: false }] });
  const next = stepFlappy(game, 80, zero); assert.equal(next.score, 1);
  assert.equal(stepFlappy(next, 80, zero).score, 1);
  const won = stepFlappy({ ...game, score: 19 }, 80, zero); assert.equal(won.score, 20); assert.equal(won.status, 'won');
  for (const item of next.pipes) assert.ok(item.gapY >= 112 && item.gapY <= 292);
});

test('pong has a separate serve state and bounded player and computer movement', () => {
  const game = freeze(createPong()), waiting = stepPong(game, 80, 1);
  assert.deepEqual(waiting.ball, game.ball); assert.ok(waiting.player > game.player);
  assert.equal(steerPong(game, -1000).player, 8); assert.equal(steerPong(game, 1000).player, 246);
  const served = servePong(game); assert.equal(served.serving, false); assert.equal(servePong(served), served);
  const incoming = freeze({ ...served, ball: { x: 250, y: 20, vx: 240, vy: 0 } });
  const next = stepPong(incoming, 80); assert.ok(Math.abs(next.computer - incoming.computer) <= 160 * .08); assert.ok(next.computer < incoming.computer);
  assert.deepEqual(stepPong(incoming, 10000), next);
});

test('pong bounces off paddle edges and court walls with meaningful angles', () => {
  const game = freeze({ ...servePong(createPong()), ball: { x: 38, y: 138, vx: -300, vy: 0 } });
  const next = stepPong(game, 40);
  assert.ok(next.ball.vx > 0); assert.ok(next.ball.vy < 0); assert.equal(next.rally, 1);
  const wall = stepPong({ ...game, ball: { x: 180, y: 7, vx: 100, vy: -200 } }, 40);
  assert.ok(wall.ball.vy > 0); assert.ok(wall.ball.y >= 6);
});

test('pong awards one point then waits, and both seven-point endings are terminal', () => {
  const base = servePong(createPong());
  const scored = stepPong({ ...base, ball: { x: 404, y: 30, vx: 250, vy: 0 } }, 40);
  assert.equal(scored.playerScore, 1); assert.equal(scored.score, 100); assert.equal(scored.serving, true);
  assert.equal(stepPong(scored, 80).playerScore, 1);
  const won = stepPong({ ...base, playerScore: 6, ball: { x: 404, y: 30, vx: 250, vy: 0 } }, 40);
  assert.equal(won.status, 'won'); assert.equal(servePong(won), won);
  const lost = stepPong({ ...base, computerScore: 6, ball: { x: -4, y: 30, vx: -250, vy: 0 } }, 40);
  assert.equal(lost.status, 'lost'); assert.equal(stepPong(lost, 80), lost);
});

test('invaders start in valid rows and fire obeys cooldown without mutation', () => {
  const game = freeze(createInvaders());
  assert.equal(game.enemies.length, 21); assert.equal(new Set(game.enemies.map(enemy => enemy.id)).size, 21);
  const fired = freeze(fireInvaders(game)); assert.equal(fired.bullets.length, 1); assert.equal(fireInvaders(fired), fired);
  const next = stepInvaders(fired, 80, { direction: 1, fire: true }, zero);
  assert.ok(next.player > game.player); assert.equal(next.bullets.length, 1); assert.equal(game.bullets.length, 0);
  assert.equal(steerInvaders(game, -10).player, 18); assert.equal(steerInvaders(game, 999).player, 342);
  assert.deepEqual(stepInvaders(fired, 99999, { direction: 1, fire: true }, zero), next);
});

test('invader bullets hit enemies and enemy fire comes from the bottom of a column', () => {
  const game = freeze({ ...createInvaders(), bullets: [{ x: 48, y: 62 }], enemyFireIn: 10000 });
  const hit = stepInvaders(game, 30, {}, zero); assert.equal(hit.enemies.length, 20); assert.equal(hit.score, 30); assert.equal(hit.bullets.length, 0);
  const firing = stepInvaders({ ...createInvaders(), enemyFireIn: 0 }, 5, {}, zero);
  assert.equal(firing.enemyBullets.length, 1); assert.ok(firing.enemyBullets[0].y > 120); assert.ok(Math.abs(firing.enemyBullets[0].x - firing.enemies[14].x) < 1);
});

test('invaders reverse and descend at walls, and a breached defense ends the game', () => {
  const game = freeze({ ...createInvaders(), enemies: [{ id: 0, col: 0, row: 0, x: 337, y: 80 }] });
  const next = stepInvaders(game, 5, {}, zero); assert.equal(next.direction, -1); assert.equal(next.enemies[0].y, 96); assert.ok(next.enemies[0].x <= 336);
  const lost = stepInvaders({ ...game, enemies: [{ ...game.enemies[0], y: 390 }] }, 5, {}, zero); assert.equal(lost.status, 'lost');
});

test('invaders lose one shield per hit and invulnerability prevents stacked damage', () => {
  const game = freeze({ ...createInvaders(), enemyBullets: [{ x: 180, y: 407 }, { x: 181, y: 407 }] });
  const hit = stepInvaders(game, 20, {}, zero); assert.equal(hit.lives, 2); assert.ok(hit.invulnerable > 0); assert.equal(hit.enemyBullets.length, 0);
  const protectedGame = stepInvaders({ ...hit, enemyBullets: [{ x: 180, y: 407 }] }, 20, {}, zero); assert.equal(protectedGame.lives, 2);
  const lost = stepInvaders({ ...game, lives: 1 }, 20, {}, zero); assert.equal(lost.status, 'lost'); assert.equal(fireInvaders(lost), lost);
});

test('invader wave clears award a bonus, pause in simulation, and finish after three waves', () => {
  const game = freeze({ ...createInvaders(), enemies: [{ id: 0, col: 0, row: 2, x: 180, y: 100 }], bullets: [{ x: 180, y: 110 }] });
  let cleared = stepInvaders(game, 5, {}, zero);
  assert.equal(cleared.score, 110); assert.equal(cleared.enemies.length, 0); assert.equal(cleared.wave, 1); assert.equal(cleared.waveDelay, 1100);
  assert.equal(stepInvaders(cleared, 0), cleared); assert.equal(fireInvaders(cleared), cleared);
  for (let i = 0; i < 14; i++) cleared = stepInvaders(cleared, 80, {}, zero);
  assert.equal(cleared.wave, 2); assert.equal(cleared.enemies.length, 21); assert.equal(cleared.waveDelay, 0);
  const won = stepInvaders({ ...game, wave: 3 }, 5, {}, zero); assert.equal(won.status, 'won'); assert.equal(stepInvaders(won, 80), won);
});

test('maze is rectangular and every pellet and spawn is reachable', () => {
  assert.ok(MAZE_MAP.every(row => row.length === 15));
  const game = createMaze(), reachable = new Set([game.player]), queue = [game.player];
  for (let i = 0; i < queue.length; i++) for (const direction of Object.keys(MAZE_DIRECTIONS)) {
    const next = mazeNeighbor(queue[i], direction); if (!reachable.has(next)) { reachable.add(next); queue.push(next); }
  }
  game.pellets.forEach((pellet, index) => { if (pellet) assert.ok(reachable.has(index), `unreachable pellet ${index}`); });
  for (const ghost of game.ghosts) assert.ok(reachable.has(ghost.position));
  assert.equal(game.pellets.filter(value => value === 2).length, 4); assert.equal(game.remaining, game.pellets.filter(Boolean).length);
  assert.equal(reachable.size, MAZE_MAP.join('').split('').filter(cell => cell !== '#').length);
});

test('maze waits for input and buffers a turn until a reachable junction', () => {
  const game = freeze(createMaze()); assert.equal(stepMaze(game, 160), game);
  const moving = freeze(turnMaze(game, 'up'));
  const first = stepMaze(moving, 145); assert.equal(first.player, 11 * 15 + 6); assert.equal(first.queued, 'up'); assert.equal(first.direction, 'left');
  const second = stepMaze(first, 145); assert.equal(second.player, 10 * 15 + 6); assert.equal(second.direction, 'up');
  assert.equal(second.score, 20); assert.equal(game.score, 0); assert.equal(turnMaze(game, 'invalid'), game);
});

test('maze power pellets grant time and points; powered collisions eat hunters', () => {
  const game = freeze({ ...createMaze(), player: 17, queued: 'left', direction: 'left', ready: false, invulnerable: 0, ghosts: [] });
  const power = stepMaze(game, 145); assert.equal(power.player, 16); assert.equal(power.score, 50); assert.equal(power.power, 6500); assert.equal(power.remaining, game.remaining - 1);
  const hunting = { ...createMaze(), ready: false, power: 1000, invulnerable: 0, ghosts: [{ id: 0, position: 171, previous: 170, wait: 0 }] };
  const eaten = stepMaze(freeze(hunting), 145); assert.equal(eaten.lives, 3); assert.equal(eaten.score, 110); assert.equal(eaten.ghosts[0].wait, 1800); assert.ok(mazeOpen(eaten.ghosts[0].position));
  assert.equal(stepMaze({ ...power, power: 100 }, 160).power, 0);
});

test('maze collisions preserve eaten pellets and require a fresh direction after losing a life', () => {
  const game = freeze({ ...createMaze(), ready: false, invulnerable: 0, ghosts: [{ id: 0, position: 171, previous: 170, wait: 0 }] });
  const hit = stepMaze(game, 145); assert.equal(hit.lives, 2); assert.equal(hit.ready, true); assert.equal(hit.score, 10); assert.equal(hit.pellets[171], 0); assert.equal(hit.player, 172);
  assert.equal(stepMaze(hit, 160), hit); assert.ok(hit.invulnerable > 0);
  const lost = stepMaze({ ...game, lives: 1 }, 145); assert.equal(lost.status, 'lost'); assert.equal(turnMaze(lost, 'up'), lost);
});

test('maze catches opposite-direction crossing and hunters stay on passages', () => {
  const crossing = freeze({ ...createMaze(), player: 31, direction: 'down', queued: 'down', ready: false, invulnerable: 0, playerClock: 140, ghostClock: 230, ghosts: [{ id: 0, position: 46, previous: 47, wait: 0 }] });
  assert.equal(stepMaze(crossing, 10).lives, 2);
  let moving = turnMaze(createMaze(), 'left');
  for (let i = 0; i < 20; i++) { moving = stepMaze(moving, 160); assert.ok(moving.ghosts.every(ghost => mazeOpen(ghost.position))); assert.ok(mazeOpen(moving.player)); }
});

test('maze wins when the final pellet is eaten and duration is capped', () => {
  const pellets = Array(225).fill(0); pellets[171] = 1;
  const game = freeze({ ...createMaze(), ready: false, pellets, remaining: 1, ghosts: [] });
  const won = stepMaze(game, 145); assert.equal(won.status, 'won'); assert.equal(won.remaining, 0); assert.equal(won.score, 10); assert.equal(stepMaze(won, 160), won);
  const running = freeze({ ...createMaze(), ready: false }); assert.deepEqual(stepMaze(running, 10000), stepMaze(running, 160));
});
