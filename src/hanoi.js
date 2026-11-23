export function createHanoi(disks = 4) {
  const count = [4, 5, 6].includes(disks) ? disks : 4;
  return { disks: count, towers: [Array.from({ length: count }, (_, i) => count - i), [], []], moves: 0, history: [], status: 'playing' };
}
export function moveHanoi(game, from, to) {
  if (game.status !== 'playing' || !Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from > 2 || to < 0 || to > 2 || from === to) return game;
  const disk = game.towers[from].at(-1), target = game.towers[to].at(-1);
  if (!disk || (target && target < disk)) return game;
  const towers = game.towers.map(tower => [...tower]); towers[from].pop(); towers[to].push(disk);
  return { ...game, towers, moves: game.moves + 1, history: [...game.history, game.towers], status: towers[2].length === game.disks ? 'won' : 'playing' };
}
export function undoHanoi(game) {
  if (!game.history.length) return game;
  return { ...game, towers: game.history.at(-1).map(tower => [...tower]), moves: game.moves - 1, history: game.history.slice(0, -1), status: 'playing' };
}
