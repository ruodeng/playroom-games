export const LINKUP_COLUMNS = 8;
export const LINKUP_ROWS = 6;
export const LINKUP_SYMBOLS = ['', '叶', '花', '月', '星', '山', '云', '雨', '果'];

// Search the empty outer border too; direction is part of the search state.
export function linkupPath(board, from, to, columns = LINKUP_COLUMNS, rows = LINKUP_ROWS) {
  if (from === to || !board[from] || board[from] !== board[to]) return null;
  const width = columns + 2, height = rows + 2;
  const point = index => [index % columns + 1, Math.floor(index / columns) + 1];
  const [sx, sy] = point(from), [tx, ty] = point(to);
  const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const queue = [{ x: sx, y: sy, direction: -1, turns: 0, path: [[sx, sy]] }], best = new Map();
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    for (let direction = 0; direction < 4; direction++) {
      const [dx, dy] = directions[direction], x = current.x + dx, y = current.y + dy;
      const turns = current.turns + Number(current.direction !== -1 && direction !== current.direction);
      if (turns > 2 || x < 0 || x >= width || y < 0 || y >= height) continue;
      const path = [...current.path, [x, y]];
      if (x === tx && y === ty) return path;
      if (x > 0 && x <= columns && y > 0 && y <= rows && board[(y - 1) * columns + x - 1]) continue;
      const key = `${x},${y},${direction}`;
      if ((best.get(key) ?? 3) <= turns) continue;
      best.set(key, turns); queue.push({ x, y, direction, turns, path });
    }
  }
  return null;
}
export function findLinkupPair(board, columns = LINKUP_COLUMNS, rows = LINKUP_ROWS) {
  for (let a = 0; a < board.length; a++) if (board[a]) {
    for (let b = a + 1; b < board.length; b++) if (board[a] === board[b] && linkupPath(board, a, b, columns, rows)) return [a, b];
  }
  return null;
}
function shuffled(board, random) {
  const values = board.filter(Boolean);
  for (let i = values.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [values[i], values[j]] = [values[j], values[i]]; }
  let index = 0;
  return board.map(value => value ? values[index++] : 0);
}
function playableBoard(board, random) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const next = shuffled(board, random);
    if (findLinkupPair(next)) return next;
  }
  // Any closest occupied pair has a clear route. Put equal tiles there as a
  // bounded fallback, including when an injected RNG always returns zero.
  const next = [...board], occupied = board.flatMap((value, index) => value ? [index] : []);
  for (const a of occupied) for (const b of occupied) if (a < b) {
    const probe = [...next]; probe[b] = probe[a];
    if (!linkupPath(probe, a, b)) continue;
    const mate = occupied.find(index => index !== a && next[index] === next[a]);
    [next[b], next[mate]] = [next[mate], next[b]]; return next;
  }
  return next;
}
export function createLinkup(random = Math.random) {
  const board = Array.from({ length: 48 }, (_, i) => Math.floor(i / 2) % 8 + 1);
  return { board: playableBoard(board, random), selected: -1, hint: [], moves: 0, shuffles: 0, notice: '', status: 'playing' };
}
export function shuffleLinkup(game, random = Math.random) {
  if (game.status !== 'playing') return game;
  return { ...game, board: playableBoard(game.board, random), selected: -1, hint: [], shuffles: game.shuffles + 1, notice: '已重新排列，继续找一对。' };
}
export function hintLinkup(game) {
  if (game.status !== 'playing') return game;
  return { ...game, hint: findLinkupPair(game.board) || [], notice: '描边的两块可以连在一起。' };
}
export function chooseLinkup(game, index, random = Math.random) {
  if (game.status !== 'playing' || !Number.isInteger(index) || !game.board[index]) return game;
  if (game.selected === index) return { ...game, selected: -1, hint: [], notice: '' };
  if (game.selected < 0) return { ...game, selected: index, hint: [], notice: '' };
  if (!linkupPath(game.board, game.selected, index)) return { ...game, selected: index, hint: [], notice: '这两块还连不上，试试另一对。' };
  const board = [...game.board]; board[index] = board[game.selected] = 0;
  let next = { ...game, board, selected: -1, hint: [], moves: game.moves + 1, notice: '找到一对！', status: board.some(Boolean) ? 'playing' : 'won' };
  if (next.status === 'playing' && !findLinkupPair(board)) next = { ...shuffleLinkup(next, random), notice: '暂时没有可连接的图案，已自动重排。' };
  return next;
}
