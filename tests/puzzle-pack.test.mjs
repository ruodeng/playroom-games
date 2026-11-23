import test from 'node:test';
import assert from 'node:assert/strict';
import { createLinkup, linkupPath, findLinkupPair, chooseLinkup, shuffleLinkup, hintLinkup } from '../src/linkup.js';
import { createMatch, matchGroups, findMatchMove, swapMatch, resolveMatch, MATCH_GOAL } from '../src/match.js';
import { createSokoban, moveSokoban, undoSokoban, resetSokoban, nextSokoban, SOKOBAN_LEVELS } from '../src/sokoban.js';
import { createSliding, moveSliding, undoSliding, isSlidingSolved, isSlidingSolvable, slidingNeighbors, SLIDING_GOAL } from '../src/sliding.js';
import { createWater, pourWater, undoWater, resetWater, nextWater, isWaterSolved, WATER_LEVELS } from '../src/water.js';
import { PUZZLE_GAMES } from '../src/puzzle-pack.js';

function rng(seed = 42) { return () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }; }
function frozen(game) {
  if (game && typeof game === 'object') { Object.values(game).forEach(frozen); Object.freeze(game); }
  return game;
}

test('puzzle pack exports the five panel definitions with complete Chinese metadata', () => {
  assert.deepEqual(PUZZLE_GAMES.map(game => game.id), ['linkup', 'match', 'sokoban', 'sliding', 'water']);
  for (const game of PUZZLE_GAMES) {
    assert.equal(game.filter, 'puzzle'); assert.equal(typeof game.setup, 'function');
    assert.ok(game.rules.length >= 3); assert.ok(game.art && (game.intro || game.record));
    for (const key of ['name', 'number', 'icon', 'category', 'description', 'welcome', 'hint', 'detail']) assert.ok(game[key], `${game.id}: ${key}`);
  }
});

test('linkup routes use at most two turns, including the outside border', () => {
  const path = linkupPath([1, 2, 1, 3, 4, 5], 0, 2, 3, 2);
  assert.ok(path); assert.ok(path.some(([, y]) => y === 0));
  let turns = 0;
  for (let i = 2; i < path.length; i++) if (path[i][0] - path[i - 1][0] !== path[i - 1][0] - path[i - 2][0] || path[i][1] - path[i - 1][1] !== path[i - 1][1] - path[i - 2][1]) turns++;
  assert.ok(turns <= 2);
  assert.equal(linkupPath([1, 2, 3, 4, 1, 5, 6, 7, 8], 0, 4, 3, 3), null);
  assert.equal(linkupPath([1, 1], 0, 0, 2, 1), null);
  assert.equal(linkupPath([1, 2], 0, 1, 2, 1), null);
});

test('linkup preserves pairs on shuffle and remains playable to completion', () => {
  let game = createLinkup(rng()); const original = structuredClone(game);
  const hinted = hintLinkup(frozen(game)); assert.equal(hinted.hint.length, 2); assert.equal(game.hint.length, 0);
  const shuffled = shuffleLinkup(game, () => 0);
  assert.deepEqual([...shuffled.board].sort(), [...original.board].sort()); assert.ok(findLinkupPair(shuffled.board));
  for (let pair = 0; pair < 24; pair++) {
    const [a, b] = findLinkupPair(game.board); game = chooseLinkup(frozen(game), a, rng(pair)); game = chooseLinkup(frozen(game), b, rng(pair + 1));
  }
  assert.equal(game.status, 'won'); assert.equal(game.moves, 24); assert.ok(game.board.every(value => !value));
  assert.equal(chooseLinkup(game, 0), game);
});

test('match initial boards are stable and solvable, including a constant RNG', () => {
  for (const random of [rng(1), rng(91), rng(812), () => 0, () => 0.999]) {
    const game = createMatch(random); assert.equal(game.board.length, 49); assert.equal(matchGroups(game.board).length, 0); assert.ok(findMatchMove(game.board));
  }
});

