import test from 'node:test';
import assert from 'node:assert/strict';
import { games } from '../src/expansion/boards-catalog.js';
import { engines, mount } from '../src/expansion/boards.js';
import { chessStart, xiangqiCheck } from '../src/expansion/boards-chess.js';
import { goScore } from '../src/expansion/boards-go.js';

function arranged(engine, entries, fields = {}) {
  const state = engine.create(), board = state.board.map(() => 0);
  for (const [square, piece] of entries) board[square] = piece;
  return { ...state, board, ...fields };
}
function legalMove(engine, state, predicate) {
  const move = engine.moves(state).find(predicate);
  assert.ok(move, 'the move is legal');
  return move;
}
const play = (engine, state, predicate) => engine.apply(state, legalMove(engine, state, predicate));
const outcome = (engine, state) => engine.result(state, engine.moves(state));

test('ten board games expose unique mobile-game entries and select a legal computer turn', () => {
  assert.equal(typeof mount, 'function');
  assert.deepEqual(games.map(g => g.id), Object.keys(engines));
  assert.equal(new Set(games.map(g => g.name)).size, 10);
  for (const game of games) {
    const engine = engines[game.id];
    assert.ok(game.rules.length >= 2 && game.icon && game.description, game.name);
    let state = engine.create();
    assert.equal(outcome(engine, state), null, game.name);
    for (let n = 0; state.turn === 1 && n < 4; n++) state = engine.apply(state, engine.moves(state)[0]);
    assert.equal(state.turn, -1, game.name);
    const options = engine.moves(state), before = state.board.slice();
    const choice = engine.choose(state, options, () => .42, 1);
    assert.ok(options.includes(choice), game.name);
    assert.deepEqual(state.board, before, game.name + ' search leaves the position intact');
    assert.ok(engine.apply(state, choice).ply > state.ply, game.name);
  }
});

test('xiangqi enforces horse legs, cannon screens, flying generals, mate, stalemate, repetition and three AI levels', () => {
  const x = engines.xiangqi, opening = x.create();
  assert.equal(x.moves(opening).length, 44);
  const testPosition = (entries, turn = 1) => arranged(x, [[85, 1], [3, -1], ...entries], { turn });
  let s = testPosition([[64, 4], [65, 7]]);
  assert.ok(!x.moves(s).some(m => m.from === 64 && m.to === 57));
  s = testPosition([[64, 4]]);
  assert.ok(x.moves(s).some(m => m.from === 64 && m.to === 57));
  s = testPosition([[36, 6], [38, 7], [40, -7]]);
  assert.ok(x.moves(s).some(m => m.from === 36 && m.to === 40));
  s.board[38] = 0;
  assert.ok(!x.moves(s).some(m => m.from === 36 && m.to === 40));
  s = arranged(x, [[85, 1], [4, -1], [49, 5]]);
  assert.ok(!x.moves(s).some(m => m.from === 49 && m.to === 48));
  assert.equal(xiangqiCheck(s.board, 1), false);
  s.board[49] = 0;
  assert.equal(xiangqiCheck(s.board, 1), true);
  s = arranged(x, [[85, 1], [4, -1], [12, 5], [14, 5], [49, 7]], { turn: -1 });
  assert.deepEqual(outcome(x, s), { winner: 1, reason: '困毙' });
  s.board[0] = 5;
  assert.deepEqual(outcome(x, s), { winner: 1, reason: '将死' });
  s = opening;
  for (let cycle = 0; cycle < 2; cycle++) for (const [from, to] of [[82, 65], [1, 20], [65, 82], [20, 1]]) {
    s = play(x, s, m => m.from === from && m.to === to);
  }
  assert.equal(outcome(x, s).winner, 0);
  const reply = x.apply(opening, x.moves(opening)[0]), options = x.moves(reply);
  for (const level of [0, 1, 2]) assert.ok(options.includes(x.choose(reply, options, () => .2, level)));
});

