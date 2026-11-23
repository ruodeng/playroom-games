export const RUNNER_WIDTH = 640;
export const RUNNER_HEIGHT = 250;
export const RUNNER_GROUND = 198;
export const RUNNER_X = 76;
export const RUNNER_GRAVITY = 1800;
export const RUNNER_JUMP = 650;

export function createRunner() {
  return { height: 0, velocity: 0, elapsed: 0, distance: 0, speed: 210, score: 0, passed: 0, obstacles: [{ id: 0, x: 680, width: 26, height: 40, passed: false }], spawnIn: 1900, nextId: 1, status: 'playing' };
}

export function jumpRunner(game) {
  if (game.status !== 'playing' || game.height > 0 || game.velocity !== 0) return game;
  return { ...game, velocity: RUNNER_JUMP };
}

function collides(game, obstacle) {
  // Insets forgive the dinosaur's transparent silhouette, while 8 ms physics
  // steps prevent thin obstacles from being skipped at the maximum speed.
  const left = RUNNER_X + 5, right = RUNNER_X + 31;
  const top = RUNNER_GROUND - game.height - 34, bottom = RUNNER_GROUND - game.height - 3;
  return right > obstacle.x + 3 && left < obstacle.x + obstacle.width - 3 && bottom > RUNNER_GROUND - obstacle.height + 3 && top < RUNNER_GROUND;
}

export function stepRunner(game, ms, random = Math.random) {
  if (game.status !== 'playing' || !Number.isFinite(ms) || ms <= 0) return game;
  const duration = Math.min(ms, 100);
  const next = { ...game, obstacles: game.obstacles.map(obstacle => ({ ...obstacle })) };
  for (let time = 0; time < duration; time += 8) {
    const dtMs = Math.min(8, duration - time), dt = dtMs / 1000;
    next.elapsed += dtMs;
    next.speed = Math.min(380, 210 + next.elapsed / 1000 * 2.2);
    next.distance += next.speed * dt;
    if (next.height > 0 || next.velocity > 0) {
      next.height += next.velocity * dt - RUNNER_GRAVITY * dt * dt / 2;
      next.velocity -= RUNNER_GRAVITY * dt;
      if (next.height <= 0) { next.height = 0; next.velocity = 0; }
    }
    next.spawnIn -= dtMs;
    if (next.spawnIn <= 0) {
      next.obstacles.push({ id: next.nextId++, x: RUNNER_WIDTH + 35, width: 24 + Math.floor(random() * 19), height: 34 + Math.floor(random() * 23), passed: false });
      next.spawnIn += 1400 + random() * 650;
    }
    for (const obstacle of next.obstacles) {
      obstacle.x -= next.speed * dt;
      if (collides(next, obstacle)) return { ...next, status: 'lost', score: Math.floor(next.distance / 10) + next.passed * 25 };
      if (!obstacle.passed && obstacle.x + obstacle.width < RUNNER_X) { obstacle.passed = true; next.passed++; }
    }
    next.obstacles = next.obstacles.filter(obstacle => obstacle.x + obstacle.width >= 0);
    next.score = Math.floor(next.distance / 10) + next.passed * 25;
  }
  return next;
}
