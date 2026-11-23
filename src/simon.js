export const SIMON_ROUNDS = 8;
export const SIMON_NAMES = Object.freeze(['松绿', '麦黄', '湖蓝', '陶红']);

export function createSimon(random = Math.random) {
  return { sequence: [Math.floor(random() * 4)], phase: 'lead', remaining: 600, playbackIndex: 0, inputIndex: 0, active: -1, completed: 0, score: 0, status: 'playing' };
}

export function pressSimon(game, color) {
  if (game.status !== 'playing' || game.phase !== 'input' || !Number.isInteger(color) || color < 0 || color > 3) return game;
  if (game.sequence[game.inputIndex] !== color) return { ...game, active: color, status: 'lost' };
  return { ...game, inputIndex: game.inputIndex + 1, active: color, phase: 'feedback', remaining: 170 };
}

function advance(game, random) {
  if (game.phase === 'lead') return { ...game, phase: 'lit', active: game.sequence[0], playbackIndex: 0, remaining: 470 };
  if (game.phase === 'lit') return { ...game, phase: 'gap', active: -1, remaining: 230 };
  if (game.phase === 'gap') {
    const playbackIndex = game.playbackIndex + 1;
    if (playbackIndex < game.sequence.length) return { ...game, playbackIndex, phase: 'lit', active: game.sequence[playbackIndex], remaining: 470 };
    return { ...game, phase: 'input', remaining: 0, inputIndex: 0, active: -1 };
  }
  if (game.phase === 'feedback') {
    if (game.inputIndex < game.sequence.length) return { ...game, phase: 'input', remaining: 0, active: -1 };
    const completed = game.sequence.length;
    return { ...game, completed, score: completed * 100, active: -1, phase: 'round', remaining: 650, status: completed === SIMON_ROUNDS ? 'won' : 'playing' };
  }
  if (game.phase === 'round') return { ...game, sequence: [...game.sequence, Math.floor(random() * 4)], phase: 'lead', remaining: 600, inputIndex: 0, playbackIndex: 0 };
  return game;
}

export function tickSimon(game, ms, random = Math.random) {
  if (game.status !== 'playing' || game.phase === 'input' || !Number.isFinite(ms) || ms <= 0) return game;
  // Never skip a whole flash after a slow frame. The shell owns pause/resume;
  // the remaining duration is kept entirely in this state.
  let left = Math.min(ms, 100);
  let next = { ...game };
  while (left > 0 && next.phase !== 'input' && next.status === 'playing') {
    if (left < next.remaining) { next.remaining -= left; break; }
    left -= next.remaining;
    next = advance(next, random);
  }
  return next;
}
