import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSIC_GAMES } from '../src/classic-pack.js';
import { createSolitaire, drawSolitaire, moveSolitaire, undoSolitaire, canMoveSolitaire, hasSolitaireMoves, solitaireSource } from '../src/solitaire.js';
import { createWord, typeWord, submitWord, evaluateWord, wordKeyboard, WORD_ANSWERS, WORD_DICTIONARY } from '../src/word.js';
import { createCode, setCodePeg, submitCode, evaluateCode } from '../src/code.js';
import { createSimon, pressSimon, tickSimon, SIMON_ROUNDS } from '../src/simon.js';
import { createRunner, jumpRunner, stepRunner, RUNNER_JUMP } from '../src/runner.js';

const zero = () => 0;
function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
}
function card(suit, rank, faceUp = true) { return { id: suit * 13 + rank - 1, suit, rank, faceUp }; }
function solitaireFixture(overrides = {}) {
  return { stock: [card(3, 1, false)], waste: [], tableau: Array.from({ length: 7 }, () => []), foundations: [[], [], [], []], moves: 0, score: 0, status: 'playing', previous: null, ...overrides };
}
function wordGuess(game, word) { for (const letter of word) game = typeWord(game, letter); return submitWord(game); }
function codeGuess(game, colors) { colors.forEach((color, index) => { game = setCodePeg(game, index, color); }); return submitCode(game); }
function simonUntilInput(game, random = zero) {
  for (let i = 0; i < 150 && game.status === 'playing' && game.phase !== 'input'; i++) game = tickSimon(game, 100, random);
  return game;
}
function finishSimonFeedback(game) { while (game.status === 'playing' && game.phase === 'feedback') game = tickSimon(game, 100, zero); return game; }

test('classic definitions provide all five complete shell adapters', () => {
  assert.deepEqual(CLASSIC_GAMES.map(game => game.id), ['solitaire', 'word', 'code', 'simon', 'runner']);
  assert.deepEqual(CLASSIC_GAMES.map(game => game.number), ['028', '029', '030', '031', '032']);
  for (const game of CLASSIC_GAMES) {
    assert.ok(game.name && game.icon && game.art && game.description && game.welcome && game.hint && game.detail);
    assert.ok(game.intro || game.record); assert.ok(game.rules.length >= 3); assert.equal(typeof game.setup, 'function');
  }
});

test('solitaire deals 52 unique cards into a 24-card stock and seven correctly covered columns', () => {
  const game = createSolitaire(seeded(42));
  const cards = [...game.stock, ...game.tableau.flat()];
  assert.equal(cards.length, 52); assert.equal(new Set(cards.map(value => value.id)).size, 52);
  assert.equal(game.stock.length, 24); assert.ok(game.stock.every(value => !value.faceUp));
  assert.deepEqual(game.tableau.map(column => column.length), [1, 2, 3, 4, 5, 6, 7]);
  for (const column of game.tableau) assert.deepEqual(column.map(value => value.faceUp), column.map((_, index) => index === column.length - 1));
  assert.notDeepEqual(game.tableau, createSolitaire(seeded(43)).tableau);
});

test('solitaire draws one card and recycles in the same order without mutating snapshots', () => {
  const game = freeze(solitaireFixture({ stock: [card(0, 1, false), card(1, 1, false), card(2, 1, false)] }));
  let next = game;
  const firstPass = [];
  for (let i = 0; i < 3; i++) { next = drawSolitaire(next); firstPass.push(next.waste.at(-1).id); }
  assert.deepEqual(firstPass, [26, 13, 0]); assert.equal(next.stock.length, 0); assert.equal(next.waste.length, 3);
  assert.ok(next.waste.every(value => value.faceUp));
  const recycled = drawSolitaire(freeze(next));
  assert.equal(recycled.waste.length, 0); assert.deepEqual(recycled.stock, game.stock);
  const secondPass = []; next = recycled;
  for (let i = 0; i < 3; i++) { next = drawSolitaire(next); secondPass.push(next.waste.at(-1).id); }
  assert.deepEqual(secondPass, firstPass); assert.equal(game.waste.length, 0); assert.equal(game.moves, 0);
  assert.equal(undoSolitaire(recycled).moves, 3);
});

