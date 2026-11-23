export function sudokuCandidates(board, index) {
  const row = Math.floor(index / 9), col = index % 9;
  const used = new Set();
  for (let k = 0; k < 9; k++) {
    used.add(board[row * 9 + k]); used.add(board[k * 9 + col]);
    used.add(board[(Math.floor(row / 3) * 3 + Math.floor(k / 3)) * 9 + Math.floor(col / 3) * 3 + k % 3]);
  }
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(value => !used.has(value));
}
export function countSudokuSolutions(input, limit = 2) {
  const board = [...input];
  let count = 0;
  function solve() {
    if (count >= limit) return;
    let index = -1, candidates = [];
    for (let i = 0; i < 81; i++) if (!board[i]) {
      const options = sudokuCandidates(board, i);
      if (!options.length) return;
      if (index < 0 || options.length < candidates.length) { index = i; candidates = options; }
      if (options.length === 1) break;
    }
    if (index < 0) { count++; return; }
    for (const value of candidates) { board[index] = value; solve(); if (count >= limit) break; }
    board[index] = 0;
  }
  solve(); return count;
}
const shuffle = (values, random) => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
};
export function createSudoku(random = Math.random) {
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
  const order = () => shuffle([0, 1, 2], random).flatMap(band => shuffle([0, 1, 2], random).map(row => band * 3 + row));
  const rows = order(), cols = order();
  const solution = rows.flatMap(row => cols.map(col => digits[(row * 3 + Math.floor(row / 3) + col) % 9]));
  const board = [...solution];
  let removed = 0;
  for (const index of shuffle(Array.from({ length: 81 }, (_, i) => i), random)) {
    const old = board[index]; board[index] = 0;
    if (countSudokuSolutions(board) !== 1) board[index] = old;
    else removed++;
    if (removed === 42) break;
  }
  return { board, solution, givens: board.map(Boolean), notes: Array(81).fill(0), moves: 0, hints: 3, status: 'playing' };
}
export function sudokuConflicts(board) {
  return board.flatMap((value, i) => {
    if (!value) return [];
    const without = [...board]; without[i] = 0;
    return sudokuCandidates(without, i).includes(value) ? [] : [i];
  });
}
export function writeSudoku(game, index, value, note = false) {
  if (game.status !== 'playing' || index < 0 || index >= 81 || game.givens[index] || !Number.isInteger(value) || value < 0 || value > 9) return game;
  const board = [...game.board], notes = [...game.notes];
  if (note && value && !board[index]) notes[index] ^= 1 << value;
  else { if (board[index] === value && !notes[index]) return game; board[index] = value; notes[index] = 0; }
  return { ...game, board, notes, moves: game.moves + 1, status: board.every((digit, i) => digit === game.solution[i]) ? 'won' : 'playing' };
}
export function hintSudoku(game, index) {
  if (!game.hints || game.status !== 'playing' || game.givens[index] || game.board[index] === game.solution[index]) return game;
  const next = writeSudoku(game, index, game.solution[index]);
  return next === game ? game : { ...next, hints: game.hints - 1 };
}
