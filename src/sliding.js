export const SLIDING_GOAL = [...Array.from({ length: 15 }, (_, i) => i + 1), 0];
export function slidingNeighbors(index) {
  return [index % 4 ? index - 1 : -1, index % 4 < 3 ? index + 1 : -1, index >= 4 ? index - 4 : -1, index < 12 ? index + 4 : -1].filter(value => value >= 0);
}
export function isSlidingSolved(board) { return board.every((value, index) => value === SLIDING_GOAL[index]); }
export function isSlidingSolvable(board) {
  if (board.length !== 16 || new Set(board).size !== 16 || board.some(value => !Number.isInteger(value) || value < 0 || value > 15)) return false;
  let inversions = 0;
  for (let a = 0; a < 16; a++) for (let b = a + 1; b < 16; b++) if (board[a] && board[b] && board[a] > board[b]) inversions++;
  return (inversions + 4 - Math.floor(board.indexOf(0) / 4)) % 2 === 1;
}
export function createSliding(random = Math.random) {
  const board = [...SLIDING_GOAL]; let empty = 15, previous = -1;
  for (let step = 0; step < 140; step++) {
    const options = slidingNeighbors(empty).filter(index => index !== previous), target = options[Math.floor(random() * options.length)];
    [board[empty], board[target]] = [board[target], board[empty]]; previous = empty; empty = target;
  }
  if (isSlidingSolved(board)) [board[14], board[15]] = [board[15], board[14]];
  return { board, moves: 0, history: [], status: 'playing' };
}
export function moveSliding(game, index) {
  if (game.status !== 'playing' || !slidingNeighbors(game.board.indexOf(0)).includes(index)) return game;
  const board = [...game.board], empty = board.indexOf(0);
  [board[index], board[empty]] = [board[empty], board[index]];
  return { ...game, board, moves: game.moves + 1, history: [...game.history, game.board], status: isSlidingSolved(board) ? 'won' : 'playing' };
}
export function undoSliding(game) {
  if (!game.history.length) return game;
  return { ...game, board: game.history.at(-1), moves: game.moves - 1, history: game.history.slice(0, -1), status: 'playing' };
}
