export const MINE_SIZE = 9;
export const MINE_COUNT = 10;
export function neighbors(index) {
  const row = Math.floor(index / 9), col = index % 9;
  const result = [];
  for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
    if ((x || y) && row + y >= 0 && row + y < 9 && col + x >= 0 && col + x < 9) result.push((row + y) * 9 + col + x);
  }
  return result;
}
export function createMines() {
  return { mines: [], counts: Array(81).fill(0), revealed: Array(81).fill(false), flags: Array(81).fill(false), started: false, status: 'playing', exploded: -1 };
}
function seedMines(game, first, random) {
  const safe = new Set([first, ...neighbors(first)]);
  const candidates = Array.from({ length: 81 }, (_, i) => i).filter(i => !safe.has(i));
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const mines = candidates.slice(0, MINE_COUNT);
  return { ...game, mines, counts: game.counts.map((_, i) => neighbors(i).filter(n => mines.includes(n)).length), started: true };
}
export function flagMine(game, index) {
  if (game.status !== 'playing' || index < 0 || index >= 81 || game.revealed[index]) return game;
  if (!game.flags[index] && game.flags.filter(Boolean).length >= MINE_COUNT) return game;
  const flags = [...game.flags]; flags[index] = !flags[index];
  return { ...game, flags };
}
export function revealMine(game, index, random = Math.random) {
  if (game.status !== 'playing' || index < 0 || index >= 81 || game.flags[index]) return game;
  if (!game.started) game = seedMines(game, index, random);
  let targets = [index];
  if (game.revealed[index]) {
    const adjacent = neighbors(index);
    if (!game.counts[index] || adjacent.filter(i => game.flags[i]).length !== game.counts[index]) return game;
    targets = adjacent.filter(i => !game.flags[i] && !game.revealed[i]);
  }
  const hit = targets.find(i => game.mines.includes(i));
  if (hit !== undefined) return { ...game, exploded: hit, status: 'lost', revealed: game.revealed.map((value, i) => value || game.mines.includes(i)) };
  const revealed = [...game.revealed];
  const stack = [...targets];
  while (stack.length) {
    const cell = stack.pop();
    if (revealed[cell] || game.flags[cell] || game.mines.includes(cell)) continue;
    revealed[cell] = true;
    if (!game.counts[cell]) stack.push(...neighbors(cell));
  }
  return { ...game, revealed, status: revealed.filter(Boolean).length === 81 - MINE_COUNT ? 'won' : 'playing' };
}
