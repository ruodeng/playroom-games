import { advance, around, initial, search, step, stuckOrRepeat, won } from './boards-common.js';

const pits = [[0, 1, 2, 3, 4, 5], [7, 8, 9, 10, 11, 12]];
const sideIndex = side => side === 1 ? 0 : 1;
const store = side => side === 1 ? 6 : 13;
export const kalah = {
  create() { return initial([4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]); },
  moves(state) { return state.outcome ? [] : pits[sideIndex(state.turn)].filter(i => state.board[i]).map(to => ({ to })); },
  apply(state, move) {
    const { turn } = state, board = state.board.slice(), ownStore = store(turn), skip = store(-turn);
    let i = move.to, seeds = board[i];
    board[i] = 0;
    while (seeds > 0) {
      i = (i + 1) % 14;
      if (i === skip) continue;
      board[i]++;
      seeds--;
    }
    let caught = 0;
    if (pits[sideIndex(turn)].includes(i) && board[i] === 1 && board[12 - i] > 0) {
      caught = board[i] + board[12 - i];
      board[ownStore] += caught;
      board[i] = board[12 - i] = 0;
    }
    let outcome = null;
    if (pits.some(row => row.every(p => !board[p]))) {
      for (const side of [1, -1]) for (const p of pits[sideIndex(side)]) { board[store(side)] += board[p]; board[p] = 0; }
      outcome = won(Math.sign(board[6] - board[13]), '收仓完毕，你 ' + board[6] + ' 粒，电脑 ' + board[13] + ' 粒');
    }
    return advance(state, move, { board, caught, turn: i === ownStore ? turn : -turn, extra: i === ownStore && !outcome, outcome });
  },
  result(state) { return state.outcome || null; },
  evaluate({ board, extra, turn }) {
    const own = pits[0].reduce((sum, i) => sum + board[i], 0), other = pits[1].reduce((sum, i) => sum + board[i], 0);
    return (board[6] - board[13]) * 13 + own - other + (extra ? 3 * turn : 0);
  },
  priority(state, move) { return ((move.to + state.board[move.to]) % 14 === store(state.turn) ? 30 : 0) + state.board[move.to]; },
  choose(state, moves, random) { return search(this, state, moves, random, 5); },
};

export const nim = {
  create() { return initial([3, 4, 5, 7]); },
  moves(state) { return state.board.flatMap((heap, to) => Array.from({ length: heap }, (_, i) => ({ to, take: i + 1 }))); },
  apply(state, move) {
    const board = state.board.slice();
    board[move.to] -= move.take;
    return advance(state, move, { board, outcome: board.some(Boolean) ? null : won(state.turn, '取走最后一颗石子') });
  },
  result(state) { return state.outcome || null; },
  choose(state, moves, random) {
    const balance = state.board.reduce((a, b) => a ^ b, 0);
    const winning = moves.filter(({ to, take }) => (balance ^ state.board[to] ^ (state.board[to] - take)) === 0);
    const options = winning.length ? winning : moves;
    return options[Math.floor(random() * options.length)];
  },
};

export const morrisPoints = [0, 1, 2].flatMap(r => [
  [r, r], [3, r], [6 - r, r], [6 - r, 3], [6 - r, 6 - r], [3, 6 - r], [r, 6 - r], [r, 3],
]);
export const morrisLines = [];
for (const base of [0, 8, 16]) for (const i of [0, 2, 4, 6]) morrisLines.push([base + i, base + (i + 1) % 8, base + (i + 2) % 8]);
for (const i of [1, 3, 5, 7]) morrisLines.push([i, i + 8, i + 16]);
const morrisNeighbors = Array.from({ length: 24 }, () => []);
for (const [a, b, c] of morrisLines) {
  morrisNeighbors[a].push(b); morrisNeighbors[b].push(a, c); morrisNeighbors[c].push(b);
}
const isMill = (board, point) => morrisLines.some(line => line.includes(point) && line.every(i => board[i] === board[point] && board[i] !== 0));
const pieces = (board, side) => board.flatMap((p, i) => p === side ? [i] : []);

