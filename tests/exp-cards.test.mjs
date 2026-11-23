import test from 'node:test';
import assert from 'node:assert/strict';
import { landlordBeats, landlordMoves, landlordPatterns } from '../src/expansion/cards-landlord.js';
import { forecastBids, heartsScores, legalTrickCards, trickWinner } from '../src/expansion/cards-tricks.js';
import { attachDomino, dominoes, dominoOptions, meldInfo, rummyOpening } from '../src/expansion/cards-melds.js';
import { firstAttributeSet, isAttributeSet, mahjongHands, mahjongWaits, pyramidOpen, yachtScore } from '../src/expansion/cards-puzzles.js';
import { bgApply, bgLegal, bgWinValue, initialBackgammon } from '../src/expansion/cards-backgammon.js';

test('landlord validates the main rank, wings, chain limits, bombs and rocket', () => {
  const kind = (cards, expected) => landlordPatterns(cards).find(move => move.kind === expected);
  assert.ok(kind([3, 3, 3, 2], 'oneWing'));
  assert.ok(kind([3, 3, 3, 2, 2], 'pairWing'));
  assert.ok(kind([1, 1, 1, 2, 2, 2, 8, 8], 'planeOne'));
  assert.ok(kind([1, 1, 1, 2, 2, 2, 8, 8, 9, 9], 'planePair'));
  assert.ok(kind([1, 1, 1, 1, 7, 7, 8, 8], 'fourPair'));
  assert.ok(kind([0, 0, 1, 1, 2, 2], 'pairRun'));
  assert.ok(kind([7, 8, 9, 10, 11], 'run'));
  assert.deepEqual(landlordPatterns([8, 9, 10, 11, 12]), []);
  assert.deepEqual(landlordPatterns([4, 4, 4, 5, 5, 5, 6, 7, 8, 9]), []);
  const pair = kind([12, 12], 'pair'), bomb = kind([0, 0, 0, 0], 'bomb'), rocket = kind([13, 14], 'rocket');
  assert.equal(landlordBeats(bomb, pair), true);
  assert.equal(landlordBeats(rocket, bomb), true);
  assert.equal(landlordBeats(bomb, rocket), false);
  assert.equal(landlordBeats(kind([13], 'single'), pair), false);
  const previous = kind([0, 0, 0, 1, 1, 1, 8, 9], 'planeOne');
  const hand = [1, 1, 1, 2, 2, 2, 5, 5, 7, 13, 14];
  const replies = landlordMoves(hand, previous);
  assert.ok(replies.some(move => move.pattern.kind === 'planeOne'));
  assert.ok(replies.some(move => move.pattern.kind === 'rocket'));
  for (const reply of replies) {
    assert.ok(landlordBeats(reply.pattern, previous));
    const remaining = [...hand];
    for (const card of reply.cards) {
      const index = remaining.indexOf(card);
      assert.ok(index >= 0);
      remaining.splice(index, 1);
    }
  }
});

test('hearts forces two of clubs, suit following and first-trick restriction; forecast enforces the dealer hook and trump', () => {
  const first = { hearts: true, first: true };
  assert.deepEqual(legalTrickCards([0, 2, 26], [], first), [0]);
  assert.deepEqual(legalTrickCards([1, 49], [{ seat: 0, card: 0 }], first), [1]);
  assert.deepEqual(legalTrickCards([13, 26, 49], [{ seat: 0, card: 0 }], first), [13]);
  assert.deepEqual(legalTrickCards([26, 49], [{ seat: 0, card: 0 }], first), [26, 49]);
  assert.deepEqual(legalTrickCards([14, 27], [], { hearts: true }), [14]);
  assert.deepEqual(legalTrickCards([27, 28], [], { hearts: true }), [27, 28]);
  assert.deepEqual(heartsScores([0, 26, 0, 0]), [26, 0, 26, 26]);
  const trick = [{ seat: 1, card: 12 }, { seat: 2, card: 13 }, { seat: 3, card: 38 }, { seat: 0, card: 4 }];
  assert.equal(trickWinner(trick), 1);
  assert.equal(trickWinner(trick, 1), 2);
  assert.deepEqual(forecastBids(3, [1, 1, 0, null]), [0, 2, 3]);
});

test('dominoes validate and orient each end independently', () => {
  const id = (a, b) => dominoes.findIndex(pair => pair[0] === a && pair[1] === b);
  const chain = [[3, 6]];
  assert.deepEqual(dominoOptions(id(3, 6), chain), ['left', 'right']);
  assert.ok(attachDomino(id(1, 3), 'left', chain));
  assert.ok(attachDomino(id(4, 6), 'right', chain));
  assert.equal(attachDomino(id(0, 2), 'left', chain), false);
  assert.deepEqual(chain, [[1, 3], [3, 6], [6, 4]]);
});

