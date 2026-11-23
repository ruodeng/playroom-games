export const MEMORY_SYMBOLS = ['✦', '●', '◆', '▲', '✿', '☾', '♧', '⌘'];
export function createMemory(random = Math.random) {
  const deck = Array.from({ length: 16 }, (_, i) => i % 8);
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return { deck, open: [], matched: [], moves: 0, wait: 0, status: 'playing' };
}
export function flipMemory(game, index) {
  if (game.status !== 'playing' || index < 0 || index >= 16 || game.wait || game.open.includes(index) || game.matched.includes(index)) return game;
  const open = [...game.open, index];
  if (open.length === 1) return { ...game, open };
  if (game.deck[open[0]] === game.deck[index]) {
    const matched = [...game.matched, ...open];
    return { ...game, open: [], matched, moves: game.moves + 1, status: matched.length === 16 ? 'won' : 'playing' };
  }
  return { ...game, open, moves: game.moves + 1, wait: 800 };
}
export function tickMemory(game, ms) {
  if (!game.wait || game.status !== 'playing') return game;
  const wait = Math.max(0, game.wait - ms);
  return { ...game, wait, open: wait ? game.open : [] };
}
