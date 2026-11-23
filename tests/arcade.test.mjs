import test from 'node:test';
import assert from 'node:assert/strict';
import { createMerge, moveMerge, undoMerge, canMergeMove } from '../src/merge.js';
import { createMines, revealMine, flagMine, neighbors } from '../src/mines.js';
import { createSudoku, countSudokuSolutions, sudokuConflicts, writeSudoku, hintSudoku } from '../src/sudoku.js';
import { createMemory, flipMemory, tickMemory } from '../src/memory.js';
import { createBreakout, steerBreakout, launchBreakout, stepBreakout } from '../src/breakout.js';
import { createTic, playTic, tickTic, chooseTicMove } from '../src/tictactoe.js';
import { createLights, toggleLight, solveLights } from '../src/lights.js';
import { createMoles, hitMole, tickMoles } from '../src/moles.js';

function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
const zero = () => 0;

test('2048 begins with two tiles and merges each tile only once', () => {
  assert.equal(createMerge(zero).board.filter(Boolean).length, 2);
  const game = { ...createMerge(zero), board: [2, 2, 4, 4, ...Array(12).fill(0)] };
  const snapshot = structuredClone(game);
  const next = moveMerge(game, 'left', zero);
  assert.deepEqual(next.board.slice(0, 4), [4, 8, 2, 0]);
  assert.equal(next.score, 12);
  assert.equal(next.moves, 1);
  assert.deepEqual(game, snapshot);
  assert.deepEqual(undoMerge(next), snapshot);
});
test('2048 handles all four directions and refuses an unchanged move', () => {
  for (const [direction, expected] of [['left', 0], ['right', 3], ['up', 0], ['down', 12]]) {
    const board = Array(16).fill(0); board[0] = 2; board[direction === 'up' || direction === 'down' ? 4 : 1] = 2;
    assert.equal(moveMerge({ ...createMerge(zero), board }, direction, zero).board[expected], 4);
  }
  const game = { ...createMerge(zero), board: [2, ...Array(15).fill(0)] };
  assert.equal(moveMerge(game, 'left', zero), game);
});
test('2048 detects a full unmergeable board and allows play beyond 2048', () => {
  assert.equal(canMergeMove([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2]), false);
  const game = { ...createMerge(zero), board: [1024, 1024, ...Array(14).fill(0)] };
  const next = moveMerge(game, 'left', zero);
  assert.equal(next.reached, true); assert.equal(next.status, 'playing'); assert.equal(next.score, 2048);
});

test('mines first reveal protects the selected cell and all its neighbors', () => {
  for (const first of [0, 8, 40, 72, 80]) {
    const game = revealMine(createMines(), first, seeded(first + 1));
    assert.equal(game.mines.length, 10); assert.equal(new Set(game.mines).size, 10);
    assert.ok([first, ...neighbors(first)].every(i => !game.mines.includes(i)));
    assert.equal(game.counts[first], 0); assert.equal(game.revealed[first], true); assert.equal(game.status, 'playing');
  }
});
test('mines flags block reveals, are limited, and do not start the game', () => {
  let game = createMines();
  for (let i = 0; i < 10; i++) game = flagMine(game, i);
  assert.equal(flagMine(game, 10), game); assert.equal(revealMine(game, 0), game); assert.equal(game.started, false);
  game = flagMine(game, 0); assert.equal(game.flags[0], false);
});
test('mines correctly wins after all safe cells and loses on a mine', () => {
  const initial = revealMine(createMines(), 40, seeded(5));
  let game = initial;
  for (let i = 0; i < 81; i++) if (!game.mines.includes(i) && !game.revealed[i]) game = revealMine(game, i);
  assert.equal(game.status, 'won'); assert.equal(game.revealed.filter(Boolean).length, 71);
  const lost = revealMine(initial, initial.mines[0]); assert.equal(lost.status, 'lost'); assert.equal(lost.exploded, initial.mines[0]);
  assert.equal(revealMine(lost, 0), lost); assert.equal(flagMine(lost, 0), lost);
});
test('mines numbered-cell expansion honors flags and can expose a wrong flag', () => {
  let game = revealMine(createMines(), 40, seeded(31));
  const cell = game.revealed.findIndex((visible, i) => visible && game.counts[i] && neighbors(i).some(n => !game.revealed[n] && !game.mines.includes(n)));
  assert.ok(cell >= 0);
  const adjacent = neighbors(cell);
  for (const mine of adjacent.filter(i => game.mines.includes(i))) game = flagMine(game, mine);
  const expanded = revealMine(game, cell); assert.notEqual(expanded.status, 'lost');
  assert.ok(adjacent.filter(i => !game.mines.includes(i)).every(i => expanded.revealed[i]));
  const mine = adjacent.find(i => game.mines.includes(i)), safe = adjacent.find(i => !game.revealed[i] && !game.mines.includes(i));
  game = flagMine(flagMine(game, mine), safe);
  assert.equal(revealMine(game, cell).status, 'lost');
});