test('rummikub handles a joker gap, colors, wraparound and a multi-meld opening', () => {
  assert.deepEqual(meldInfo([0, 2, 104]), { kind: '顺组', points: 6, ordered: [0, 104, 2] });
  assert.equal(meldInfo([12, 0, 1]), null);
  assert.equal(meldInfo([0, 52, 13]), null);
  assert.equal(meldInfo([2, 15, 28, 41]).kind, '刻组');
  assert.equal(meldInfo([11, 12, 104]).points, 36);
  assert.equal(rummyOpening([7, 20, 33]), null);
  const opening = rummyOpening([4, 17, 30, 5, 18, 31]);
  assert.equal(opening.length, 2);
  assert.equal(new Set(opening.flat()).size, 6);
  assert.equal(opening.reduce((s, group) => s + meldInfo(group).points, 0), 33);
});

test('eight fixed mahjong hands include pair, edge, two-sided, seven-pairs, nine-gates and orphan waits', () => {
  assert.deepEqual(mahjongHands.map(mahjongWaits), [
    [31], [2, 5], [20], [28, 32], [31], [0, 3, 6], [0, 1, 2, 3, 4, 5, 6, 7, 8], [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33],
  ]);
  assert.ok(!mahjongWaits([0, 0, 0, 0, 1, 2, 3, 9, 10, 11, 18, 19, 20]).includes(0));
});

test('pyramid requires both supports; Yacht scores distinguish two straights, quads, full house and Yacht', () => {
  assert.ok(pyramidOpen(27, new Set()));
  assert.ok(!pyramidOpen(20, new Set([26])));
  assert.ok(pyramidOpen(20, new Set([26, 27])));
  assert.ok(!pyramidOpen(20, new Set([20, 26, 27])));
  assert.equal(yachtScore([1, 2, 3, 4, 5], 7), 30);
  assert.equal(yachtScore([1, 2, 3, 4, 5], 8), 0);
  assert.equal(yachtScore([6, 2, 3, 4, 5], 8), 30);
  assert.equal(yachtScore([5, 5, 5, 5, 4], 6), 20);
  assert.equal(yachtScore([5, 5, 5, 4, 4], 9), 23);
  assert.equal(yachtScore([5, 5, 5, 5, 5], 9), 0);
  assert.equal(yachtScore([5, 5, 5, 5, 5], 11), 50);
});

test('attribute groups must satisfy every trait and consist of three distinct cards', () => {
  assert.ok(isAttributeSet([0, 1, 2]));
  assert.ok(isAttributeSet([0, 13, 26]));
  assert.ok(!isAttributeSet([0, 1, 4]));
  assert.ok(!isAttributeSet([0, 0, 0]));
  assert.equal(firstAttributeSet([0, 1, 4]), null);
  assert.deepEqual(firstAttributeSet([0, 1, 4, 2]), [0, 1, 2]);
});

test('backgammon forces bar entry, hits blots, maximizes usable dice and bears off only at legal points', () => {
  const start = initialBackgammon();
  assert.equal(start.points.filter(n => n > 0).reduce((a, b) => a + b), 15);
  const board = { points: Array(24).fill(0), bar: [1, 0], off: [0, 0] };
  board.points[23] = -2; board.points[22] = -1; board.points[12] = 14;
  const options = bgLegal(board, 0, [1, 2]);
  assert.deepEqual(options, [{ from: -1, to: 22, die: 2 }]);
  const hit = bgApply(board, 0, options[0]);
  assert.deepEqual(hit.bar, [0, 1]);
  assert.equal(hit.points[22], 1);
  assert.equal(board.points[22], -1);
  const end = { points: Array(24).fill(0), bar: [0, 0], off: [14, 0] };
  end.points[4] = 1;
  assert.deepEqual(bgLegal(end, 0, [3, 5]), [{ from: 4, to: 1, die: 3 }]);
  end.points[4] = 0; end.points[0] = 1;
  assert.deepEqual(bgLegal(end, 0, [2, 5]), [{ from: 0, to: 24, die: 5 }]);
  end.points[4] = 1; end.off[0]--;
  assert.deepEqual(bgLegal(end, 0, [6]), [{ from: 4, to: 24, die: 6 }]);
  end.points[3] = -1; assert.equal(bgWinValue(end, 0), 3);
  end.points[3] = 0; assert.equal(bgWinValue(end, 0), 2);
  end.off[1] = 1; assert.equal(bgWinValue(end, 0), 1);
});
