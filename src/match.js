export const MATCH_SIZE = 7;
export const MATCH_GOAL = 900;
export const MATCH_SYMBOLS = ['', '◆', '●', '▲', '✦', '■', '⬟'];
export function matchGroups(board, size = MATCH_SIZE) {
  const found = new Set();
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    const index = row * size + col, value = board[index]; if (!value) continue;
    if (col <= size - 3 && board[index + 1] === value && board[index + 2] === value) {
      for (let x = col; x < size && board[row * size + x] === value; x++) found.add(row * size + x);
    }
    if (row <= size - 3 && board[index + size] === value && board[index + size * 2] === value) {
      for (let y = row; y < size && board[y * size + col] === value; y++) found.add(y * size + col);
    }
  }
  return [...found];
}
function adjacent(a, b, size) { return Math.abs(a % size - b % size) + Math.abs(Math.floor(a / size) - Math.floor(b / size)) === 1; }
export function findMatchMove(board, size = MATCH_SIZE) {
  for (let a = 0; a < board.length; a++) for (const b of [a + 1, a + size]) {
    if (b >= board.length || !adjacent(a, b, size) || board[a] === board[b]) continue;
    const next = [...board]; [next[a], next[b]] = [next[b], next[a]];
    if (matchGroups(next, size).length) return [a, b];
  }
  return null;
}
function fillHoles(board, random, size) {
  const next = [...board];
  for (let index = 0; index < next.length; index++) if (!next[index]) {
    const choices = [];
    for (let value = 1; value <= 6; value++) {
      next[index] = value;
      if (!matchGroups(next, size).includes(index)) choices.push(value);
    }
    next[index] = choices[Math.floor(random() * choices.length)];
  }
  return next;
}
function freshBoard(random) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const board = fillHoles(Array(49).fill(0), random, MATCH_SIZE);
    if (findMatchMove(board)) return board;
  }
  const board = Array.from({ length: 49 }, (_, index) => (Math.floor(index / 7) * 2 + index % 7) % 6 + 1);
  board[0] = 1; board[1] = 2; board[2] = 1; board[8] = 1;
  return board;
}
export function createMatch(random = Math.random) {
  return { board: freshBoard(random), selected: -1, hint: [], score: 0, moves: 25, cascades: 0, shuffles: 0, notice: '', status: 'playing' };
}
export function resolveMatch(board, random = Math.random, size = MATCH_SIZE) {
  let next = [...board], removed = 0, cascades = 0, matches = matchGroups(next, size);
  while (matches.length) {
    removed += matches.length; cascades++;
    for (const index of matches) next[index] = 0;
    for (let col = 0; col < size; col++) {
      const values = Array.from({ length: size }, (_, row) => next[row * size + col]).filter(Boolean);
      for (let row = size - 1; row >= 0; row--) next[row * size + col] = values.pop() || 0;
    }
    // Refill avoids creating triples itself; gravity can still form cascades.
    next = fillHoles(next, random, size); matches = matchGroups(next, size);
  }
  return { board: next, removed, cascades };
}
export function swapMatch(game, a, b, random = Math.random) {
  if (game.status !== 'playing' || !Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= 49 || b >= 49 || !adjacent(a, b, 7)) return game;
  const board = [...game.board]; [board[a], board[b]] = [board[b], board[a]];
  if (!matchGroups(board).length) return { ...game, selected: -1, hint: [], notice: '没有组成三连，已换回，不扣步数。' };
  const resolved = resolveMatch(board, random), score = game.score + resolved.removed * 10, moves = game.moves - 1;
  let next = { ...game, board: resolved.board, selected: -1, hint: [], score, moves, cascades: resolved.cascades, notice: resolved.cascades > 1 ? `${resolved.cascades} 次连锁，收获 ${resolved.removed * 10} 分！` : `消除 ${resolved.removed} 颗，收获 ${resolved.removed * 10} 分。`, status: score >= MATCH_GOAL ? 'won' : moves <= 0 ? 'lost' : 'playing' };
  if (next.status === 'playing' && !findMatchMove(next.board)) next = { ...next, board: freshBoard(random), shuffles: next.shuffles + 1, notice: '没有可交换的三连，已自动重排，不扣步数。' };
  return next;
}
export function chooseMatch(game, index, random = Math.random) {
  if (game.status !== 'playing' || !Number.isInteger(index) || index < 0 || index >= 49) return game;
  if (game.selected === index) return { ...game, selected: -1, hint: [], notice: '' };
  if (game.selected >= 0 && adjacent(game.selected, index, 7)) return swapMatch(game, game.selected, index, random);
  return { ...game, selected: index, hint: [], notice: '再选一颗相邻宝石，交换它们。' };
}
export function hintMatch(game) { return game.status === 'playing' ? { ...game, hint: findMatchMove(game.board) || [], notice: '描边的两颗可以交换成三连。' } : game; }