test('sudoku creates distinct valid puzzles with exactly one solution', () => {
  const puzzles = [1, 4, 19].map(seed => createSudoku(seeded(seed)));
  for (const game of puzzles) {
    assert.equal(countSudokuSolutions(game.board), 1);
    assert.equal(sudokuConflicts(game.solution).length, 0);
    assert.equal(game.board.filter(value => !value).length, 42);
    assert.ok(game.board.every((value, i) => !value || value === game.solution[i]));
  }
  assert.notDeepEqual(puzzles[0].board, puzzles[1].board);
});
test('sudoku protects givens, toggles notes, erases input and reports conflicts', () => {
  const game = createSudoku(seeded(9)), blank = game.board.findIndex(value => !value), given = game.givens.findIndex(Boolean);
  assert.equal(writeSudoku(game, given, 1), game);
  let next = writeSudoku(game, blank, 3, true); assert.equal(next.board[blank], 0); assert.equal(next.notes[blank], 1 << 3);
  next = writeSudoku(next, blank, 3, true); assert.equal(next.notes[blank], 0);
  next = writeSudoku(next, blank, 4); assert.equal(next.board[blank], 4);
  next = writeSudoku(next, blank, 0); assert.equal(next.board[blank], 0);
  const duplicate = Array(81).fill(0); duplicate[0] = duplicate[8] = 5;
  assert.deepEqual(sudokuConflicts(duplicate), [0, 8]);
});
test('sudoku hints are limited and the final correct value completes the puzzle', () => {
  let game = createSudoku(seeded(27));
  for (let k = 0; k < 3; k++) game = hintSudoku(game, game.board.findIndex(value => !value));
  assert.equal(game.hints, 0); assert.equal(hintSudoku(game, game.board.findIndex(value => !value)), game);
  for (let i = 0; i < 81; i++) if (!game.givens[i]) game = writeSudoku(game, i, game.solution[i]);
  assert.equal(game.status, 'won'); assert.equal(writeSudoku(game, 0, 0), game);
});

test('memory has eight pairs, ignores repeated flips and hides mismatches after the delay', () => {
  let game = createMemory(seeded(3));
  for (let i = 0; i < 8; i++) assert.equal(game.deck.filter(value => value === i).length, 2);
  game = flipMemory(game, 0); assert.equal(flipMemory(game, 0), game);
  const different = game.deck.findIndex(value => value !== game.deck[0]);
  game = flipMemory(game, different); assert.equal(game.moves, 1); assert.equal(game.open.length, 2);
  assert.equal(flipMemory(game, 15), game);
  game = tickMemory(game, 799); assert.equal(game.open.length, 2);
  game = tickMemory(game, 1); assert.deepEqual(game.open, []);
});
test('memory retains matched pairs and completes in eight perfect attempts', () => {
  let game = createMemory(seeded(12));
  for (let pair = 0; pair < 8; pair++) {
    const indices = game.deck.flatMap((value, i) => value === pair ? [i] : []);
    for (const index of indices) game = flipMemory(game, index);
    assert.equal(flipMemory(game, indices[0]), game);
  }
  assert.equal(game.status, 'won'); assert.equal(game.moves, 8); assert.equal(game.matched.length, 16);
});

