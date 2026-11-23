import test from 'node:test';
import assert from 'node:assert/strict';
import { BLACK, WHITE, SIZE, createGame, placeStone, replayMoves, undoMoves, undoCount, chooseMove, coordinate } from '../src/gomoku.js';

function playSequence(points) {
  return points.reduce((game, [row, col]) => {
    const next = placeStone(game, row, col);
    assert.ok(next, `Expected a legal move at ${row},${col}`);
    return next;
  }, createGame());
}

test('black starts; legal moves alternate without mutating earlier game state', () => {
  const initial = createGame();
  const next = placeStone(initial, 7, 7);
  assert.equal(next.board[112], BLACK);
  assert.equal(next.turn, WHITE);
  assert.equal(initial.board[112], 0);
  assert.equal(initial.moves.length, 0);
  assert.equal(placeStone(next, 7, 7), null);
  for (const [row, col] of [[-1, 0], [0, 15], [15, 0], [1.5, 2], [NaN, 0], ['1', 1]]) {
    assert.equal(placeStone(next, row, col), null);
  }
});

for (const [name, points] of [
  ['horizontal at edge', [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]]],
  ['vertical at edge', [[0, 14], [1, 14], [2, 14], [3, 14], [4, 14]]],
  ['descending diagonal', [[3, 3], [4, 4], [5, 5], [6, 6], [7, 7]]],
  ['ascending diagonal', [[14, 0], [13, 1], [12, 2], [11, 3], [10, 4]]],
]) {
  test(`detects ${name} win and rejects subsequent moves`, () => {
    const sequence = points.flatMap((point, index) => index < 4 ? [point, [8, index * 2]] : [point]);
    const game = playSequence(sequence);
    assert.equal(game.winner, BLACK);
    assert.equal(game.winningLine.length, 5);
    assert.equal(placeStone(game, 10, 10), null);
    assert.equal(game.draw, false);
    const undone = undoMoves(game);
    assert.equal(undone.winner, 0);
    assert.deepEqual(undone.winningLine, []);
    assert.equal(undone.turn, BLACK);
  });
}

test('white wins and a six-stone overline also wins in freestyle rules', () => {
  const white = playSequence([[0, 0], [7, 3], [0, 2], [7, 4], [0, 4], [7, 5], [0, 6], [7, 6], [0, 8], [7, 7]]);
  assert.equal(white.winner, WHITE);
  const overline = playSequence([[7, 3], [0, 0], [7, 4], [0, 2], [7, 5], [0, 4], [7, 7], [0, 6], [7, 8], [0, 8], [7, 6]]);
  assert.equal(overline.winner, BLACK);
  assert.equal(overline.winningLine.length, 6);
});

test('gaps and row wraparound are not five in a row', () => {
  const gap = playSequence([[7, 2], [0, 0], [7, 3], [0, 2], [7, 5], [0, 4], [7, 6], [0, 6], [7, 7]]);
  assert.equal(gap.winner, 0);
  const wrap = playSequence([[0, 13], [10, 0], [0, 14], [10, 2], [1, 0], [10, 4], [1, 1], [10, 6], [1, 2]]);
  assert.equal(wrap.winner, 0);
});

test('a full board with no five is a draw', () => {
  const black = [];
  const white = [];
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      ((row + 2 * col) % 4 < 2 ? black : white).push([row, col]);
    }
  }
  const sequence = black.flatMap((move, index) => white[index] ? [move, white[index]] : [move]);
  const game = playSequence(sequence);
  assert.equal(game.moves.length, 225);
  assert.equal(game.draw, true);
  assert.equal(game.winner, 0);
  assert.equal(chooseMove(game), null);
});

test('undo in AI mode returns to the human turn, including pending AI and human-white openings', () => {
  const one = playSequence([[7, 7]]);
  assert.equal(undoCount(one, BLACK), 1);
  assert.equal(undoCount(one, WHITE), 0);
  const two = placeStone(one, 6, 6);
  assert.equal(undoCount(two, BLACK), 2);
  assert.equal(undoCount(two, WHITE), 1);
  const three = placeStone(two, 7, 6);
  assert.equal(undoCount(three, WHITE), 2);
  const undone = undoMoves(three, undoCount(three, WHITE));
  assert.equal(undone.moves.length, 1);
  assert.equal(undone.turn, WHITE);
});

test('saved moves round-trip and malformed or post-win saves are rejected', () => {
  const game = playSequence([[7, 7], [7, 8], [8, 8]]);
  assert.deepEqual(replayMoves(JSON.parse(JSON.stringify(game.moves))), game);
  assert.throws(() => replayMoves(null));
  assert.throws(() => replayMoves([{ row: 7, col: 7, player: WHITE }]));
  assert.throws(() => replayMoves([...game.moves, { row: 7, col: 7, player: WHITE }]));
  const won = playSequence([[0, 0], [3, 0], [0, 1], [3, 2], [0, 2], [3, 4], [0, 3], [3, 6], [0, 4]]);
  assert.throws(() => replayMoves([...won.moves, { row: 9, col: 9, player: WHITE }]));
});

for (const difficulty of ['easy', 'normal', 'hard']) {
  test(`${difficulty} AI opens in the center and plays legal moves without changing state`, () => {
    assert.deepEqual(chooseMove(createGame(), difficulty), { row: 7, col: 7 });
    const game = playSequence([[7, 7], [7, 8], [6, 6]]);
    const original = structuredClone(game);
    const choice = chooseMove(game, difficulty, () => .9);
    assert.ok(placeStone(game, choice.row, choice.col));
    assert.deepEqual(game, original);
  });

  test(`${difficulty} AI blocks an immediate win and takes its own win first`, () => {
    const threat = playSequence([[7, 0], [0, 0], [7, 1], [0, 2], [7, 2], [0, 4], [7, 3]]);
    assert.deepEqual(chooseMove(threat, difficulty), { row: 7, col: 4 });
    const win = playSequence([[7, 0], [3, 0], [7, 1], [3, 1], [7, 2], [3, 2], [7, 3], [3, 3], [13, 13]]);
    assert.deepEqual(chooseMove(win, difficulty), { row: 3, col: 4 });
  });
}

test('coordinates match the visible board labels', () => {
  assert.equal(coordinate(0, 0), 'A15');
  assert.equal(coordinate(7, 7), 'H8');
  assert.equal(coordinate(14, 14), 'O1');
});
