// Every passage is connected; the four large pellets make the hunters vulnerable.
export const MAZE_MAP = [
  '###############',
  '#o....#.#....o#',
  '#.##.#...#.##.#',
  '#....#.#.#....#',
  '###.##.#.##.###',
  '#.............#',
  '#.##.##.##.##.#',
  '#....#...#....#',
  '#.##.#.#.#.##.#',
  '#....#...#....#',
  '###.##.#.##.###',
  '#.............#',
  '#.##.##.##.##.#',
  '#o...#...#...o#',
  '###############',
];
export const MAZE_COLS = 15;
export const MAZE_ROWS = 15;
export const MAZE_DIRECTIONS = { left: [-1, 0], up: [0, -1], right: [1, 0], down: [0, 1] };
const START = 7 + 11 * MAZE_COLS, GHOST_STARTS = [7 + 2 * MAZE_COLS, 7 + 7 * MAZE_COLS];

export function mazeOpen(index) {
  return Number.isInteger(index) && index >= 0 && index < MAZE_COLS * MAZE_ROWS && MAZE_MAP[Math.floor(index / MAZE_COLS)][index % MAZE_COLS] !== '#';
}
export function mazeNeighbor(index, direction) {
  const delta = MAZE_DIRECTIONS[direction];
  if (!delta) return index;
  const x = index % MAZE_COLS + delta[0], y = Math.floor(index / MAZE_COLS) + delta[1];
  const next = y * MAZE_COLS + x;
  return x >= 0 && x < MAZE_COLS && y >= 0 && y < MAZE_ROWS && mazeOpen(next) ? next : index;
}
export function createMaze() {
  const pellets = MAZE_MAP.join('').split('').map((cell, index) => cell === '#' || index === START ? 0 : cell === 'o' ? 2 : 1);
  return { player: START, direction: 'left', queued: 'left', ghosts: GHOST_STARTS.map((position, id) => ({ id, position, previous: position, wait: 0 })), pellets, remaining: pellets.filter(Boolean).length, score: 0, lives: 3, power: 0, invulnerable: 1600, playerClock: 0, ghostClock: 0, ready: true, status: 'playing' };
}
export function turnMaze(game, direction) {
  if (game.status !== 'playing' || !MAZE_DIRECTIONS[direction]) return game;
  return { ...game, queued: direction, ready: false };
}
function distances(target) {
  const values = new Map([[target, 0]]), queue = [target];
  for (let i = 0; i < queue.length; i++) for (const direction of Object.keys(MAZE_DIRECTIONS)) {
    const next = mazeNeighbor(queue[i], direction);
    if (!values.has(next)) { values.set(next, values.get(queue[i]) + 1); queue.push(next); }
  }
  return values;
}
function collide(game, oldPlayer, oldGhosts) {
  const colliding = game.ghosts.filter(ghost => !ghost.wait && (ghost.position === game.player || (ghost.position === oldPlayer && oldGhosts.find(old => old.id === ghost.id)?.position === game.player)));
  if (!colliding.length) return game;
  if (game.power > 0) {
    const ids = new Set(colliding.map(ghost => ghost.id));
    return { ...game, score: game.score + ids.size * 100, ghosts: game.ghosts.map(ghost => ids.has(ghost.id) ? { ...ghost, position: GHOST_STARTS[ghost.id], previous: GHOST_STARTS[ghost.id], wait: 1800 } : ghost) };
  }
  if (game.invulnerable > 0) return game;
  const lives = game.lives - 1;
  return { ...game, lives, player: START, direction: 'left', queued: 'left', ready: true, invulnerable: 1600, playerClock: 0, ghostClock: 0, ghosts: GHOST_STARTS.map((position, id) => ({ id, position, previous: position, wait: 0 })), status: lives ? 'playing' : 'lost' };
}
export function stepMaze(game, ms) {
  if (game.status !== 'playing' || game.ready || !(ms > 0)) return game;
  let next = { ...game, pellets: [...game.pellets], ghosts: game.ghosts.map(ghost => ({ ...ghost })) };
  const duration = Math.min(ms, 160);
  // Resolve each cell event in chronological order, including opposite-direction crossings.
  for (let time = 0; time < duration; time += 10) {
    const elapsed = Math.min(10, duration - time), oldPlayer = next.player, oldGhosts = next.ghosts.map(ghost => ({ ...ghost }));
    next.power = Math.max(0, next.power - elapsed); next.invulnerable = Math.max(0, next.invulnerable - elapsed);
    for (const ghost of next.ghosts) ghost.wait = Math.max(0, ghost.wait - elapsed);
    next.playerClock += elapsed; next.ghostClock += elapsed;
    if (next.playerClock >= 145) {
      next.playerClock -= 145;
      if (mazeNeighbor(next.player, next.queued) !== next.player) next.direction = next.queued;
      next.player = mazeNeighbor(next.player, next.direction);
      const pellet = next.pellets[next.player];
      if (pellet) {
        next.pellets[next.player] = 0; next.remaining--; next.score += pellet === 2 ? 50 : 10;
        if (pellet === 2) next.power = 6500;
      }
    }
    const ghostInterval = next.power > 0 ? 310 : 235;
    if (next.ghostClock >= ghostInterval) {
      next.ghostClock -= ghostInterval;
      const distance = distances(next.player);
      next.ghosts = next.ghosts.map(ghost => {
        if (ghost.wait) return ghost;
        let choices = Object.keys(MAZE_DIRECTIONS).map(direction => mazeNeighbor(ghost.position, direction)).filter(position => position !== ghost.position);
        const forward = choices.filter(position => position !== ghost.previous);
        if (forward.length) choices = forward;
        choices.sort((a, b) => (next.power > 0 ? -1 : 1) * ((distance.get(a) ?? 999) - (distance.get(b) ?? 999)) || (ghost.id ? b - a : a - b));
        return { ...ghost, previous: ghost.position, position: choices[0] ?? ghost.position };
      });
    }
    next = collide(next, oldPlayer, oldGhosts);
    if (next.status === 'lost' || next.ready) return next;
    if (!next.remaining) return { ...next, status: 'won' };
  }
  return next;
}