test('match accepts adjacent scoring swaps only and preserves immutable inputs', () => {
  const game = frozen(createMatch(rng()));
  assert.equal(swapMatch(game, 0, 10), game);
  let invalid;
  for (let a = 0; a < 48 && !invalid; a++) if (a % 7 < 6) {
    const result = swapMatch(game, a, a + 1, rng()); if (!result.score) invalid = result;
  }
  assert.ok(invalid); assert.equal(invalid.moves, 25); assert.deepEqual(invalid.board, game.board);
  const [a, b] = findMatchMove(game.board), moved = swapMatch(game, a, b, rng(91));
  assert.equal(moved.moves, 24); assert.ok(moved.score >= 30); assert.equal(matchGroups(moved.board).length, 0); assert.ok(findMatchMove(moved.board));
  assert.equal(game.score, 0); assert.equal(game.moves, 25);
  assert.equal(swapMatch({ ...game, score: MATCH_GOAL - 10 }, a, b, rng()).status, 'won');
  assert.equal(swapMatch({ ...game, moves: 1 }, a, b, rng()).status, 'lost');
});

test('match resolves gravity cascades, intersection scoring, and stable refill', () => {
  const board = [1, 2, 3, 4, 5, 2, 3, 1, 5, 6, 3, 4, 2, 6, 1, 4, 1, 1, 2, 3, 1, 2, 2, 2, 1];
  const resolved = resolveMatch(frozen(board), rng(), 5);
  assert.ok(resolved.cascades >= 2); assert.ok(resolved.removed >= 6); assert.equal(matchGroups(resolved.board, 5).length, 0);
  assert.equal(board[21], 2);
  assert.equal(matchGroups([2, 1, 3, 1, 1, 1, 3, 1, 2], 3).length, 5);
});

// Search push states rather than every walking permutation. Returned commands
// are replayed through the public engine, proving each authored level is solvable.
function solveSokoban(initial) {
  const directions = [['left', -1], ['right', 1], ['up', -initial.width], ['down', initial.width]];
  function reachable(player, boxes) {
    const paths = new Map([[player, []]]), queue = [player];
    for (let head = 0; head < queue.length; head++) for (const [name, delta] of directions) {
      const next = queue[head] + delta;
      if (next < 0 || next >= initial.width * initial.height || Math.abs(delta) === 1 && Math.floor(next / initial.width) !== Math.floor(queue[head] / initial.width) || initial.walls.includes(next) || boxes.includes(next) || paths.has(next)) continue;
      paths.set(next, [...paths.get(queue[head]), name]); queue.push(next);
    }
    return paths;
  }
  const queue = [{ boxes: initial.boxes, player: initial.player, path: [] }], visited = new Set();
  for (let head = 0; head < queue.length && head < 100000; head++) {
    const state = queue[head]; if (state.boxes.every(box => initial.goals.includes(box))) return state.path;
    const paths = reachable(state.player, state.boxes), key = `${[...state.boxes].sort((a, b) => a - b)}:${Math.min(...paths.keys())}`;
    if (visited.has(key)) continue; visited.add(key);
    for (const box of state.boxes) for (const [name, delta] of directions) {
      const behind = box - delta, ahead = box + delta;
      if (!paths.has(behind) || ahead < 0 || ahead >= initial.width * initial.height || initial.walls.includes(ahead) || state.boxes.includes(ahead)) continue;
      if (Math.abs(delta) === 1 && (Math.floor(behind / initial.width) !== Math.floor(box / initial.width) || Math.floor(ahead / initial.width) !== Math.floor(box / initial.width))) continue;
      const boxes = state.boxes.map(value => value === box ? ahead : value);
      // Non-goal wall corners can never be recovered.
      const corner = !initial.goals.includes(ahead) && (initial.walls.includes(ahead - 1) || initial.walls.includes(ahead + 1)) && (initial.walls.includes(ahead - initial.width) || initial.walls.includes(ahead + initial.width));
      if (!corner) queue.push({ boxes, player: box, path: [...state.path, ...paths.get(behind), name] });
    }
  }
  return null;
}

