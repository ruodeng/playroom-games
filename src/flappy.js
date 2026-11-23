export const FLAPPY_WIDTH = 360;
export const FLAPPY_HEIGHT = 450;
export const FLAPPY_GROUND = 422;
export const FLAPPY_RADIUS = 12;
export const FLAPPY_GOAL = 20;
const GAP = 142, PIPE_WIDTH = 54;

function pipe(id, x, rng) {
  return { id, x, gapY: 112 + rng() * 180, passed: false };
}
export function createFlappy(rng = Math.random) {
  return { bird: { x: 86, y: 214, vy: 0 }, pipes: [pipe(0, 380, rng), pipe(1, 584, rng)], nextId: 2, distance: 0, score: 0, flying: false, status: 'playing' };
}
export function flapFlappy(game) {
  return game.status === 'playing' ? { ...game, flying: true, bird: { ...game.bird, vy: -265 } } : game;
}
function circleRect(x, y, radius, left, top, width, height) {
  const dx = x - Math.max(left, Math.min(left + width, x)), dy = y - Math.max(top, Math.min(top + height, y));
  return dx * dx + dy * dy <= radius * radius;
}
export function stepFlappy(game, ms, rng = Math.random) {
  if (game.status !== 'playing' || !game.flying || !(ms > 0)) return game;
  const next = { ...game, bird: { ...game.bird }, pipes: game.pipes.map(item => ({ ...item })) }, duration = Math.min(ms, 80);
  for (let time = 0; time < duration; time += 5) {
    const dt = Math.min(5, duration - time) / 1000, speed = 114 + Math.min(22, next.score * 1.3);
    next.bird.vy = Math.min(390, next.bird.vy + 760 * dt);
    next.bird.y += next.bird.vy * dt; next.distance += speed * dt;
    for (const item of next.pipes) item.x -= speed * dt;
    const bird = next.bird;
    if (bird.y - FLAPPY_RADIUS <= 0 || bird.y + FLAPPY_RADIUS >= FLAPPY_GROUND || next.pipes.some(item =>
      circleRect(bird.x, bird.y, FLAPPY_RADIUS, item.x, 0, PIPE_WIDTH, item.gapY - GAP / 2) ||
      circleRect(bird.x, bird.y, FLAPPY_RADIUS, item.x, item.gapY + GAP / 2, PIPE_WIDTH, FLAPPY_GROUND - item.gapY - GAP / 2))) return { ...next, status: 'lost' };
    for (const item of next.pipes) {
      if (!item.passed && item.x + PIPE_WIDTH < bird.x - FLAPPY_RADIUS) { item.passed = true; next.score++; }
    }
    if (next.score >= FLAPPY_GOAL) return { ...next, status: 'won', flying: false };
    next.pipes = next.pipes.filter(item => item.x + PIPE_WIDTH > -4);
    const last = next.pipes.at(-1);
    if (!last || last.x <= 360) next.pipes.push(pipe(next.nextId++, last ? last.x + 204 : 380, rng));
  }
  return next;
}
export const FLAPPY_PIPE = { gap: GAP, width: PIPE_WIDTH };
