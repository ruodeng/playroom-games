export function lightNeighbors(index) {
  const result = [index];
  if (index >= 5) result.push(index - 5);
  if (index < 20) result.push(index + 5);
  if (index % 5) result.push(index - 1);
  if (index % 5 < 4) result.push(index + 1);
  return result;
}
function flip(board, index) {
  const next = [...board];
  for (const cell of lightNeighbors(index)) next[cell] = !next[cell];
  return next;
}
export function createLights(random = Math.random) {
  const indices = Array.from({ length: 25 }, (_, i) => i);
  for (let i = 24; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [indices[i], indices[j]] = [indices[j], indices[i]]; }
  let board = Array(25).fill(false);
  for (const index of indices.slice(0, 9)) board = flip(board, index);
  if (!board.some(Boolean)) board = flip(board, 12);
  return { board, moves: 0, status: 'playing' };
}
export function toggleLight(game, index) {
  if (game.status !== 'playing' || index < 0 || index >= 25) return game;
  const board = flip(game.board, index);
  return { board, moves: game.moves + 1, status: board.some(Boolean) ? 'playing' : 'won' };
}
export function solveLights(board) {
  // Solve the toggle equations over GF(2); free variables stay zero.
  const rows = board.map((value, i) => [...Array.from({ length: 25 }, (_, j) => Number(lightNeighbors(j).includes(i))), Number(value)]);
  const pivots = [];
  let rank = 0;
  for (let col = 0; col < 25; col++) {
    const pivot = rows.findIndex((row, index) => index >= rank && row[col]);
    if (pivot < 0) continue;
    [rows[rank], rows[pivot]] = [rows[pivot], rows[rank]];
    for (let row = 0; row < 25; row++) if (row !== rank && rows[row][col]) {
      for (let k = col; k <= 25; k++) rows[row][k] ^= rows[rank][k];
    }
    pivots.push(col); rank++;
  }
  if (rows.some(row => row.slice(0, 25).every(value => !value) && row[25])) return null;
  return pivots.filter((_, i) => rows[i][25]);
}
