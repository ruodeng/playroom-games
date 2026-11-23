const nextTarget = (previous, random) => {
  const choices = Array.from({ length: 9 }, (_, i) => i).filter(i => i !== previous);
  return choices[Math.floor(random() * choices.length)];
};
export function createMoles(random = Math.random) {
  return { target: nextTarget(-1, random), remaining: 30000, window: 900, score: 0, hits: 0, misses: 0, status: 'playing' };
}
export function hitMole(game, index) {
  if (game.status !== 'playing' || index < 0 || index >= 9) return game;
  return index === game.target
    ? { ...game, target: -1, score: game.score + 10, hits: game.hits + 1 }
    : { ...game, score: Math.max(0, game.score - 5), misses: game.misses + 1 };
}
export function tickMoles(game, ms, random = Math.random) {
  if (game.status !== 'playing' || ms <= 0) return game;
  let next = { ...game }, time = ms;
  while (time > 0 && next.remaining > 0) {
    const elapsed = Math.min(time, next.window, next.remaining);
    next.remaining -= elapsed; next.window -= elapsed; time -= elapsed;
    if (!next.remaining) return { ...next, status: 'won', target: -1 };
    if (!next.window) {
      if (next.target >= 0) next.misses++;
      next.target = nextTarget(next.target, random);
      next.window = Math.max(520, 900 - next.hits * 10);
    }
  }
  return next;
}
