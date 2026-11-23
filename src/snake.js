export const SNAKE_SIZE = 20;
export const SNAKE_SPEEDS = { easy: 220, normal: 150, fast: 100 };
const DIRECTIONS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const sameCell = (a, b) => a.x === b.x && a.y === b.y;

export function spawnFood(snake, size, random = Math.random) {
  const occupied = new Set(snake.map(cell => cell.y * size + cell.x));
  const free = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!occupied.has(y * size + x)) free.push({ x, y });
    }
  }
  if (!free.length) return null;
  return free[Math.min(free.length - 1, Math.max(0, Math.floor(random() * free.length)))];
}

export function createSnakeGame(random = Math.random, size = SNAKE_SIZE) {
  const center = Math.floor(size / 2);
  const snake = [{ x: center, y: center }, { x: center - 1, y: center }, { x: center - 2, y: center }];
  return { size, snake, direction: 'right', turns: [], food: spawnFood(snake, size, random), score: 0, status: 'ready', reason: null };
}

export function startSnake(game) {
  return ['ready', 'paused'].includes(game.status) ? { ...game, status: 'running' } : game;
}

export function pauseSnake(game) {
  return game.status === 'running' ? { ...game, status: 'paused' } : game;
}

export function turnSnake(game, direction) {
  if (game.status !== 'running' || !Object.hasOwn(DIRECTIONS, direction) || game.turns.length >= 2) return game;
  const previous = game.turns.at(-1) ?? game.direction;
  const [dx, dy] = DIRECTIONS[previous];
  const [nextX, nextY] = DIRECTIONS[direction];
  if (previous === direction || (dx + nextX === 0 && dy + nextY === 0)) return game;
  return { ...game, turns: [...game.turns, direction] };
}

export function stepSnake(game, random = Math.random) {
  if (game.status !== 'running') return game;
  const direction = game.turns[0] ?? game.direction;
  const [dx, dy] = DIRECTIONS[direction];
  const head = { x: game.snake[0].x + dx, y: game.snake[0].y + dy };
  const eating = game.food && sameCell(head, game.food);
  // On ordinary moves the tail leaves its cell before collision checking.
  const body = eating ? game.snake : game.snake.slice(0, -1);
  const wall = head.x < 0 || head.y < 0 || head.x >= game.size || head.y >= game.size;
  if (wall || body.some(cell => sameCell(cell, head))) {
    return { ...game, direction, turns: [], status: 'over', reason: wall ? 'wall' : 'self' };
  }
  const snake = [head, ...body];
  const food = eating ? spawnFood(snake, game.size, random) : game.food;
  return {
    ...game, snake, food, direction, turns: game.turns.slice(1),
    score: game.score + (eating ? 10 : 0),
    status: food ? 'running' : 'won',
  };
}
