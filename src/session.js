import { BLACK, WHITE, replayMoves } from './gomoku.js';

export const DEFAULT_SETTINGS = { difficulty: 'normal', humanPlayer: BLACK };

export function restoreSession(saved) {
  const settings = saved?.settings;
  if (saved?.version !== 1 || !settings ||
      ![undefined, 'ai', 'local'].includes(settings.mode) ||
      !['easy', 'normal', 'hard'].includes(settings.difficulty) ||
      ![BLACK, WHITE].includes(settings.humanPlayer)) {
    throw new Error('无效的设置');
  }
  return {
    game: replayMoves(saved.moves),
    // Keep legacy positions and the chosen color; the opponent is now always AI.
    settings: { difficulty: settings.difficulty, humanPlayer: settings.humanPlayer },
    preferences: { sound: saved.preferences?.sound === true, numbers: saved.preferences?.numbers === true },
    migratedLocal: settings.mode === 'local',
  };
}
