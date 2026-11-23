import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnakeGame, spawnFood, startSnake, pauseSnake, turnSnake, stepSnake } from '../src/snake.js';

const fresh = () => createSnakeGame(() => 0);
const playing = () => startSnake(fresh());

test('snake starts ready with three segments and food on an empty cell', () => {
  const game = fresh();
  assert.equal(game.status, 'ready');
  assert.equal(game.snake.length, 3);
  assert.equal(game.score, 0);
  assert.equal(game.snake.some(cell => cell.x === game.food.x && cell.y === game.food.y), false);
  assert.equal(stepSnake(game), game);
});

test('a step moves one cell while keeping length and the prior state intact', () => {
  const game = playing();
  const snapshot = structuredClone(game);
  const next = stepSnake(game);
  assert.deepEqual(next.snake[0], { x: 11, y: 10 });
  assert.equal(next.snake.length, 3);
  assert.equal(next.score, 0);
  assert.deepEqual(game, snapshot);
});

test('food grows the snake, scores ten points, and respawns outside its body', () => {
  const game = { ...playing(), food: { x: 11, y: 10 } };
  const next = stepSnake(game, () => .5);
  assert.equal(next.score, 10);
  assert.equal(next.snake.length, 4);
  assert.equal(next.snake.some(cell => cell.x === next.food.x && cell.y === next.food.y), false);
});

test('direct reversals and repeated directions are rejected', () => {
  const game = playing();
  assert.equal(turnSnake(game, 'left'), game);
  assert.equal(turnSnake(game, 'right'), game);
  assert.equal(turnSnake(game, 'invalid'), game);
  const up = turnSnake(game, 'up');
  assert.equal(turnSnake(up, 'down'), up);
});

test('quick turns are queued and applied one per tick without an instant reversal', () => {
  let game = turnSnake(turnSnake(playing(), 'up'), 'left');
  assert.deepEqual(game.turns, ['up', 'left']);
  assert.equal(turnSnake(game, 'down'), game);
  game = stepSnake(game);
  assert.deepEqual(game.snake[0], { x: 10, y: 9 });
  game = stepSnake(game);
  assert.deepEqual(game.snake[0], { x: 9, y: 9 });
  assert.equal(game.status, 'running');
});

test('a wall collision ends the game and cannot advance or resume', () => {
  const game = { ...playing(), snake: [{ x: 19, y: 10 }, { x: 18, y: 10 }, { x: 17, y: 10 }] };
  const over = stepSnake(game);
  assert.equal(over.status, 'over');
  assert.equal(over.reason, 'wall');
  assert.deepEqual(over.snake, game.snake);
  assert.equal(stepSnake(over), over);
  assert.equal(startSnake(over), over);
});

test('hitting a body segment ends the game', () => {
  const game = { ...playing(), snake: [{ x: 5, y: 5 }, { x: 5, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 5 }, { x: 6, y: 6 }] };
  assert.equal(stepSnake(game).status, 'over');
  assert.equal(stepSnake(game).reason, 'self');
});

test('moving into the vacated tail cell is legal', () => {
  const game = { ...playing(), snake: [{ x: 5, y: 5 }, { x: 5, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 5 }] };
  const next = stepSnake(game);
  assert.equal(next.status, 'running');
  assert.deepEqual(next.snake[0], { x: 6, y: 5 });
  assert.equal(next.snake.length, 4);
});

test('pause freezes movement and input; resuming preserves the board and score', () => {
  const game = stepSnake({ ...playing(), food: { x: 11, y: 10 } }, () => 0);
  const paused = pauseSnake(game);
  assert.equal(paused.status, 'paused');
  assert.equal(stepSnake(paused), paused);
  assert.equal(turnSnake(paused, 'up'), paused);
  const resumed = startSnake(paused);
  assert.equal(resumed.status, 'running');
  assert.deepEqual(resumed.snake, game.snake);
  assert.equal(resumed.score, 10);
  assert.equal(pauseSnake(paused), paused);
});

test('the last free cell completes the game instead of searching forever for food', () => {
  const game = { ...playing(), size: 2, snake: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], food: { x: 1, y: 0 } };
  const won = stepSnake(game);
  assert.equal(won.status, 'won');
  assert.equal(won.score, 10);
  assert.equal(won.snake.length, 4);
  assert.equal(won.food, null);
  assert.equal(stepSnake(won), won);
});

test('food placement can select the first and last empty cells and handles a full board', () => {
  const snake = [{ x: 0, y: 0 }];
  assert.deepEqual(spawnFood(snake, 2, () => 0), { x: 1, y: 0 });
  assert.deepEqual(spawnFood(snake, 2, () => .999), { x: 1, y: 1 });
  assert.equal(spawnFood([{ x: 0, y: 0 }], 1), null);
});
