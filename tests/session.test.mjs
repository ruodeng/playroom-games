import test from 'node:test';
import assert from 'node:assert/strict';
import { BLACK, WHITE, createGame, placeStone, undoCount } from '../src/gomoku.js';
import { restoreSession } from '../src/session.js';

const game = placeStone(placeStone(createGame(), 7, 7), 7, 8);
const saved = {
  version: 1,
  settings: { difficulty: 'hard', humanPlayer: BLACK },
  moves: game.moves,
  preferences: { sound: true, numbers: true },
};

test('current and legacy AI saves preserve the board and preferences', () => {
  for (const mode of [undefined, 'ai']) {
    const restored = restoreSession({ ...saved, settings: { ...saved.settings, mode } });
    assert.deepEqual(restored.game, game);
    assert.deepEqual(restored.settings, saved.settings);
    assert.deepEqual(restored.preferences, saved.preferences);
    assert.equal(restored.migratedLocal, false);
  }
});

test('legacy local games keep their moves and player color with AI undo semantics', () => {
  for (const humanPlayer of [BLACK, WHITE]) {
    const restored = restoreSession({ ...saved, settings: { ...saved.settings, mode: 'local', humanPlayer } });
    assert.deepEqual(restored.game, game);
    assert.equal(restored.settings.humanPlayer, humanPlayer);
    assert.equal('mode' in restored.settings, false);
    assert.equal(restored.migratedLocal, true);
    assert.equal(undoCount(restored.game, humanPlayer), humanPlayer === BLACK ? 2 : 1);
  }
});

test('save migration still rejects invalid settings and illegal moves', () => {
  assert.throws(() => restoreSession(null));
  assert.throws(() => restoreSession({ ...saved, version: 2 }));
  for (const change of [{ mode: 'unknown' }, { difficulty: 'unknown' }, { humanPlayer: 3 }]) {
    assert.throws(() => restoreSession({ ...saved, settings: { ...saved.settings, ...change } }));
  }
  assert.throws(() => restoreSession({ ...saved, moves: [...saved.moves, saved.moves[0]] }));
});