test('breakout paddle stays in bounds and the ball waits for a serve', () => {
  const game = createBreakout();
  assert.equal(steerBreakout(game, -100).paddle, 0); assert.equal(steerBreakout(game, 800).paddle, 324);
  assert.deepEqual(stepBreakout(game, 80).ball, game.ball);
  assert.ok(stepBreakout(launchBreakout(game), 80).ball.y < game.ball.y);
});
test('breakout reflects on walls and paddle while preserving the prior state', () => {
  const wall = { ...createBreakout(), flying: true, ball: { x: 7, y: 250, vx: -200, vy: -100 } };
  const snapshot = structuredClone(wall); assert.ok(stepBreakout(wall, 20).ball.vx > 0); assert.deepEqual(wall, snapshot);
  const paddle = { ...createBreakout(), flying: true, ball: { x: 210, y: 460, vx: 0, vy: 200 } };
  const next = stepBreakout(paddle, 40); assert.ok(next.ball.vy < 0); assert.ok(next.ball.vx > 0);
});
test('breakout destroys a brick, scores once and wins when the last brick breaks', () => {
  const game = { ...createBreakout(), flying: true, ball: { x: 45, y: 176, vx: 0, vy: -250 } };
  const next = stepBreakout(game, 30); assert.equal(next.score, 10); assert.equal(next.bricks[24].alive, false);
  game.bricks = game.bricks.map((brick, i) => ({ ...brick, alive: i === 24 }));
  assert.equal(stepBreakout(game, 30).status, 'won');
});
test('breakout losing a ball uses one life and the last loss ends the game', () => {
  const game = { ...createBreakout(), flying: true, ball: { x: 10, y: 510, vx: 0, vy: 250 } };
  const next = stepBreakout(game, 30); assert.equal(next.lives, 2); assert.equal(next.flying, false);
  const lost = stepBreakout({ ...game, lives: 1 }, 30); assert.equal(lost.status, 'lost'); assert.equal(stepBreakout(lost, 30), lost);
});

test('tic tac toe alternates turns and the computer takes wins or blocks immediate threats', () => {
  let game = playTic(createTic(), 0); assert.equal(game.turn, 'O'); assert.equal(playTic(game, 1), game);
  assert.equal(tickTic(game, 200).turn, 'O'); game = tickTic(game, 400); assert.equal(game.turn, 'X');
  assert.equal(game.board.filter(Boolean).length, 2); assert.equal(playTic(game, 0), game);
  assert.equal(chooseTicMove(['O', 'O', '', 'X', 'X', '', '', '', '']), 2);
  assert.equal(chooseTicMove(['X', 'X', '', '', 'O', '', '', '', '']), 2);
});
test('tic tac toe computer never loses against any legal human sequence', () => {
  function visit(game) {
    assert.notEqual(game.status, 'won');
    if (game.status !== 'playing') return;
    for (let i = 0; i < 9; i++) if (!game.board[i]) {
      const next = playTic(game, i);
      visit(next.status === 'playing' ? tickTic(next, 400) : next);
    }
  }
  visit(createTic());
});

test('lights toggles only orthogonal neighbors and each generated puzzle is solvable', () => {
  const dark = { board: Array(25).fill(false), moves: 0, status: 'playing' };
  assert.deepEqual(toggleLight(dark, 0).board.flatMap((value, i) => value ? [i] : []), [0, 1, 5]);
  for (let seed = 1; seed <= 12; seed++) {
    let game = createLights(seeded(seed)); const snapshot = structuredClone(game);
    const solution = solveLights(game.board); assert.ok(solution?.length);
    assert.deepEqual(game, snapshot);
    for (const index of solution) game = toggleLight(game, index);
    assert.equal(game.status, 'won'); assert.equal(game.board.some(Boolean), false); assert.equal(toggleLight(game, 0), game);
  }
});

test('moles scores hits only once and penalizes empty clicks without a negative score', () => {
  let game = createMoles(zero); assert.equal(game.target, 0);
  assert.equal(hitMole(game, 1).score, 0);
  game = hitMole(game, 0); assert.equal(game.score, 10); assert.equal(game.hits, 1); assert.equal(game.target, -1);
  game = hitMole(game, 0); assert.equal(game.score, 5); assert.equal(game.hits, 1);
});
test('moles expires targets, counts misses, and ends at exactly thirty active seconds', () => {
  let game = createMoles(zero);
  game = tickMoles(game, 900, zero); assert.equal(game.misses, 1); assert.notEqual(game.target, 0);
  game = tickMoles(game, 29099, zero); assert.equal(game.remaining, 1); assert.equal(game.status, 'playing');
  game = tickMoles(game, 1, zero); assert.equal(game.status, 'won'); assert.equal(game.target, -1);
  assert.equal(hitMole(game, 0), game); assert.equal(tickMoles(game, 1000), game);
});