test('solitaire moves alternating descending stacks, flips the uncovered card, and undoes exactly', () => {
  const game = solitaireFixture();
  game.tableau[0] = [card(0, 9, false), card(1, 8), card(0, 7)];
  game.tableau[1] = [card(2, 9)];
  freeze(game);
  const source = { pile: 'tableau', column: 0, index: 1 }, destination = { pile: 'tableau', column: 1 };
  assert.equal(canMoveSolitaire(game, source, destination), true);
  const next = moveSolitaire(game, source, destination);
  assert.deepEqual(next.tableau[1].map(value => value.rank), [9, 8, 7]);
  assert.equal(next.tableau[0][0].faceUp, true); assert.equal(game.tableau[0][0].faceUp, false);
  assert.equal(next.moves, 1); assert.equal(undoSolitaire(next), game);
});

test('solitaire rejects same-color, covered, malformed-stack and non-king empty-column moves', () => {
  const game = solitaireFixture();
  game.tableau[0] = [card(1, 8), card(3, 7)];
  game.tableau[1] = [card(1, 9)]; game.tableau[2] = [card(2, 7, false)];
  const from = { pile: 'tableau', column: 0, index: 0 };
  assert.equal(moveSolitaire(game, from, { pile: 'tableau', column: 1 }), game);
  assert.equal(moveSolitaire(game, from, { pile: 'tableau', column: 3 }), game);
  assert.equal(moveSolitaire(game, { pile: 'tableau', column: 2, index: 0 }, { pile: 'tableau', column: 0 }), game);
  assert.equal(moveSolitaire(game, from, { pile: 'tableau', column: 0 }), game);
  assert.deepEqual(solitaireSource(game, { pile: 'tableau', column: 8, index: 0 }), []);
  game.tableau[0] = [card(1, 13), card(2, 12)];
  assert.equal(canMoveSolitaire(game, from, { pile: 'tableau', column: 3 }), true);
  assert.equal(moveSolitaire(game, from, { pile: 'foundation', column: 1 }), game);
});

test('solitaire foundations enforce suits and ascending ranks, and top cards can move back', () => {
  const game = freeze(solitaireFixture({ waste: [card(0, 1)] }));
  assert.equal(moveSolitaire(game, { pile: 'waste' }, { pile: 'foundation', column: 1 }), game);
  let next = moveSolitaire(game, { pile: 'waste' }, { pile: 'foundation', column: 0 });
  assert.equal(next.score, 10); assert.equal(next.waste.length, 0);
  next = { ...next, waste: [card(0, 3)] };
  assert.equal(moveSolitaire(next, { pile: 'waste' }, { pile: 'foundation', column: 0 }), next);
  next = { ...next, tableau: [[card(1, 2)], ...Array.from({ length: 6 }, () => [])] };
  const returned = moveSolitaire(freeze(next), { pile: 'foundation', column: 0 }, { pile: 'tableau', column: 0 });
  assert.equal(returned.foundations[0].length, 0); assert.equal(returned.tableau[0].at(-1).rank, 1); assert.equal(returned.score, 0);
});

test('solitaire considers buried waste and stock cards before declaring no moves', () => {
  const game = solitaireFixture({ stock: [], waste: [card(0, 2), card(2, 5)], tableau: [[card(1, 3)], ...Array.from({ length: 6 }, () => [])] });
  assert.equal(hasSolitaireMoves(game), true);
  const recycled = drawSolitaire(freeze(game));
  assert.equal(recycled.status, 'playing'); assert.equal(drawSolitaire(recycled).waste.at(-1).rank, 2);
  const blocked = freeze(solitaireFixture({ stock: [card(0, 3, false)], tableau: [[card(0, 2)], ...Array.from({ length: 6 }, () => [])] }));
  assert.equal(hasSolitaireMoves(blocked), false);
  const lost = drawSolitaire(blocked);
  assert.equal(lost.status, 'lost'); assert.equal(drawSolitaire(lost), lost); assert.equal(undoSolitaire(lost), blocked);
});

