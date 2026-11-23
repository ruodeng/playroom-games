export const CONNECT_ROWS = 6;
export const CONNECT_COLUMNS = 7;
const ORDER = [3, 2, 4, 1, 5, 0, 6];
export function createConnect() { return { board: Array(42).fill(0), turn: 1, status: 'playing', wait: 0, line: [], moves: 0 }; }
export function connectLanding(board, column) {
  if (!Number.isInteger(column) || column < 0 || column > 6) return -1;
  for (let row = 5; row >= 0; row--) if (!board[row * 7 + column]) return row * 7 + column;
  return -1;
}
export function connectResult(board) {
  for (let row = 0; row < 6; row++) for (let col = 0; col < 7; col++) {
    const start = row * 7 + col, player = board[start];
    if (!player) continue;
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      if (row + 3 * dr >= 6 || col + 3 * dc < 0 || col + 3 * dc >= 7) continue;
      const line = Array.from({ length: 4 }, (_, i) => (row + i * dr) * 7 + col + i * dc);
      if (line.every(index => board[index] === player)) return { winner: player, line };
    }
  }
  return { winner: 0, line: [] };
}
export function moveConnect(game, column, player = 1) {
  if (game.status !== 'playing' || game.turn !== player) return game;
  const index = connectLanding(game.board, column);
  if (index < 0) return game;
  const board = [...game.board]; board[index] = player;
  const result = connectResult(board), moves = game.moves + 1;
  return { ...game, board, line: result.line, moves, turn: 3 - player, wait: player === 1 ? 420 : 0, status: result.winner ? (player === 1 ? 'won' : 'lost') : moves === 42 ? 'draw' : 'playing' };
}
function evaluate(board) {
  let value = 0;
  for (let r = 0; r < 6; r++) value += board[r * 7 + 3] === 2 ? 5 : board[r * 7 + 3] === 1 ? -5 : 0;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    if (r + 3 * dr >= 6 || c + 3 * dc < 0 || c + 3 * dc >= 7) continue;
    const cells = Array.from({ length: 4 }, (_, n) => board[(r + dr * n) * 7 + c + dc * n]);
    const human = cells.filter(x => x === 1).length, ai = cells.filter(x => x === 2).length;
    if (!human) value += [0, 1, 8, 60, 10000][ai];
    if (!ai) value -= [0, 1, 9, 70, 10000][human];
  }
  return value;
}
export function chooseConnectMove(board) {
  function search(position, player, depth, alpha, beta) {
    const winner = connectResult(position).winner;
    if (winner) return winner === 2 ? 100000 + depth : -100000 - depth;
    const options = ORDER.filter(c => connectLanding(position, c) >= 0);
    if (!options.length) return 0;
    if (!depth) return evaluate(position);
    let best = player === 2 ? -Infinity : Infinity;
    for (const column of options) {
      const next = [...position]; next[connectLanding(position, column)] = player;
      const value = search(next, 3 - player, depth - 1, alpha, beta);
      best = player === 2 ? Math.max(best, value) : Math.min(best, value);
      if (player === 2) alpha = Math.max(alpha, best); else beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
  let chosen = -1, best = -Infinity;
  for (const column of ORDER) {
    const index = connectLanding(board, column); if (index < 0) continue;
    const next = [...board]; next[index] = 2;
    const value = search(next, 1, 3, -Infinity, Infinity);
    if (value > best) { best = value; chosen = column; }
  }
  return chosen;
}
export function tickConnect(game, ms) {
  if (game.status !== 'playing' || game.turn !== 2) return game;
  const wait = Math.max(0, game.wait - ms);
  return wait ? { ...game, wait } : moveConnect(game, chooseConnectMove(game.board), 2);
}
