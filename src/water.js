export const WATER_CAPACITY = 4;
export const WATER_LABELS = ['', '青', '桃', '金', '紫', '蓝', '橙'];

function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
// Reverse a legal solution from uniform tubes. Each reverse move leaves a
// matching source top, and puts a distinct top run onto the receiving tube.
// Replaying the recorded moves backwards is therefore an exact solution.
function makeLevel(colors, seed, steps) {
  const tubes = [...Array.from({ length: colors }, (_, i) => Array(4).fill(i + 1)), [], []], reverse = [], random = seeded(seed);
  for (let step = 0; step < steps; step++) {
    const options = [];
    for (let from = 0; from < tubes.length; from++) {
      const source = tubes[from]; if (!source.length) continue;
      const color = source.at(-1); let run = 0;
      while (source[source.length - 1 - run] === color) run++;
      // A reverse step can remove part of a run, or an entire uniform tube.
      for (let to = 0; to < tubes.length; to++) if (to !== from && tubes[to].length < 4 && tubes[to].at(-1) !== color) {
        for (let count = 1; count <= Math.min(run, 4 - tubes[to].length); count++) {
          if (count === run && source.length > run) continue;
          if (reverse.length && reverse.at(-1)[0] === to && reverse.at(-1)[1] === from) continue;
          options.push([from, to, count]);
        }
      }
    }
    if (!options.length) break;
    const [from, to, count] = options[Math.floor(random() * options.length)];
    tubes[to].push(...tubes[from].splice(-count)); reverse.push([from, to]);
  }
  return { tubes, solution: reverse.reverse().map(([from, to]) => [to, from]) };
}
export const WATER_LEVELS = [makeLevel(3, 18, 28), makeLevel(4, 731, 42), makeLevel(5, 2931, 58), makeLevel(6, 9301, 75)];
export function isWaterSolved(tubes) { return tubes.every(tube => !tube.length || tube.length === WATER_CAPACITY && tube.every(color => color === tube[0])); }
export function createWater(level = 0) {
  return { level: level % WATER_LEVELS.length, tubes: WATER_LEVELS[level % WATER_LEVELS.length].tubes.map(tube => [...tube]), selected: -1, moves: 0, history: [], notice: '', status: 'playing' };
}
export function pourWater(game, from, to) {
  if (game.status !== 'playing' || from === to || !Number.isInteger(from) || !Number.isInteger(to) || !game.tubes[from] || !game.tubes[to]) return game;
  const source = game.tubes[from], target = game.tubes[to], color = source.at(-1);
  if (!source.length || target.length >= WATER_CAPACITY || target.length && target.at(-1) !== color) return { ...game, selected: -1, notice: '只能倒入空瓶，或顶层颜色相同且未满的瓶子。' };
  let run = 0; while (source[source.length - 1 - run] === color) run++;
  const count = Math.min(run, WATER_CAPACITY - target.length), tubes = game.tubes.map(tube => [...tube]);
  tubes[to].push(...tubes[from].splice(-count));
  return { ...game, tubes, selected: -1, moves: game.moves + 1, history: [...game.history, game.tubes], notice: `倒入了 ${count} 格${WATER_LABELS[color]}色。`, status: isWaterSolved(tubes) ? 'won' : 'playing' };
}
export function chooseWater(game, index) {
  if (game.status !== 'playing' || !Number.isInteger(index) || !game.tubes[index]) return game;
  if (game.selected === index) return { ...game, selected: -1, notice: '' };
  if (game.selected < 0) return game.tubes[index].length ? { ...game, selected: index, notice: '再选目标瓶，倒入相同的顶层颜色。' } : { ...game, notice: '先选一瓶有颜色的水。' };
  return pourWater(game, game.selected, index);
}
export function undoWater(game) {
  return game.history.length ? { ...game, tubes: game.history.at(-1), history: game.history.slice(0, -1), moves: game.moves - 1, selected: -1, notice: '已撤回上一步。', status: 'playing' } : game;
}
export function resetWater(game) { return createWater(game.level); }
export function nextWater(game) { return game.status === 'won' && game.level < WATER_LEVELS.length - 1 ? createWater(game.level + 1) : game; }
