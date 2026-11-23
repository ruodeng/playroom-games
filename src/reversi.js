const DIRECTIONS = [-1, 0, 1].flatMap(r => [-1, 0, 1].filter(c => r || c).map(c => [r, c]));
export function createReversi() {
  const board = Array(64).fill(0); board[27] = board[36] = 2; board[28] = board[35] = 1;
  return { board, turn: 1, status: 'playing', wait: 0, moves: 0, passed: 0, last: -1 };
}
export function reversiFlips(board, index, player) {
  if (!Number.isInteger(index) || index < 0 || index >= 64 || board[index]) return [];
  const flips = [], row = Math.floor(index / 8), col = index % 8;
  for (const [dr, dc] of DIRECTIONS) {
    const line = []; let r = row + dr, c = col + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === 3 - player) { line.push(r * 8 + c); r += dr; c += dc; }
    if (line.length && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === player) flips.push(...line);
  }
  return flips;
}
export function reversiMoves(board, player) { return board.flatMap((_, index) => reversiFlips(board, index, player).length ? [index] : []); }
export function reversiScore(board) { return [board.filter(x => x === 1).length, board.filter(x => x === 2).length]; }
export function moveReversi(game, index, player = 1) {
  if (game.status !== 'playing' || game.turn !== player) return game;
  const flips = reversiFlips(game.board, index, player); if (!flips.length) return game;
  const board = [...game.board]; for (const cell of [index, ...flips]) board[cell] = player;
  const opponent = 3 - player, opponentMoves = reversiMoves(board, opponent), ownMoves = reversiMoves(board, player);
  const finished = !opponentMoves.length && !ownMoves.length, turn = opponentMoves.length ? opponent : player;
  const [human, ai] = reversiScore(board);
  return { ...game, board, turn, moves: game.moves + 1, last: index, passed: !opponentMoves.length && !finished ? opponent : 0, wait: turn === 2 ? 430 : 0, status: finished ? human > ai ? 'won' : human < ai ? 'lost' : 'draw' : 'playing' };
}
export function chooseReversiMove(board, player = 2) {
  const corners = [0, 7, 56, 63], near = [[1, 8, 9], [6, 14, 15], [48, 49, 57], [54, 55, 62]];
  let best = -Infinity, choice = -1;
  for (const index of reversiMoves(board, player)) {
    const flips = reversiFlips(board, index, player), next = [...board];
    for (const cell of [index, ...flips]) next[cell] = player;
    const remaining = next.filter(x => !x).length;
    let score = flips.length * (remaining < 14 ? 10 : 1) - reversiMoves(next, 3 - player).length * 6 + reversiMoves(next, player).length * 2;
    if (corners.includes(index)) score += 1000;
    near.forEach((cells, i) => { if (!board[corners[i]] && cells.includes(index)) score -= 180; });
    if (index < 8 || index > 55 || index % 8 === 0 || index % 8 === 7) score += 10;
    if (score > best) { best = score; choice = index; }
  }
  return choice;
}
export function tickReversi(game, ms) {
  if (game.status !== 'playing' || game.turn !== 2) return game;
  const wait = Math.max(0, game.wait - ms);
  return wait ? { ...game, wait } : moveReversi(game, chooseReversiMove(game.board), 2);
}
