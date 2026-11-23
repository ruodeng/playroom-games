export const INVADERS_WIDTH = 360;
export const INVADERS_HEIGHT = 450;
export const INVADERS_WAVES = 3;
const PLAYER_Y = 416, ENEMY_WIDTH = 24, ENEMY_HEIGHT = 18;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function formation(wave) {
  return Array.from({ length: 21 }, (_, id) => ({ id, col: id % 7, row: Math.floor(id / 7), x: 48 + (id % 7) * 40, y: 48 + Math.floor(id / 7) * 32 + (wave - 1) * 8 }));
}
export function createInvaders() {
  return { player: 180, enemies: formation(1), bullets: [], enemyBullets: [], direction: 1, cooldown: 0, enemyFireIn: 1000, invulnerable: 0, waveDelay: 0, wave: 1, lives: 3, score: 0, status: 'playing' };
}
export function steerInvaders(game, x) {
  if (game.status !== 'playing' || !Number.isFinite(x)) return game;
  const player = clamp(x, 18, INVADERS_WIDTH - 18);
  return player === game.player ? game : { ...game, player };
}
export function fireInvaders(game) {
  if (game.status !== 'playing' || game.cooldown > 0 || game.waveDelay > 0) return game;
  return { ...game, cooldown: 220, bullets: [...game.bullets, { x: game.player, y: PLAYER_Y - 15 }] };
}
export function stepInvaders(game, ms, input = {}, rng = Math.random) {
  if (game.status !== 'playing' || !(ms > 0)) return game;
  let next = { ...game, enemies: game.enemies.map(enemy => ({ ...enemy })), bullets: game.bullets.map(bullet => ({ ...bullet })), enemyBullets: game.enemyBullets.map(bullet => ({ ...bullet })) };
  const duration = Math.min(ms, 80);
  for (let time = 0; time < duration; time += 5) {
    const elapsed = Math.min(5, duration - time), dt = elapsed / 1000;
    next.player = clamp(next.player + clamp(input.direction || 0, -1, 1) * 265 * dt, 18, INVADERS_WIDTH - 18);
    next.cooldown = Math.max(0, next.cooldown - elapsed); next.invulnerable = Math.max(0, next.invulnerable - elapsed);
    if (next.waveDelay > 0) {
      next.waveDelay = Math.max(0, next.waveDelay - elapsed);
      if (!next.waveDelay) { next.wave++; next.enemies = formation(next.wave); next.direction = 1; next.enemyFireIn = 1100; }
      continue;
    }
    if (input.fire) next = fireInvaders(next);
    const speed = 20 + next.wave * 11 + (21 - next.enemies.length) * 1.4;
    for (const enemy of next.enemies) enemy.x += next.direction * speed * dt;
    const min = Math.min(...next.enemies.map(enemy => enemy.x - ENEMY_WIDTH / 2)), max = Math.max(...next.enemies.map(enemy => enemy.x + ENEMY_WIDTH / 2));
    if (min < 12 || max > INVADERS_WIDTH - 12) {
      const correction = min < 12 ? 12 - min : INVADERS_WIDTH - 12 - max;
      for (const enemy of next.enemies) { enemy.x += correction; enemy.y += 16; }
      next.direction *= -1;
    }
    if (next.enemies.some(enemy => enemy.y + ENEMY_HEIGHT / 2 >= PLAYER_Y - 22)) return { ...next, status: 'lost' };
    next.enemyFireIn -= elapsed;
    if (next.enemyFireIn <= 0 && next.enemies.length) {
      const bottom = [...new Map([...next.enemies].sort((a, b) => a.row - b.row).map(enemy => [enemy.col, enemy])).values()];
      const source = bottom[Math.min(bottom.length - 1, Math.floor(rng() * bottom.length))];
      next.enemyBullets.push({ x: source.x, y: source.y + ENEMY_HEIGHT / 2 });
      next.enemyFireIn = Math.max(420, 1050 - next.wave * 125) + rng() * 350;
    }
    for (const bullet of next.bullets) bullet.y -= 360 * dt;
    for (const bullet of next.enemyBullets) bullet.y += (138 + next.wave * 18) * dt;
    const remaining = [];
    for (const bullet of next.bullets) {
      const target = next.enemies.findIndex(enemy => Math.abs(bullet.x - enemy.x) <= ENEMY_WIDTH / 2 + 2 && Math.abs(bullet.y - enemy.y) <= ENEMY_HEIGHT / 2 + 4);
      if (target >= 0) { next.score += (3 - next.enemies[target].row) * 10; next.enemies.splice(target, 1); }
      else if (bullet.y >= -8) remaining.push(bullet);
    }
    next.bullets = remaining;
    const hit = next.enemyBullets.some(bullet => Math.abs(bullet.x - next.player) <= 15 && Math.abs(bullet.y - PLAYER_Y) <= 13);
    next.enemyBullets = next.enemyBullets.filter(bullet => bullet.y < INVADERS_HEIGHT + 8 && !(Math.abs(bullet.x - next.player) <= 15 && Math.abs(bullet.y - PLAYER_Y) <= 13));
    if (hit && next.invulnerable === 0) {
      next.lives--; next.invulnerable = 1400; next.enemyBullets = []; next.player = 180;
      if (!next.lives) return { ...next, status: 'lost' };
    }
    if (!next.enemies.length) {
      next.score += 100; next.bullets = []; next.enemyBullets = [];
      if (next.wave === INVADERS_WAVES) return { ...next, status: 'won' };
      next.waveDelay = 1100;
    }
  }
  return next;
}
