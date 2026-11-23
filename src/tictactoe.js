export const WIN_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
export function ticResult(board) {
  const line = WIN_LINES.find(cells => board[cells[0]] && cells.every(i => board[i] === board[cells[0]]));
  return { winner: line ? board[line[0]] : '', line: line || [], draw: !line && board.every(Boolean) };
}
export function createTic() { return { board: Array(9).fill(''), turn: 'X', wait: 0, status: 'playing', winner: '', line: [] }; }
function placeTic(game, index, player) {
  const board = [...game.board]; board[index] = player;
  const result = ticResult(board);
  return { ...game, board, ...result, turn: player === 'X' ? 'O' : 'X', wait: player === 'X' ? 360 : 0, status: result.winner ? (result.winner === 'X' ? 'won' : 'lost') : result.draw ? 'draw' : 'playing' };
}
export function playTic(game, index) {
  return game.status === 'playing' && game.turn === 'X' && index >= 0 && index < 9 && !game.board[index] ? placeTic(game, index, 'X') : game;
}
export function chooseTicMove(board) {
  function score(position, player, depth) {
    const result = ticResult(position);
    if (result.winner) return result.winner === 'O' ? 10 - depth : depth - 10;
    if (result.draw) return 0;
    const scores = position.flatMap((cell, i) => {
      if (cell) return [];
      const next = [...position]; next[i] = player;
      return [score(next, player === 'O' ? 'X' : 'O', depth + 1)];
    });
    return player === 'O' ? Math.max(...scores) : Math.min(...scores);
  }
  let best = -Infinity, chosen = -1;
  for (const index of [4, 0, 2, 6, 8, 1, 3, 5, 7]) if (!board[index]) {
    const next = [...board]; next[index] = 'O';
    const value = score(next, 'X', 0);
    if (value > best) { best = value; chosen = index; }
  }
  return chosen;
}
export function tickTic(game, ms) {
  if (game.status !== 'playing' || game.turn !== 'O') return game;
  const wait = Math.max(0, game.wait - ms);
  if (wait) return { ...game, wait };
  const index = chooseTicMove(game.board);
  return index < 0 ? game : placeTic(game, index, 'O');
}
