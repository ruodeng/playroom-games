export const TETRIS_WIDTH = 10;
export const TETRIS_HEIGHT = 20;
export const PIECE_TYPES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
const SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
};
const CLEAR_POINTS = [0, 100, 300, 500, 800];

export function shuffledBag(random = Math.random) {
  const bag = [...PIECE_TYPES];
  for (let index = bag.length - 1; index > 0; index--) {
    const swap = Math.min(index, Math.max(0, Math.floor(random() * (index + 1))));
    [bag[index], bag[swap]] = [bag[swap], bag[index]];
  }
  return bag;
}

export function pieceCells(piece) {
  let matrix = SHAPES[piece.type];
  for (let turn = 0; turn < piece.rotation; turn++) {
    matrix = matrix[0].map((_, col) => matrix.map(row => row[col]).reverse());
  }
  return matrix.flatMap((row, y) => row.flatMap((value, x) => value ? [{ x: piece.x + x, y: piece.y + y }] : []));
}

export function fits(board, piece) {
  return pieceCells(piece).every(({ x, y }) => x >= 0 && x < TETRIS_WIDTH && y < TETRIS_HEIGHT && (y < 0 || !board[y][x]));
}

function nextPiece(queue, random) {
  const next = [...queue];
  if (next.length < 7) next.push(...shuffledBag(random));
  const type = next.shift();
  return { current: { type, rotation: 0, x: type === 'O' ? 4 : 3, y: 0 }, queue: next };
}

export function createTetrisGame(random = Math.random) {
  return {
    board: Array.from({ length: TETRIS_HEIGHT }, () => Array(TETRIS_WIDTH).fill('')),
    ...nextPiece([], random), score: 0, lines: 0, level: 1, pieces: 0, lastClear: 0, status: 'ready',
  };
}

export function startTetris(game) {
  return ['ready', 'paused'].includes(game.status) ? { ...game, status: 'running' } : game;
}

export function pauseTetris(game) {
  return game.status === 'running' ? { ...game, status: 'paused' } : game;
}

export function fallInterval(level) {
  return Math.max(120, 850 - (level - 1) * 70);
}

export function moveTetris(game, dx) {
  if (game.status !== 'running' || ![-1, 1].includes(dx)) return game;
  const current = { ...game.current, x: game.current.x + dx };
  return fits(game.board, current) ? { ...game, current } : game;
}

export function rotateTetris(game, direction = 1) {
  if (game.status !== 'running' || game.current.type === 'O' || ![-1, 1].includes(direction)) return game;
  const rotation = (game.current.rotation + direction + 4) % 4;
  // Small wall/floor offsets keep casual play forgiving without moving through blocks.
  for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1], [0, -2]]) {
    const current = { ...game.current, rotation, x: game.current.x + dx, y: game.current.y + dy };
    if (fits(game.board, current)) return { ...game, current };
  }
  return game;
}

export function landingPiece(game) {
  if (!game.current) return null;
  let current = { ...game.current };
  while (fits(game.board, { ...current, y: current.y + 1 })) current.y++;
  return current;
}

function lockPiece(game, random) {
  const cells = pieceCells(game.current);
  if (cells.some(cell => cell.y < 0)) return { ...game, current: null, status: 'over' };
  let board = game.board.map(row => [...row]);
  for (const { x, y } of cells) board[y][x] = game.current.type;
  board = board.filter(row => !row.every(Boolean));
  const cleared = TETRIS_HEIGHT - board.length;
  board = [...Array.from({ length: cleared }, () => Array(TETRIS_WIDTH).fill('')), ...board];
  const next = nextPiece(game.queue, random);
  const blocked = !fits(board, next.current);
  const lines = game.lines + cleared;
  return {
    ...game, ...next, board, current: blocked ? null : next.current,
    score: game.score + CLEAR_POINTS[cleared] * game.level,
    lines, level: 1 + Math.floor(lines / 10), pieces: game.pieces + 1,
    lastClear: cleared, status: blocked ? 'over' : 'running',
  };
}

export function stepTetris(game, random = Math.random, softDrop = false) {
  if (game.status !== 'running') return game;
  const current = { ...game.current, y: game.current.y + 1 };
  return fits(game.board, current)
    ? { ...game, current, score: game.score + (softDrop ? 1 : 0) }
    : lockPiece(game, random);
}

export function hardDropTetris(game, random = Math.random) {
  if (game.status !== 'running') return game;
  const current = landingPiece(game);
  return lockPiece({ ...game, current, score: game.score + (current.y - game.current.y) * 2 }, random);
}