export const morris = {
  create() { return initial(Array(24).fill(0), { reserve: [9, 9], taking: false }, true); },
  moves({ board, turn, reserve, taking }) {
    const empty = pieces(board, 0);
    if (taking) {
      const enemy = pieces(board, -turn), exposed = enemy.filter(i => !isMill(board, i));
      return (exposed.length ? exposed : enemy).map(to => ({ to, kind: 'remove' }));
    }
    if (reserve[sideIndex(turn)] > 0) return empty.map(to => ({ to, kind: 'place' }));
    const owned = pieces(board, turn);
    if (owned.length < 3) return [];
    return owned.flatMap(from => (owned.length === 3 ? empty : morrisNeighbors[from].filter(i => !board[i])).map(to => ({ from, to })));
  },
  apply(state, move, record = true) {
    const { turn } = state, board = state.board.slice(), reserve = state.reserve.slice();
    let taking = false, outcome = null;
    if (move.kind === 'remove') {
      board[move.to] = 0;
      if (pieces(board, -turn).length + reserve[sideIndex(-turn)] < 3) outcome = won(turn, '对方剩余棋子不足三枚');
    } else {
      if (move.kind === 'place') reserve[sideIndex(turn)]--;
      else board[move.from] = 0;
      board[move.to] = turn;
      taking = isMill(board, move.to) && board.includes(-turn);
    }
    return advance(state, move, { board, reserve, taking, turn: taking ? turn : -turn, outcome }, record);
  },
  result(state, moves) { return state.outcome || stuckOrRepeat(state, moves); },
  evaluate({ board, reserve, taking, turn }) {
    let score = (pieces(board, 1).length + reserve[0] - pieces(board, -1).length - reserve[1]) * 120 + (taking ? turn * 105 : 0);
    for (const line of morrisLines) {
      const own = line.filter(i => board[i] === 1).length, enemy = line.filter(i => board[i] === -1).length;
      if (!enemy) score += [0, 1, 12, 23][own];
      if (!own) score -= [0, 1, 12, 23][enemy];
    }
    return score + board.reduce((sum, p, i) => sum + p * morrisNeighbors[i].length, 0);
  },
  priority(state, move) {
    if (move.kind === 'remove') return morrisNeighbors[move.to].length;
    const threats = morrisLines.filter(line => line.includes(move.to) && line.every(i => i === move.to || (i !== move.from && state.board[i] === state.turn)));
    return threats.length * 25 + morrisNeighbors[move.to].length;
  },
  choose(state, moves, random) { return search(this, state, moves, random, 3, 12); },
};

const isolationNeighbors = Array.from({ length: 49 }, (_, i) => around.map(([dx, dy]) => step(i, dx, dy, 7, 7)).filter(n => n >= 0));
function openSteps(board, side) { return isolationNeighbors[board.indexOf(side)].filter(i => !board[i]); }
function distanceMap(board, side) {
  const source = board.indexOf(side), queue = [source], dist = Array(49).fill(Infinity);
  dist[source] = 0;
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k];
    for (const n of isolationNeighbors[i]) if (dist[n] === Infinity && !board[n]) {
      dist[n] = dist[i] + 1;
      queue.push(n);
    }
  }
  return dist;
}
export const isolation = {
  create() {
    const board = Array(49).fill(0);
    board[3] = -1; board[45] = 1;
    return initial(board, { blocking: false });
  },
  moves({ board, turn, blocking, outcome }) {
    if (outcome) return [];
    if (blocking) return pieces(board, 0).map(to => ({ to, kind: 'block' }));
    const from = board.indexOf(turn);
    return openSteps(board, turn).map(to => ({ from, to }));
  },
  apply(state, move) {
    const { turn } = state, board = state.board.slice();
    if (state.blocking) {
      board[move.to] = 2;
      const outcome = openSteps(board, -turn).length ? null : won(turn, '封住了对方所有出路');
      return advance(state, move, { board, blocking: false, outcome });
    }
    board[move.from] = 0; board[move.to] = turn;
    return advance(state, move, { board, turn, blocking: true });
  },
  result(state, moves) { return state.outcome || (moves.length ? null : won(-state.turn, '无路可走')); },
  evaluate({ board }) {
    const mine = distanceMap(board, 1), theirs = distanceMap(board, -1);
    let territory = 0;
    board.forEach((p, i) => { if (!p && mine[i] !== theirs[i]) territory += mine[i] < theirs[i] ? 1 : -1; });
    return territory + 7 * (openSteps(board, 1).length - openSteps(board, -1).length);
  },
  choose(state, moves, random) { return search(this, state, moves, random, state.blocking ? 1 : 2); },
};