test('chess supports special moves, underpromotion, checkmate, stalemate and repeated-position draws', () => {
  const c = engines.chess;
  const san = (state, text) => play(c, state, m => m.san === text);
  let s = c.create();
  for (const text of ['f3', 'e5', 'g4', 'Qh4#']) s = san(s, text);
  assert.equal(outcome(c, s).winner, -1);
  s = chessStart('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  assert.ok(c.moves(s).some(m => m.san === 'O-O-O'));
  s = san(s, 'O-O');
  assert.equal(s.board[62], 6); assert.equal(s.board[61], 4);
  s = c.create();
  for (const text of ['e4', 'a6', 'e5', 'd5', 'exd6']) s = san(s, text);
  assert.equal(s.board[27], 0); assert.equal(s.board[19], 1);
  s = chessStart('7k/P7/8/8/8/8/8/7K w - - 0 1');
  assert.deepEqual(c.moves(s).filter(m => m.from === 8).map(m => m.promotion).sort(), ['b', 'n', 'q', 'r']);
  s = play(c, s, m => m.promotion === 'n');
  assert.equal(s.board[0], 2); assert.equal(outcome(c, s).winner, 0);
  s = chessStart('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  assert.equal(outcome(c, s).reason, '逼和');
  s = c.create();
  for (let i = 0; i < 2; i++) for (const text of ['Nf3', 'Nf6', 'Ng1', 'Ng8']) s = san(s, text);
  assert.equal(outcome(c, s).winner, 0);
});

test('nine-line Go captures before checking suicide, prevents whole-board repetition and scores two passes', () => {
  const g = engines['go-nine'];
  let s = arranged(g, [[40, -1], [39, 1], [41, 1], [49, 1], [30, -1], [32, -1], [22, -1]]);
  s.positions = new Set([s.board.join(',')]);
  s = play(g, s, m => m.to === 31);
  assert.equal(s.board[40], 0); assert.equal(s.captures[0], 1);
  assert.ok(!g.moves(s).some(m => m.to === 40), 'immediate ko recapture');
  s = arranged(g, [[31, -1], [39, -1], [41, -1], [49, -1]]);
  assert.ok(!g.moves(s).some(m => m.to === 40), 'suicide');
  s = g.create(); s.board = Array(81).fill(1); s.board[40] = 0;
  assert.deepEqual(goScore(s.board), [81, 6.5]);
  s = play(g, s, m => m.kind === 'pass');
  assert.equal(outcome(g, s), null);
  s = play(g, s, m => m.kind === 'pass');
  assert.equal(outcome(g, s).winner, 1); assert.deepEqual(g.moves(s), []);
});

test('jungle gates river jumps on rats, applies trap and elephant exceptions, and ends on a den or capture', () => {
  const j = engines.jungle;
  let s = arranged(j, [[21, 7], [24, -2]]);
  assert.ok(j.moves(s).some(m => m.from === 21 && m.to === 24));
  for (const rat of [-1, 1]) {
    s.board[22] = rat;
    assert.ok(!j.moves(s).some(m => m.from === 21 && m.to === 24));
  }
  s = arranged(j, [[7, 1], [8, -8]]);
  assert.equal(outcome(j, play(j, s, m => m.to === 8)).winner, 1);
  s = arranged(j, [[7, 8], [8, -1]]);
  assert.ok(!j.moves(s).some(m => m.to === 8));
  s = arranged(j, [[51, 2], [52, -8]]);
  assert.ok(j.moves(s).some(m => m.to === 52));
  s = arranged(j, [[21, 1], [22, -1]]);
  assert.ok(!j.moves(s).some(m => m.to === 22));
  s = arranged(j, [[10, 3], [11, -5]]);
  assert.equal(outcome(j, play(j, s, m => m.to === 3)).reason, '攻入对方兽穴');
});

test('checkers requires capture chains with the same man and ends a jump when crowned', () => {
  const c = engines.checkers;
  let s = arranged(c, [[49, 1], [55, 1], [42, -1], [28, -1]]);
  assert.deepEqual(c.moves(s), [{ from: 49, to: 35, jumped: 42 }]);
  s = c.apply(s, c.moves(s)[0]);
  assert.equal(s.turn, 1); assert.equal(s.forced, 35);
  assert.deepEqual(c.moves(s), [{ from: 35, to: 21, jumped: 28 }]);
  s = c.apply(s, c.moves(s)[0]); assert.equal(outcome(c, s).winner, 1);
  s = arranged(c, [[17, 1], [10, -1], [12, -1]]);
  s = play(c, s, m => m.to === 3);
  assert.equal(s.board[3], 2); assert.equal(s.turn, -1); assert.equal(s.forced, -1);
  assert.equal(outcome(c, { ...c.create(), quiet: 80 }).winner, 0);
});

test('kalah gives extra turns, captures opposite seeds and sweeps the remaining row before scoring', () => {
  const k = engines.kalah;
  let s = play(k, k.create(), m => m.to === 2);
  assert.equal(s.turn, 1); assert.equal(s.board[6], 1); assert.equal(s.board.reduce((a, b) => a + b), 48);
  s = arranged(k, [[0, 1], [5, 1], [11, 3], [7, 1]]);
  s = play(k, s, m => m.to === 0);
  assert.equal(s.caught, 4); assert.equal(s.board[6], 4); assert.equal(s.board[11], 0);
  s = arranged(k, [[5, 1], [7, 4], [6, 21], [13, 22]]);
  s = play(k, s, m => m.to === 5);
  assert.equal(outcome(k, s).winner, -1);
  assert.equal(s.board[6], 22); assert.equal(s.board[13], 26);
  assert.deepEqual(k.moves(s), []);
});

test('Morris resolves mills before handing over the turn, protects mills and supports flying and blocked losses', () => {
  const m = engines['nine-mens-morris'];
  let s = m.create();
  for (const i of [0, 8, 1, 9, 2]) s = play(m, s, a => a.to === i);
  assert.equal(s.taking, true); assert.equal(s.turn, 1);
  assert.deepEqual(m.moves(s).map(a => a.to), [8, 9]);
  s = play(m, s, a => a.to === 8); assert.equal(s.turn, -1); assert.equal(s.board[8], 0);
  s = arranged(m, [[0, 1], [1, 1], [2, 1], [8, -1], [9, -1], [10, -1], [12, -1]], { reserve: [0, 0], taking: true });
  assert.deepEqual(m.moves(s).map(a => a.to), [12]);
  s.board[12] = 0;
  assert.deepEqual(m.moves(s).map(a => a.to), [8, 9, 10]);
  assert.equal(outcome(m, play(m, s, a => a.to === 8)).winner, 1);
  s.taking = false;
  assert.ok(m.moves(s).some(a => a.from === 0 && a.to === 23), 'three men can fly');
  s = arranged(m, [[0, 1], [2, 1], [4, 1], [6, 1], [1, -1], [3, -1], [5, -1], [7, -1]], { reserve: [0, 0] });
  assert.equal(outcome(m, s).winner, -1);
});

test('normal-play Nim removes stones from one heap and awards the last stone to the mover', () => {
  const n = engines.nim;
  let s = n.create(), options = n.moves(s);
  s = n.apply(s, n.choose(s, options, () => .4));
  assert.equal(s.board.reduce((a, b) => a ^ b, 0), 0);
  s = arranged(n, [[2, 4]], { turn: -1 });
  s = play(n, s, m => m.to === 2 && m.take === 4);
  assert.equal(outcome(n, s).winner, -1); assert.deepEqual(n.moves(s), []);
});

test('tafl king escapes at a corner, withstands incomplete throne surrounds and can be captured away from the throne', () => {
  const t = engines.tafl;
  let s = arranged(t, [[2, 2], [8, -1]], { turn: 1 });
  assert.equal(outcome(t, play(t, s, m => m.to === 0)).winner, 1);
  s = arranged(t, [[24, 2], [17, -1], [23, -1], [25, -1], [38, -1]], { turn: -1 });
  assert.equal(outcome(t, play(t, s, m => m.from === 38 && m.to === 31)).winner, -1);
  s.board[17] = 0;
  assert.equal(outcome(t, play(t, s, m => m.from === 38 && m.to === 31)), null);
  s = arranged(t, [[17, 2], [10, -1], [16, -1], [19, -1]], { turn: -1 });
  assert.equal(outcome(t, play(t, s, m => m.from === 19 && m.to === 18)).winner, -1);
  s = arranged(t, [[8, 2], [7, -1], [11, -1]], { turn: -1 });
  assert.equal(outcome(t, play(t, s, m => m.from === 11 && m.to === 9)).winner, -1);
});

test('isolation requires a move and a permanent block, and ends when the next side cannot step', () => {
  const iso = engines.isolation;
  let s = iso.create();
  s.board = Array(49).fill(2); s.board[0] = 1; s.board[48] = -1; s.board[1] = s.board[47] = 0;
  s = play(iso, s, m => m.to === 1);
  assert.equal(s.turn, 1); assert.equal(s.blocking, true);
  assert.deepEqual(iso.moves(s).map(m => m.to), [0, 47]);
  s = play(iso, s, m => m.to === 47);
  assert.equal(s.turn, -1); assert.equal(s.board[47], 2); assert.equal(outcome(iso, s).winner, 1);
});

test('all ten mounts accept their first human move and stop pending computer work when the match ends', t => {
  class Node {
    constructor(tag) { this.tag = tag; }
    children = [];
    listeners = {};
    dataset = {};
    style = { setProperty() {} };
    classList = { add() {}, toggle() {} };
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
    setAttribute(name, value) { this[name] = String(value); }
    get firstElementChild() { return this.children[0]; }
    find(predicate) {
      if (predicate(this)) return this;
      for (const child of this.children) { const match = child.find(predicate); if (match) return match; }
      return null;
    }
    querySelector(tag) { return this.find(n => n.tag === tag); }
    contains(node) { return Boolean(this.find(n => n === node)); }
    closest(selector) {
      if ((selector === 'button' && this.tag === 'button') || (selector === '[data-pos]' && this.dataset.pos !== undefined)) return this;
      return this.parent?.closest(selector);
    }
    focus() { globalThis.document.activeElement = this; }
    addEventListener(type, callback, options) { this.listeners[type] = { callback, signal: options.signal }; }
    click() {
      if (this.disabled) return;
      for (let node = this; node; node = node.parent) {
        const listener = node.listeners.click;
        if (listener && !listener.signal.aborted) listener.callback({ target: this });
      }
    }
  }
  const previous = globalThis.document;
  globalThis.document = { createElement: tag => new Node(tag), createElementNS: (_, tag) => new Node(tag) };
  t.after(() => { if (previous) globalThis.document = previous; else delete globalThis.document; });
  for (const { id } of games) {
    const host = new Node('div'), controller = new AbortController(), timers = new Set(), ends = [];
    let practice = 0;
    const api = {
      signal: controller.signal, random: () => .42, status() {}, unrank() { practice++; },
      every(fn) { timers.add(fn); return () => timers.delete(fn); },
      end(message, metric) { ends.push({ message, metric }); controller.abort(); },
    };
    mount(id, host, api);
    assert.equal(practice, 1, id);
    let state = engines[id].create();
    assert.equal(timers.size, state.turn === -1 ? 1 : 0, id);
    if (state.turn === -1) {
      const move = engines[id].choose(state, engines[id].moves(state), api.random, 1);
      state = engines[id].apply(state, move);
      [...timers][0]();
    }
    const cell = i => host.find(n => n.dataset.pos === i);
    const button = cmd => host.find(n => n.dataset.cmd === cmd);
    const engine = engines[id];
    while (state.turn === 1) {
      const move = engine.moves(state)[0];
      if (move.from !== undefined) cell(move.from).click();
      cell(move.to).click();
      if (move.take && button('choice')) button('choice').click();
      state = engine.apply(state, move);
    }
    assert.equal(timers.size, 1, id + ' schedules a reply after human input');
    button('resign').click(); button('confirm').click();
    assert.equal(ends.length, 1); assert.equal(ends[0].metric, null); assert.match(ends[0].message, /认输/);
    for (const callback of [...timers]) callback();
    assert.equal(ends.length, 1, id + ' ignores a stale computer callback');
  }
});
