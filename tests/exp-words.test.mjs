import test from 'node:test';
import assert from 'node:assert/strict';
import { games } from '../src/expansion/words-catalog.js';
import { cases, crosswords, groupBoards, idioms, ladders, letters, numberBoards, searches } from '../src/expansion/words-data.js';
import { buildCrossword, buildSearch, combine, isTwentyFour, numberCard, rotateLetters, searchLine, shortestLadder, solveTwentyFour, truthCount } from '../src/expansion/words-rules.js';

test('word catalogue has all ten games and only the four specified score metrics', () => {
  assert.equal(games.length, 10);
  assert.equal(new Set(games.map(({ id }) => id)).size, 10);
  assert.deepEqual(games.filter(({ metric }) => metric).map(({ name }) => name), ['成语补字', '词语归组', '字母阶梯', '巧算二十四点']);
});

test('each idiom yields exactly one available answer and each grouping word appears once per board', () => {
  assert.ok(idioms.length >= 30);
  assert.equal(new Set(idioms.map(([word]) => word)).size, idioms.length);
  for (const [word, missing, distractors] of idioms) {
    assert.equal(word.length, 4);
    assert.ok(word[missing]);
    assert.equal(new Set([word[missing], ...distractors]).size, 4, word);
  }
  for (const board of groupBoards) {
    assert.equal(board.length, 4);
    assert.ok(board.every(([, group]) => group.length === 4));
    assert.equal(new Set(board.flatMap(([, group]) => group)).size, 16);
  }
});

test('crossings and search placements preserve every authored answer', () => {
  for (const clues of crosswords) {
    const { board, clues: slots } = buildCrossword(clues);
    assert.ok([...board.values()].some(cell => cell.clues.length > 1));
    for (const slot of slots) assert.equal(slot.cells.map(cell => board.get(cell).answer).join(''), slot.word);
  }
  for (const { placements } of searches) {
    const board = buildSearch(placements, () => 0.5);
    assert.equal(board.length, 49);
    for (const [word, , row, col, dy, dx] of placements) {
      const start = row * 7 + col;
      const end = start + (word.length - 1) * (dy * 7 + dx);
      assert.equal(searchLine(start, end).map(position => board[position]).join(''), word);
    }
  }
  assert.deepEqual(searchLine(0, 17), []);
});

test('each letter ladder is reachable and each cipher has one decoding', () => {
  for (const { start, goal, bank } of ladders) assert.ok(shortestLadder(start, goal, bank)?.length >= 4, `${start} to ${goal}`);
  for (const [answer, shift] of letters) {
    const cipher = rotateLetters(answer, shift);
    assert.notEqual(cipher, answer);
    assert.deepEqual(Array.from({ length: 26 }, (_, index) => index).filter(offset => rotateLetters(cipher, -offset) === answer), [shift]);
  }
});

test('every witness case has exactly one consistent suspect', () => {
  for (const { title, truths, suspects, statements } of cases) {
    assert.equal(suspects.filter((_, index) => truthCount(statements, index) === truths).length, 1, title);
  }
});

test('each 24 puzzle is solvable, with exact intermediate fractions and no zero divisors', () => {
  for (const board of numberBoards) assert.ok(solveTwentyFour(board.map(numberCard)), board.join(', '));
  const third = combine(numberCard(8), '÷', numberCard(3));
  const denominator = combine(numberCard(3), '−', third);
  assert.equal(denominator.numerator, 1);
  assert.equal(denominator.denominator, 3);
  assert.ok(isTwentyFour(combine(numberCard(8), '÷', denominator)));
  assert.equal(combine(numberCard(8), '÷', numberCard(0)), null);
});
