// 2048: each tile can merge only once during a move.
export function spawnTile(board, random = Math.random) {
  const empty = board.flatMap((value, index) => value ? [] : [index]);
  if (!empty.length) return board;
  const next = [...board];
  next[empty[Math.floor(random() * empty.length)]] = random() < .9 ? 2 : 4;
  return next;
}
export function createMerge(random = Math.random) {
  return { board: spawnTile(spawnTile(Array(16).fill(0), random), random), score: 0, moves: 0, status: 'playing', reached: false, previous: null };
}
export function canMergeMove(board) {
  return board.some((value, i) => !value || (i % 4 < 3 && value === board[i + 1]) || (i < 12 && value === board[i + 4]));
}
export function moveMerge(game, direction, random = Math.random) {
  if (game.status !== 'playing' || !['left', 'right', 'up', 'down'].includes(direction)) return game;
  const board = [...game.board];
  let earned = 0;
  for (let line = 0; line < 4; line++) {
    const indices = Array.from({ length: 4 }, (_, cell) => direction === 'left' ? line * 4 + cell : direction === 'right' ? line * 4 + 3 - cell : direction === 'up' ? cell * 4 + line : (3 - cell) * 4 + line);
    const values = indices.map(index => board[index]).filter(Boolean);
    const merged = [];
    for (let i = 0; i < values.length; i++) {
      if (values[i] === values[i + 1]) { merged.push(values[i] * 2); earned += values[i] * 2; i++; }
      else merged.push(values[i]);
    }
    indices.forEach((index, cell) => { board[index] = merged[cell] || 0; });
  }
  if (board.every((value, index) => value === game.board[index])) return game;
  const spawned = spawnTile(board, random);
  return { board: spawned, score: game.score + earned, moves: game.moves + 1, status: canMergeMove(spawned) ? 'playing' : 'lost', reached: game.reached || spawned.some(value => value >= 2048), previous: { ...game, previous: null } };
}
export function undoMerge(game) { return game.previous ? { ...game.previous, previous: null } : game; }