test('solitaire completes when all 52 cards reach foundations and preserves undo after winning', () => {
  const foundations = Array.from({ length: 4 }, (_, suit) => Array.from({ length: suit === 0 ? 12 : 13 }, (_, rank) => card(suit, rank + 1)));
  const game = freeze(solitaireFixture({ stock: [], foundations, score: 510, tableau: [[card(0, 13)], ...Array.from({ length: 6 }, () => [])] }));
  const won = moveSolitaire(game, { pile: 'tableau', column: 0, index: 0 }, { pile: 'foundation', column: 0 });
  assert.equal(won.status, 'won'); assert.equal(won.score, 520);
  assert.equal(won.foundations.flat().length, 52); assert.equal(undoSolitaire(won), game);
  assert.equal(drawSolitaire(won), won); assert.equal(moveSolitaire(won, { pile: 'foundation', column: 0 }, { pile: 'tableau', column: 1 }), won);
});

test('word dictionary is local, unique, five letters, and includes every possible answer', () => {
  assert.ok(WORD_ANSWERS.length >= 100); assert.ok(WORD_DICTIONARY.length > WORD_ANSWERS.length);
  assert.equal(new Set(WORD_DICTIONARY).size, WORD_DICTIONARY.length);
  assert.ok(WORD_DICTIONARY.every(word => /^[A-Z]{5}$/.test(word)));
  assert.ok(WORD_ANSWERS.every(word => WORD_DICTIONARY.includes(word)));
  assert.equal(createWord(zero).answer, 'APPLE');
});

test('word feedback consumes duplicate letters once and reserves exact matches first', () => {
  assert.deepEqual(evaluateWord('APPLE', 'ALLEY'), ['correct', 'present', 'absent', 'present', 'absent']);
  assert.deepEqual(evaluateWord('LEVEL', 'EERIE'), ['present', 'correct', 'absent', 'absent', 'absent']);
  assert.deepEqual(evaluateWord('APPLE', 'PAPAL'), ['present', 'present', 'correct', 'absent', 'present']);
  assert.deepEqual(evaluateWord('SHEEP', 'SHEEP'), Array(5).fill('correct'));
});

test('word editing validates input and invalid or repeated guesses never spend an attempt', () => {
  const original = freeze(createWord(zero));
  let game = typeWord(original, 'p'); assert.equal(game.input, 'P'); assert.equal(original.input, '');
  assert.equal(typeWord(game, '7'), game); game = typeWord(game, 'delete'); assert.equal(game.input, '');
  game = submitWord(game); assert.equal(game.guesses.length, 0); assert.ok(game.error);
  game = wordGuess({ ...game, input: '' }, 'ZZZZZ'); assert.equal(game.guesses.length, 0); assert.ok(game.error);
  assert.equal(typeWord(game, 'a'), game);
  game = wordGuess({ ...game, input: '' }, 'BEACH'); assert.equal(game.guesses.length, 1);
  game = wordGuess(game, 'BEACH'); assert.equal(game.guesses.length, 1); assert.ok(game.error.includes('已经'));
});

test('word guessing wins and loses in six valid attempts, then locks terminal state', () => {
  const won = wordGuess(freeze(createWord(zero)), 'apple');
  assert.equal(won.status, 'won'); assert.equal(won.score, 600); assert.equal(won.input, '');
  assert.equal(typeWord(won, 'a'), won); assert.equal(submitWord(won), won);
  let lost = createWord(zero);
  for (const word of ['BEACH', 'BREAD', 'CHAIR', 'CLOUD', 'DREAM', 'EARTH']) lost = wordGuess(freeze(lost), word);
  assert.equal(lost.status, 'lost'); assert.equal(lost.guesses.length, 6); assert.equal(lost.score, 0);
  assert.equal(submitWord(lost), lost);
  const finalChance = wordGuess({ ...lost, status: 'playing', guesses: lost.guesses.slice(0, 5) }, 'APPLE');
  assert.equal(finalChance.status, 'won'); assert.equal(finalChance.score, 100);
});

