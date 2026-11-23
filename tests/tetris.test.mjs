import test from 'node:test';
import assert from 'node:assert/strict';
import { PIECE_TYPES, shuffledBag, pieceCells, fits, createTetrisGame, startTetris, pauseTetris, moveTetris, rotateTetris, landingPiece, stepTetris, hardDropTetris, fallInterval } from '../src/tetris.js';

const random = () => .5;
const playing = () => startTetris(createTetrisGame(random));
const withPiece = (type, x = 3, y = 0, rotation = 0) => ({ ...playing(), current: { type, x, y, rotation } });

test('each bag contains all seven pieces once and the preview follows that order', () => {
  for (const seed of [0, .2, .5, .99]) assert.deepEqual(shuffledBag(() => seed).sort(), [...PIECE_TYPES].sort());
  let game = playing();
  const sequence = [];
  for (let index = 0; index < 21; index++) {
    sequence.push(game.current.type);
    const expected = game.queue[0];
    game = hardDropTetris(game, random);
    assert.equal(game.current.type, expected);
    game = { ...game, board: createTetrisGame(random).board };
  }
  for (let index = 0; index < 21; index += 7) assert.equal(new Set(sequence.slice(index, index + 7)).size, 7);
});

test('new games have independent empty rows and stay still until started', () => {
  const game = createTetrisGame(random);
  assert.equal(game.board.length, 20);
  assert.ok(game.board.every(row => row.length === 10 && row.every(cell => cell === '')));
  assert.equal(new Set(game.board).size, 20);
  assert.equal(game.status, 'ready');
  assert.equal(stepTetris(game), game);
  assert.equal(moveTetris(game, 1), game);
  assert.equal(rotateTetris(game), game);
  assert.equal(hardDropTetris(game), game);
  assert.equal(startTetris(game).status, 'running');
});

test('every piece has four cells, four rotations restore it, and rotations are reversible', () => {
  for (const type of PIECE_TYPES) {
    const game = withPiece(type, 3, 5);
    let rotated = game;
    for (let count = 0; count < 4; count++) {
      assert.equal(pieceCells(rotated.current).length, 4);
      rotated = rotateTetris(rotated);
    }
    assert.deepEqual(rotated.current, game.current);
    assert.deepEqual(rotateTetris(rotateTetris(game), -1).current, game.current);
  }
});

test('gravity and soft drop move one cell, with points only for manual descent', () => {
  const game = playing();
  const snapshot = structuredClone(game);
  assert.equal(stepTetris(game).current.y, game.current.y + 1);
  assert.equal(stepTetris(game).score, 0);
  assert.equal(stepTetris(game, random, true).score, 1);
  assert.deepEqual(game, snapshot);
});

test('pieces cannot move past walls or into settled blocks', () => {
  const left = withPiece('O', 0, 5);
  const right = withPiece('O', 8, 5);
  assert.equal(moveTetris(left, -1), left);
  assert.equal(moveTetris(right, 1), right);
  left.board[5][2] = 'T';
  assert.equal(moveTetris(left, 1), left);
  assert.equal(fits(left.board, { type: 'I', x: -1, y: 0, rotation: 0 }), false);
});

test('rotation can adjust at a wall or floor while a completely blocked rotation stays put', () => {
  const wall = withPiece('I', -2, 5, 1);
  assert.ok(fits(wall.board, wall.current));
  const turned = rotateTetris(wall);
  assert.equal(turned.current.rotation, 2);
  assert.ok(fits(turned.board, turned.current));
  const floor = withPiece('T', 3, 18);
  const lifted = rotateTetris(floor);
  assert.equal(lifted.current.rotation, 1);
  assert.equal(lifted.current.y, 17);
  assert.ok(fits(lifted.board, lifted.current));
  const trapped = withPiece('T', 3, 10);
  trapped.board = trapped.board.map(row => row.map(() => 'J'));
  for (const { x, y } of pieceCells(trapped.current)) trapped.board[y][x] = '';
  assert.equal(rotateTetris(trapped), trapped);
});

test('hard drop lands at the ghost, locks once, awards distance points and preserves prior state', () => {
  const game = withPiece('T');
  game.board[19][4] = 'O';
  const snapshot = structuredClone(game);
  const landing = landingPiece(game);
  const next = hardDropTetris(game, random);
  assert.equal(next.score, (landing.y - game.current.y) * 2);
  assert.equal(next.pieces, 1);
  assert.equal(next.current.type, game.queue[0]);
  for (const { x, y } of pieceCells(landing)) assert.equal(next.board[y][x], 'T');
  assert.deepEqual(game, snapshot);
});

for (const [lines, points] of [[1, 100], [2, 300], [3, 500], [4, 800]]) {
  test(`clearing ${lines} rows scores ${points} and collapses the board correctly`, () => {
    const game = withPiece('I', 2, 16, 1);
    for (let y = 20 - lines; y < 20; y++) game.board[y] = Array.from({ length: 10 }, (_, x) => x === 4 ? '' : 'J');
    game.board[10][0] = 'Z';
    const snapshot = structuredClone(game);
    const next = stepTetris(game, random);
    assert.equal(next.lines, lines);
    assert.equal(next.lastClear, lines);
    assert.equal(next.score, points);
    assert.equal(next.board.length, 20);
    assert.equal(next.board[10 + lines][0], 'Z');
    assert.ok(next.board.slice(0, lines).every(row => row.every(cell => !cell)));
    assert.deepEqual(game, snapshot);
  });
}

test('ten cleared lines level up, scoring uses the previous level, and speed has a lower bound', () => {
  const game = { ...withPiece('I', 2, 16, 1), lines: 19, level: 2 };
  game.board[19] = Array.from({ length: 10 }, (_, x) => x === 4 ? '' : 'J');
  const next = stepTetris(game, random);
  assert.equal(next.lines, 20);
  assert.equal(next.level, 3);
  assert.equal(next.score, 200);
  assert.ok(fallInterval(next.level) < fallInterval(game.level));
  assert.equal(fallInterval(1000), 120);
});

test('a blocked spawn ends the game without overwriting settled blocks', () => {
  const game = withPiece('O', 0, 18);
  game.queue = ['T', ...game.queue];
  game.board[0][4] = 'Z';
  const over = stepTetris(game, random);
  assert.equal(over.status, 'over');
  assert.equal(over.current, null);
  assert.equal(over.board[0][4], 'Z');
  assert.equal(over.board[19][0], 'O');
  assert.equal(startTetris(over), over);
  assert.equal(hardDropTetris(over), over);
  assert.equal(landingPiece(over), null);
});

test('a piece that locks above the ceiling ends safely', () => {
  const game = withPiece('I', 3, -2);
  game.board[0][3] = 'Z';
  const over = stepTetris(game, random);
  assert.equal(over.status, 'over');
  assert.equal(over.current, null);
  assert.deepEqual(over.board, game.board);
});

test('pause freezes movement and descent, and resume retains progress', () => {
  const game = hardDropTetris(playing(), random);
  const paused = pauseTetris(game);
  assert.equal(paused.status, 'paused');
  assert.equal(stepTetris(paused), paused);
  assert.equal(moveTetris(paused, 1), paused);
  assert.equal(rotateTetris(paused), paused);
  assert.equal(hardDropTetris(paused), paused);
  assert.deepEqual(startTetris(paused), game);
});
