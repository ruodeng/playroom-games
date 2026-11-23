export const BUBBLE_WIDTH = 360;
export const BUBBLE_HEIGHT = 450;
export const BUBBLE_RADIUS = 18;
export const BUBBLE_LIMIT = 360;
export const BUBBLE_ORIGIN = { x: 180, y: 418 };
const ROW_HEIGHT = Math.sqrt(3) * BUBBLE_RADIUS;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const slotKey = bubble => `${bubble.row}:${bubble.col}`;

export function bubblePosition(bubble, ceiling = 0) {
  return { x: 18 + bubble.col * 36 + (bubble.row % 2) * 18, y: 22 + bubble.row * ROW_HEIGHT + ceiling };
}
export function bubbleNeighbors(bubble) {
  const { row, col } = bubble, offset = row % 2 ? 1 : -1;
  return [[row, col - 1], [row, col + 1], [row - 1, col], [row - 1, col + offset], [row + 1, col], [row + 1, col + offset]]
    .filter(([r, c]) => r >= 0 && r <= 12 && c >= 0 && c < (r % 2 ? 9 : 10))
    .map(([r, c]) => ({ row: r, col: c }));
}
function chooseColor(board, rng) {
  const colors = [...new Set(board.map(bubble => bubble.color))];
  return colors.length ? colors[Math.min(colors.length - 1, Math.floor(rng() * colors.length))] : 0;
}
export function createBubbles(rng = Math.random) {
  const board = [];
  for (let row = 0; row < 5; row++) {
    let color = 0;
    for (let col = 0; col < (row % 2 ? 9 : 10); col++) {
      if (col % 2 === 0) color = Math.floor(rng() * 4) % 4;
      board.push({ row, col, color });
    }
  }
  return { board, current: chooseColor(board, rng), next: chooseColor(board, rng), angle: -Math.PI / 2, shot: null, ceiling: 0, misses: 0, shots: 0, score: 0, lastPop: 0, lastDrop: 0, status: 'playing' };
}
export function aimBubbles(game, angle) {
  if (game.status !== 'playing' || !Number.isFinite(angle)) return game;
  const next = clamp(angle, -Math.PI + .24, -.24);
  return next === game.angle ? game : { ...game, angle: next };
}
export function fireBubbles(game) {
  if (game.status !== 'playing' || game.shot) return game;
  return { ...game, shots: game.shots + 1, lastPop: 0, lastDrop: 0, shot: { ...BUBBLE_ORIGIN, vx: Math.cos(game.angle) * 430, vy: Math.sin(game.angle) * 430, color: game.current } };
}
function connected(board, seeds, color) {
  const map = new Map(board.map(bubble => [slotKey(bubble), bubble]));
  const found = new Set(seeds.map(slotKey)), queue = [...seeds];
  for (let i = 0; i < queue.length; i++) {
    for (const neighbor of bubbleNeighbors(queue[i])) {
      const key = slotKey(neighbor), bubble = map.get(key);
      if (bubble && !found.has(key) && (color === undefined || bubble.color === color)) { found.add(key); queue.push(bubble); }
    }
  }
  return found;
}
function attach(game, contact, rng) {
  const occupied = new Set(game.board.map(slotKey));
  const candidates = (contact ? bubbleNeighbors(contact) : Array.from({ length: 10 }, (_, col) => ({ row: 0, col })))
    .filter(bubble => !occupied.has(slotKey(bubble)));
  candidates.sort((a, b) => {
    const pa = bubblePosition(a, game.ceiling), pb = bubblePosition(b, game.ceiling);
    return Math.hypot(pa.x - game.shot.x, pa.y - game.shot.y) - Math.hypot(pb.x - game.shot.x, pb.y - game.shot.y);
  });
  if (!candidates.length) return { ...game, shot: null, status: 'lost' };
  const placed = { ...candidates[0], color: game.shot.color };
  let board = [...game.board, placed], popped = 0, dropped = 0;
  const match = connected(board, [placed], placed.color);
  if (match.size >= 3) {
    popped = match.size;
    board = board.filter(bubble => !match.has(slotKey(bubble)));
    const supported = connected(board, board.filter(bubble => bubble.row === 0));
    dropped = board.length - supported.size;
    board = board.filter(bubble => supported.has(slotKey(bubble)));
  }
  const misses = popped ? 0 : (game.misses + 1) % 5;
  const ceiling = game.ceiling + (!popped && misses === 0 ? 18 : 0);
  const status = !board.length ? 'won' : board.some(bubble => bubblePosition(bubble, ceiling).y + BUBBLE_RADIUS >= BUBBLE_LIMIT) ? 'lost' : 'playing';
  const current = board.some(bubble => bubble.color === game.next) ? game.next : chooseColor(board, rng);
  return { ...game, board, current, next: chooseColor(board, rng), shot: null, ceiling, misses, score: game.score + popped * 10 + dropped * 20, lastPop: popped, lastDrop: dropped, status };
}
export function stepBubbles(game, ms, rng = Math.random) {
  if (game.status !== 'playing' || !game.shot || !(ms > 0)) return game;
  const next = { ...game, shot: { ...game.shot } }, duration = Math.min(ms, 80);
  for (let time = 0; time < duration; time += 4) {
    const dt = Math.min(4, duration - time) / 1000, shot = next.shot;
    shot.x += shot.vx * dt; shot.y += shot.vy * dt;
    if (shot.x < 18) { shot.x = 36 - shot.x; shot.vx = Math.abs(shot.vx); }
    if (shot.x > 342) { shot.x = 684 - shot.x; shot.vx = -Math.abs(shot.vx); }
    const contact = next.board.find(bubble => { const point = bubblePosition(bubble, next.ceiling); return Math.hypot(point.x - shot.x, point.y - shot.y) <= 36; });
    if (contact || shot.y <= 22 + next.ceiling) return attach(next, contact, rng);
  }
  return next;
}