test('word keyboard preserves the strongest feedback when a letter appears twice', () => {
  let game = wordGuess(createWord(zero), 'ALLEY');
  assert.equal(wordKeyboard(game).L, 'present'); assert.equal(wordKeyboard(game).A, 'correct');
  game = wordGuess(game, 'APPLE');
  assert.equal(wordKeyboard(game).L, 'correct'); assert.equal(wordKeyboard(game).P, 'correct'); assert.equal(wordKeyboard(game).Y, 'absent');
});

test('code duplicates each count once and exact matches take priority', () => {
  assert.deepEqual(evaluateCode([0, 0, 1, 1], [0, 1, 0, 0]), { exact: 1, elsewhere: 2 });
  assert.deepEqual(evaluateCode([0, 0, 0, 0], [0, 1, 2, 3]), { exact: 1, elsewhere: 0 });
  assert.deepEqual(evaluateCode([0, 1, 0, 2], [0, 0, 0, 0]), { exact: 2, elsewhere: 0 });
  assert.deepEqual(evaluateCode([0, 1, 2, 3], [3, 2, 1, 0]), { exact: 0, elsewhere: 4 });
});

test('code editing allows repeated colors, rejects invalid pegs and preserves snapshots', () => {
  const game = freeze(createCode(zero));
  assert.deepEqual(game.secret, [0, 0, 0, 0]);
  assert.equal(setCodePeg(game, 4, 0), game); assert.equal(setCodePeg(game, 0, 6), game); assert.equal(setCodePeg(game, 0, 1.5), game);
  const entered = setCodePeg(game, 0, 2); assert.deepEqual(entered.current, [2, null, null, null]); assert.deepEqual(game.current, [null, null, null, null]);
  const erased = setCodePeg(freeze(entered), 0, null); assert.deepEqual(erased.current, game.current);
  const invalid = submitCode(erased); assert.equal(invalid.guesses.length, 0); assert.ok(invalid.error);
  const won = codeGuess(game, [0, 0, 0, 0]); assert.equal(won.status, 'won'); assert.equal(won.score, 1000);
  assert.equal(setCodePeg(won, 0, 1), won); assert.equal(submitCode(won), won);
});

test('code has ten attempts, reveals a terminal loss, and permits a last-attempt win', () => {
  let game = createCode(zero);
  for (let i = 0; i < 9; i++) game = codeGuess(freeze(game), [1, 1, 1, 1]);
  assert.equal(game.status, 'playing'); assert.equal(game.guesses.length, 9);
  const lost = codeGuess(game, [1, 1, 1, 1]); assert.equal(lost.status, 'lost'); assert.equal(lost.guesses.length, 10); assert.equal(lost.score, 0);
  const won = codeGuess(game, [0, 0, 0, 0]); assert.equal(won.status, 'won'); assert.equal(won.score, 100);
});

test('simon playback locks input and retains the exact remaining phase duration', () => {
  const game = freeze(createSimon(zero));
  assert.equal(pressSimon(game, 0), game); assert.equal(tickSimon(game, 0), game); assert.equal(tickSimon(game, NaN), game);
  const partial = tickSimon(game, 50); assert.equal(partial.remaining, 550); assert.equal(game.remaining, 600);
  assert.deepEqual(tickSimon(partial, 50), tickSimon(game, 100));
  // A stalled frame cannot consume and hide a whole visible flash.
  assert.deepEqual(tickSimon(game, 10000), tickSimon(game, 100));
  let playing = game;
  for (let i = 0; i < 6; i++) playing = tickSimon(playing, 100);
  assert.equal(playing.phase, 'lit'); assert.equal(playing.active, 0);
  assert.equal(pressSimon(playing, 0), playing);
  playing = simonUntilInput(playing); assert.equal(playing.phase, 'input'); assert.equal(playing.active, -1);
  assert.equal(tickSimon(playing, 100), playing);
});

