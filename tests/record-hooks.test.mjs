import test from 'node:test';
import assert from 'node:assert/strict';
import { RECORD_BOARDS, getRecordBoard, getRecordResult, isFreshRecordState } from '../src/record-catalog.js';
import { createRecordTracker } from '../src/record-hooks.js';
import { createLights, solveLights, toggleLight } from '../src/lights.js';
import { createWater, pourWater, undoWater, resetWater, nextWater } from '../src/water.js';
import { createSokoban, moveSokoban, undoSokoban, resetSokoban } from '../src/sokoban.js';

function harness(gameId) {
  let clock = 0;
  const starts = [], finishes = [];
  const tracker = createRecordTracker(gameId, {
    now: () => clock,
    startAttempt(boardId) {
      starts.push(boardId);
      const attempt = starts.length;
      return { finish(value, outcome) { finishes.push({ attempt, boardId, value, outcome }); return Promise.resolve(); } };
    },
  });
  return { tracker, starts, finishes, at(value) { clock = value; } };
}

test('catalog separates each supported rules variant and excludes board AI / monopoly', () => {
  assert.equal(RECORD_BOARDS.length, 93);
  assert.equal(new Set(RECORD_BOARDS.map(board => board.game)).size, 84);
  assert.equal(new Set(RECORD_BOARDS.map(board => board.id)).size, 93);
  for (const board of RECORD_BOARDS) {
    assert.match(board.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(board.min <= board.max && board.minDurationMs > 0);
  }
  for (const id of ['gomoku', 'tictactoe', 'connect', 'reversi', 'battleship', 'dots', 'monopoly']) assert.equal(getRecordBoard(id), null);
  for (const speed of ['easy', 'normal', 'fast']) assert.equal(getRecordBoard('snake', {}, speed).id, `snake-${speed}`);
  for (let level = 0; level < 4; level++) assert.equal(getRecordBoard('water', { level }).id, `water-${level + 1}`);
  for (let level = 0; level < 3; level++) assert.equal(getRecordBoard('sokoban', { level }).id, `sokoban-${level + 1}`);
  for (const disks of [4, 5, 6]) assert.equal(getRecordBoard('hanoi', { disks }).id, `hanoi-${disks}`);
  assert.equal(getRecordBoard('snake', {}, 'unknown'), null);
  assert.equal(getRecordBoard('hanoi', { disks: 3 }), null);
});

test('policy only ranks eligible final states and validates integer / bounds / score increments', () => {
  assert.equal(getRecordResult('merge', { status: 'playing', reached: true, score: 2048 }), null);
  assert.deepEqual(getRecordResult('merge', { status: 'lost', score: 2048 }), { boardId: 'merge', value: 2048, outcome: 'lost' });
  assert.equal(getRecordResult('lights', { status: 'playing', moves: 5 }), null);
  assert.equal(getRecordResult('memory', { status: 'lost', moves: 8 }), null);
  assert.equal(getRecordResult('memory', { status: 'won', moves: 7 }), null);
  assert.equal(getRecordResult('snake', { status: 'over', score: 11 }), null);
  assert.equal(getRecordResult('snake', { status: 'over', score: 3980 }), null);
  assert.equal(getRecordResult('tetris', { status: 'over', score: NaN }), null);
  assert.equal(getRecordResult('lights', { status: 'won', moves: 2.5 }), null);
  assert.equal(getRecordResult('word', { status: 'won', guesses: [{}] }).value, 1);
  assert.equal(getRecordResult('code', { status: 'won', guesses: Array(10).fill({}) }).value, 10);
  assert.equal(getRecordResult('mines', { status: 'won' }, 0).value, 1);
  assert.equal(getRecordResult('linkup', { status: 'won', moves: 24 }, 1001).value, 2);
});

test('lights engine completion submits the final move count once; construction and renders do not start', () => {
  const h = harness('lights');
  let state = createLights(() => .25);
  h.tracker.updateLink(state); h.tracker.observe(state);
  assert.equal(h.starts.length, 0);
  h.tracker.begin(state);
  for (const index of solveLights(state.board)) { state = toggleLight(state, index); h.tracker.observe(state); }
  assert.equal(state.status, 'won');
  h.tracker.observe(state); h.tracker.updateLink(state); h.tracker.begin(state);
  assert.deepEqual(h.finishes, [{ attempt: 1, boardId: 'lights', value: state.moves, outcome: 'won' }]);
});

test('pause/resume keeps one ticket and counts only active play for timed puzzles', () => {
  const h = harness('mines'), playing = { status: 'playing' };
  h.tracker.begin(playing);
  h.at(1200); h.tracker.pause();
  h.at(100000); h.tracker.begin(playing);
  h.at(101001); h.tracker.observe({ status: 'won' });
  assert.equal(h.starts.length, 1);
  assert.equal(h.finishes[0].value, 3);
});

test('a finished attempt remains sealed after undo or repeated begin; explicit reset starts a new run', () => {
  const h = harness('merge');
  h.tracker.begin({ status: 'playing', score: 0 });
  h.tracker.observe({ status: 'lost', score: 400 });
  h.tracker.observe({ status: 'playing', score: 396 });
  h.tracker.begin({ status: 'playing', score: 396 });
  h.tracker.observe({ status: 'lost', score: 404 });
  assert.equal(h.finishes.length, 1);
  h.tracker.reset(); h.tracker.begin({ status: 'playing', score: 0 });
  h.tracker.observe({ status: 'lost', score: 40 });
  assert.equal(h.starts.length, 2);
  assert.equal(h.finishes[1].value, 40);
});

test('a variant change gets its own ticket and stale terminal states cannot submit against it', () => {
  const h = harness('snake');
  h.tracker.begin({ status: 'running', score: 0 }, 'easy');
  h.tracker.reset(); h.tracker.begin({ status: 'running', score: 0 }, 'fast');
  h.tracker.observe({ status: 'over', score: 100 }, 'easy');
  h.tracker.observe({ status: 'over', score: 20 }, 'fast');
  assert.deepEqual(h.starts, ['snake-easy', 'snake-fast']);
  assert.deepEqual(h.finishes, [{ attempt: 2, boardId: 'snake-fast', value: 20, outcome: 'over' }]);
});

test('level resets and transitions are distinguishable from undo back to move zero', () => {
  const sokoban = createSokoban(), moved = moveSokoban(sokoban, 'left');
  assert.notEqual(moved, sokoban);
  assert.equal(isFreshRecordState('sokoban', moved, undoSokoban(moved)), false);
  assert.equal(isFreshRecordState('sokoban', moved, resetSokoban(moved)), true);
  const water = createWater();
  let poured;
  for (let from = 0; from < water.tubes.length && !poured; from++) for (let to = 0; to < water.tubes.length; to++) {
    const next = pourWater(water, from, to); if (next.moves > 0) { poured = next; break; }
  }
  assert.ok(poured);
  assert.equal(isFreshRecordState('water', poured, undoWater(poured)), false);
  assert.equal(isFreshRecordState('water', poured, resetWater(poured)), true);
  const won = { ...water, moves: 12, status: 'won' }, next = nextWater(won);
  assert.equal(isFreshRecordState('water', won, next), true);
  const h = harness('water');
  h.tracker.begin(water); h.tracker.observe(won);
  h.tracker.reset(); h.tracker.begin(next); h.tracker.observe({ ...next, moves: 19, status: 'won' });
  assert.deepEqual(h.starts, ['water-1', 'water-2']);
  assert.deepEqual(h.finishes.map(result => result.value), [12, 19]);
});

test('async finishes capture their original result while a later attempt starts', async () => {
  const calls = [];
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const tracker = createRecordTracker('tetris', { startAttempt() { return { async finish(value, outcome) { await pending; calls.push([value, outcome]); } }; } });
  tracker.begin({ status: 'running' }); tracker.observe({ status: 'over', score: 100 });
  tracker.reset(); tracker.begin({ status: 'running' }); tracker.observe({ status: 'over', score: 200 });
  release(); await pending; await Promise.resolve();
  assert.deepEqual(calls, [[100, 'over'], [200, 'over']]);
});

test('unavailable / throwing / rejecting transports never interrupt gameplay or leak rejections', async () => {
  for (const startAttempt of [() => { throw Error('offline'); }, () => ({ finish() { throw Error('offline'); } }), () => ({ finish() { return Promise.reject(Error('offline')); } })]) {
    const tracker = createRecordTracker('tetris', { startAttempt });
    assert.doesNotThrow(() => { tracker.begin({ status: 'running' }); tracker.observe({ status: 'over', score: 100 }); tracker.pause(); tracker.reset(); });
  }
  await new Promise(resolve => setImmediate(resolve));
});
