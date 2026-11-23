export const PONG_WIDTH = 400;
export const PONG_HEIGHT = 320;
export const PONG_PADDLE = 66;
export const PONG_TARGET = 7;
const RADIUS = 6, PLAYER_X = 18, AI_X = 372;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createPong() {
  return { player: 127, computer: 127, playerScore: 0, computerScore: 0, score: 0, rally: 0, serve: 1, serving: true, ball: { x: 200, y: 160, vx: 0, vy: 0 }, status: 'playing' };
}
export function steerPong(game, center) {
  if (game.status !== 'playing' || !Number.isFinite(center)) return game;
  const player = clamp(center - PONG_PADDLE / 2, 8, PONG_HEIGHT - PONG_PADDLE - 8);
  return player === game.player ? game : { ...game, player };
}
export function servePong(game) {
  if (game.status !== 'playing' || !game.serving) return game;
  return { ...game, serving: false, rally: 0, ball: { x: 200, y: 160, vx: game.serve * 220, vy: (game.playerScore + game.computerScore) % 2 ? 95 : -95 } };
}
function point(game, playerWon) {
  const playerScore = game.playerScore + Number(playerWon), computerScore = game.computerScore + Number(!playerWon);
  return { ...game, playerScore, computerScore, score: playerScore * 100, serving: true, serve: playerWon ? -1 : 1, ball: { x: 200, y: 160, vx: 0, vy: 0 }, status: playerScore >= PONG_TARGET ? 'won' : computerScore >= PONG_TARGET ? 'lost' : 'playing' };
}
export function stepPong(game, ms, direction = 0) {
  if (game.status !== 'playing' || !(ms > 0)) return game;
  const next = { ...game, ball: { ...game.ball } }, duration = Math.min(ms, 80);
  for (let time = 0; time < duration; time += 4) {
    const dt = Math.min(4, duration - time) / 1000;
    next.player = clamp(next.player + clamp(direction, -1, 1) * 300 * dt, 8, PONG_HEIGHT - PONG_PADDLE - 8);
    if (next.serving) continue;
    const ball = next.ball, oldX = ball.x;
    // The opponent follows the ball at a fixed speed; angled shots can outrun it.
    const target = ball.vx > 0 ? ball.y + Math.sin(next.rally * 1.7) * 18 : PONG_HEIGHT / 2;
    const aiSpeed = 135 + Math.min(25, next.computerScore * 3);
    next.computer = clamp(next.computer + clamp(target - next.computer - PONG_PADDLE / 2, -aiSpeed * dt, aiSpeed * dt), 8, PONG_HEIGHT - PONG_PADDLE - 8);
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    if (ball.y < RADIUS) { ball.y = 2 * RADIUS - ball.y; ball.vy = Math.abs(ball.vy); }
    if (ball.y > PONG_HEIGHT - RADIUS) { ball.y = 2 * (PONG_HEIGHT - RADIUS) - ball.y; ball.vy = -Math.abs(ball.vy); }
    const hitLeft = ball.vx < 0 && oldX - RADIUS >= PLAYER_X + 10 && ball.x - RADIUS <= PLAYER_X + 10;
    const hitRight = ball.vx > 0 && oldX + RADIUS <= AI_X && ball.x + RADIUS >= AI_X;
    const paddle = hitLeft ? next.player : next.computer;
    if ((hitLeft || hitRight) && ball.y + RADIUS >= paddle && ball.y - RADIUS <= paddle + PONG_PADDLE) {
      const impact = clamp((ball.y - paddle - PONG_PADDLE / 2) / (PONG_PADDLE / 2), -1, 1);
      const speed = Math.min(440, Math.hypot(ball.vx, ball.vy) + 15), angle = impact * 1.04;
      ball.vx = Math.cos(angle) * speed * (hitLeft ? 1 : -1); ball.vy = Math.sin(angle) * speed;
      ball.x = hitLeft ? PLAYER_X + 10 + RADIUS : AI_X - RADIUS; next.rally++;
    }
    if (ball.x < -RADIUS) return point(next, false);
    if (ball.x > PONG_WIDTH + RADIUS) return point(next, true);
  }
  return next;
}