test('simon correct input briefly locks feedback and an incorrect input ends the game', () => {
  const game = freeze(simonUntilInput(createSimon(zero)));
  const correct = pressSimon(game, 0); assert.equal(correct.phase, 'feedback'); assert.equal(correct.inputIndex, 1);
  assert.equal(pressSimon(correct, 0), correct); assert.equal(game.inputIndex, 0);
  const next = finishSimonFeedback(correct); assert.equal(next.completed, 1); assert.equal(next.score, 100); assert.equal(next.phase, 'round');
  const lost = pressSimon(game, 1); assert.equal(lost.status, 'lost'); assert.equal(lost.active, 1);
  assert.equal(tickSimon(lost, 100), lost); assert.equal(pressSimon(lost, 0), lost);
});

test('simon preserves the sequence prefix, grows all eight rounds and reaches a real win', () => {
  const random = seeded(18);
  let game = createSimon(random), prefix = [];
  for (let round = 1; round <= SIMON_ROUNDS; round++) {
    game = simonUntilInput(game, random);
    assert.equal(game.phase, 'input'); assert.equal(game.sequence.length, round); assert.deepEqual(game.sequence.slice(0, -1), prefix);
    prefix = [...game.sequence];
    for (const color of prefix) game = finishSimonFeedback(pressSimon(freeze(game), color));
    assert.equal(game.completed, round); assert.equal(game.score, round * 100);
  }
  assert.equal(game.status, 'won'); assert.equal(game.score, 800); assert.equal(tickSimon(game, 100), game);
});

test('runner jump obeys gravity, prevents double jumps and permits jumping again after landing', () => {
  const game = freeze({ ...createRunner(), obstacles: [], spawnIn: 99999 });
  let next = jumpRunner(game); assert.equal(next.velocity, RUNNER_JUMP); assert.equal(game.velocity, 0);
  assert.equal(jumpRunner(next), next);
  next = stepRunner(freeze(next), 100, zero); assert.ok(next.height > 0); assert.ok(next.velocity < RUNNER_JUMP); assert.equal(jumpRunner(next), next);
  for (let i = 0; i < 8; i++) next = stepRunner(freeze(next), 100, zero);
  assert.equal(next.height, 0); assert.equal(next.velocity, 0); assert.equal(jumpRunner(next).velocity, RUNNER_JUMP);
});

test('runner collides with obstacles, including thin obstacles at maximum speed, and locks the result', () => {
  const game = freeze({ ...createRunner(), elapsed: 100000, obstacles: [{ id: 9, x: 120, width: 24, height: 40, passed: false }], spawnIn: 99999 });
  const lost = stepRunner(game, 100, zero);
  assert.equal(lost.status, 'lost'); assert.equal(game.status, 'playing'); assert.equal(lost.speed, 380);
  assert.equal(stepRunner(lost, 100), lost); assert.equal(jumpRunner(lost), lost);
});

test('runner can clear an obstacle with a timed jump, awards it once and scores distance', () => {
  let game = jumpRunner(freeze({ ...createRunner(), obstacles: [{ id: 9, x: 145, width: 26, height: 40, passed: false }], spawnIn: 99999 }));
  for (let i = 0; i < 10; i++) game = stepRunner(freeze(game), 100, zero);
  assert.equal(game.status, 'playing'); assert.equal(game.passed, 1); assert.equal(game.height, 0);
  assert.equal(game.score, Math.floor(game.distance / 10) + 25); assert.ok(game.speed > 210);
  assert.equal(stepRunner(game, 100, zero).passed, 1);
});

test('runner spawns reachable obstacles, limits catch-up, and ignores invalid time deltas', () => {
  const game = freeze({ ...createRunner(), obstacles: [], spawnIn: 20 });
  const next = stepRunner(game, 100, zero);
  assert.equal(next.obstacles.length, 1); assert.equal(next.obstacles[0].width, 24); assert.equal(next.obstacles[0].height, 34);
  assert.ok(next.spawnIn > 1200); assert.equal(game.obstacles.length, 0);
  assert.deepEqual(stepRunner(game, 10000, zero), next);
  for (const ms of [0, -1, NaN, Infinity]) assert.equal(stepRunner(game, ms), game);
});