test('sokoban authored levels have matching goals and verified winning solutions', () => {
  for (let level = 0; level < SOKOBAN_LEVELS.length; level++) {
    let game = createSokoban(level); assert.equal(game.boxes.length, game.goals.length);
    const solution = solveSokoban(game); assert.ok(solution, `level ${level + 1} must be solvable`);
    for (const direction of solution) game = moveSokoban(game, direction);
    assert.equal(game.status, 'won'); assert.ok(game.pushes > 0);
    if (level < SOKOBAN_LEVELS.length - 1) assert.equal(nextSokoban(game).level, level + 1);
    else assert.equal(nextSokoban(game), game);
    const undone = undoSokoban(frozen(game)); assert.equal(undone.status, 'playing'); assert.equal(undone.moves, game.moves - 1);
    assert.deepEqual(resetSokoban(game), createSokoban(level));
  }
});

test('sokoban blocks walls, pulling and double-box pushes without mutating', () => {
  const game = frozen(createSokoban());
  const walked = moveSokoban(game, 'down'); assert.equal(walked.moves, 1); assert.equal(game.moves, 0);
  assert.equal(moveSokoban(walked, 'down'), walked);
  assert.deepEqual(undoSokoban(frozen(walked)), game);
  const blocked = frozen({ ...game, boxes: [game.player - game.width, game.player - game.width * 2] });
  assert.equal(moveSokoban(blocked, 'up'), blocked);
});

test('sliding shuffles remain solvable, reject wraparound and undo exactly', () => {
  for (const random of [rng(2), rng(999), () => 0, () => 0.999]) {
    const game = frozen(createSliding(random)); assert.ok(isSlidingSolvable(game.board)); assert.equal(isSlidingSolved(game.board), false);
    const neighbor = slidingNeighbors(game.board.indexOf(0))[0], moved = moveSliding(game, neighbor);
    assert.equal(moved.moves, 1); assert.deepEqual(undoSliding(frozen(moved)), game);
  }
  assert.equal(isSlidingSolvable([2, 1, ...SLIDING_GOAL.slice(2)]), false);
  assert.equal(isSlidingSolvable(Array(16).fill(0)), false);
  const near = frozen({ board: [...SLIDING_GOAL.slice(0, 14), 0, 15], moves: 0, history: [], status: 'playing' });
  assert.equal(moveSliding(near, 15).status, 'won'); assert.equal(moveSliding(near, 3), near);
  const edge = { ...near, board: [1, 2, 3, 0, 4, ...SLIDING_GOAL.slice(5)] };
  assert.equal(moveSliding(edge, 4), edge);
});

test('water levels have conserved colors and reversible verified solutions', () => {
  for (let level = 0; level < WATER_LEVELS.length; level++) {
    let game = createWater(level); assert.equal(isWaterSolved(game.tubes), false);
    const totals = game.tubes.flat().reduce((counts, color) => ({ ...counts, [color]: (counts[color] || 0) + 1 }), {});
    assert.ok(Object.values(totals).every(count => count === 4));
    for (const [from, to] of WATER_LEVELS[level].solution) {
      if (game.status === 'won') break;
      const next = pourWater(frozen(game), from, to); assert.ok(next.moves > game.moves, `level ${level + 1}: ${from} → ${to}`); game = next;
    }
    assert.equal(game.status, 'won', `water level ${level + 1}`);
    assert.deepEqual(resetWater(game), createWater(level));
    if (level < WATER_LEVELS.length - 1) assert.equal(nextWater(game).level, level + 1);
  }
});

test('water pours a contiguous top run up to capacity and supports immutable undo', () => {
  const game = frozen({ level: 0, tubes: [[2, 1, 1, 1], [2, 1, 1], [], [2, 2]], moves: 0, history: [], selected: -1, notice: '', status: 'playing' });
  const moved = pourWater(game, 0, 1);
  assert.deepEqual(moved.tubes, [[2, 1, 1], [2, 1, 1, 1], [], [2, 2]]); assert.equal(moved.moves, 1);
  const undone = undoWater(frozen(moved)); assert.deepEqual(undone.tubes, game.tubes); assert.equal(undone.moves, 0);
  assert.deepEqual(pourWater(game, 0, 3).tubes, game.tubes); assert.equal(pourWater(game, 0, 3).moves, 0);
  assert.equal(pourWater(game, 0, 0), game);
  const won = pourWater({ ...game, tubes: [[1, 1], [1, 1], [2, 2, 2, 2], []] }, 0, 1);
  assert.equal(won.status, 'won'); assert.equal(pourWater(won, 1, 0), won);
});
