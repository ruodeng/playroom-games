export const BREAKOUT_WIDTH = 400;
export const BREAKOUT_HEIGHT = 500;
export function createBreakout() {
  return { paddle: 162, ball: { x: 200, y: 457, vx: 145, vy: -210 }, bricks: Array.from({ length: 30 }, (_, i) => ({ x: 18 + (i % 6) * 61, y: 42 + Math.floor(i / 6) * 27, alive: true })), score: 0, lives: 3, flying: false, status: 'playing' };
}
export function steerBreakout(game, center) {
  if (game.status !== 'playing') return game;
  const paddle = Math.max(0, Math.min(324, center - 38));
  return { ...game, paddle, ball: game.flying ? game.ball : { ...game.ball, x: paddle + 38 } };
}
export function launchBreakout(game) { return game.status === 'playing' && !game.flying ? { ...game, flying: true } : game; }
export function stepBreakout(game, ms, direction = 0) {
  if (game.status !== 'playing') return game;
  // Small substeps keep the ball from crossing a brick between collision checks.
  const duration = Math.max(0, Math.min(ms, 100));
  let next = { ...game, ball: { ...game.ball }, bricks: game.bricks.map(brick => ({ ...brick })) };
  for (let time = 0; time < duration; time += 8) {
    const dt = Math.min(8, duration - time) / 1000;
    if (direction) next = steerBreakout(next, next.paddle + 38 + direction * 330 * dt);
    if (!next.flying) continue;
    const ball = next.ball, oldX = ball.x, oldY = ball.y;
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    if (ball.x < 6) { ball.x = 6; ball.vx = Math.abs(ball.vx); }
    if (ball.x > 394) { ball.x = 394; ball.vx = -Math.abs(ball.vx); }
    if (ball.y < 6) { ball.y = 6; ball.vy = Math.abs(ball.vy); }
    if (ball.vy > 0 && oldY + 6 <= 470 && ball.y + 6 >= 470 && ball.x + 6 >= next.paddle && ball.x - 6 <= next.paddle + 76) {
      const impact = Math.max(-1, Math.min(1, (ball.x - next.paddle - 38) / 38));
      const speed = Math.min(340, Math.hypot(ball.vx, ball.vy) + 3);
      ball.y = 464; ball.vx = impact * speed * .82;
      ball.vy = -Math.sqrt(speed * speed - ball.vx * ball.vx);
    }
    for (const brick of next.bricks) {
      if (!brick.alive || ball.x + 6 < brick.x || ball.x - 6 > brick.x + 55 || ball.y + 6 < brick.y || ball.y - 6 > brick.y + 19) continue;
      brick.alive = false; next.score += 10;
      if (oldX + 6 <= brick.x || oldX - 6 >= brick.x + 55) ball.vx *= -1;
      else ball.vy *= -1;
      ball.x = oldX; ball.y = oldY;
      break;
    }
    if (next.bricks.every(brick => !brick.alive)) return { ...next, status: 'won', flying: false };
    if (ball.y > 512) {
      next.lives--;
      next.flying = false;
      next.ball = { x: next.paddle + 38, y: 457, vx: 145, vy: -210 };
      if (!next.lives) return { ...next, status: 'lost' };
      break;
    }
  }
  return next;
}
