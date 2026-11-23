import { advance, coord, countSide, diagonal, initial, orthogonal, search, slide, step, stuckOrRepeat, won } from './boards-common.js';

export const jungleDens = [3, 59];
export const jungleTraps = new Map([[2, -1], [4, -1], [10, -1], [58, 1], [60, 1], [52, 1]]);
export function jungleWater(index) {
  const x = index % 7, y = Math.floor(index / 7);
  return y >= 3 && y <= 5 && [1, 2, 4, 5].includes(x);
}
const jungleValues = [0, 75, 36, 45, 52, 62, 100, 118, 130];
function jungleCatch(board, from, to, turn) {
  if (!board[to]) return true;
  if (board[to] * turn > 0 || jungleWater(from) !== jungleWater(to)) return false;
  if (jungleTraps.get(to) === turn) return true;
  const attacker = Math.abs(board[from]), target = Math.abs(board[to]);
  if (attacker === 8 && target === 1) return false;
  return (attacker === 1 && target === 8) || attacker >= target;
}
export const jungle = {
  create() {
    const board = Array(63).fill(0);
    for (const [x, y, rank] of [[0, 0, 7], [6, 0, 6], [1, 1, 3], [5, 1, 2], [0, 2, 1], [2, 2, 5], [4, 2, 4], [6, 2, 8]]) {
      const i = coord(x, y, 7, 9);
      board[i] = -rank;
      board[62 - i] = rank;
    }
    return initial(board, {}, true);
  },
  moves(state) {
    const { board, turn } = state, moves = [];
    board.forEach((piece, from) => {
      const rank = piece * turn;
      if (rank <= 0) return;
      for (const [dx, dy] of orthogonal) {
        let to = step(from, dx, dy, 7, 9);
        if (to < 0) continue;
        if (jungleWater(to) && rank !== 1) {
          if (rank !== 6 && rank !== 7) continue;
          while (to >= 0 && jungleWater(to) && !board[to]) to = step(to, dx, dy, 7, 9);
          if (to < 0 || jungleWater(to)) continue;
        }
        if (to !== jungleDens[turn === 1 ? 1 : 0] && jungleCatch(board, from, to, turn)) moves.push({ from, to });
      }
    });
    return moves;
  },
  apply(state, move, record = true) {
    const board = slide(state.board, move);
    let outcome = null;
    if (jungleDens.includes(move.to)) outcome = won(state.turn, '攻入对方兽穴');
    else if (!countSide(board, -state.turn)) outcome = won(state.turn, '吃光对方动物');
    return advance(state, move, { board, outcome }, record);
  },
  result(state, moves) { return state.outcome || stuckOrRepeat(state, moves); },
  evaluate({ board }) {
    return board.reduce((sum, piece, i) => {
      if (!piece) return sum;
      const side = Math.sign(piece), targetRow = side === 1 ? 0 : 8;
      const distance = Math.abs(Math.floor(i / 7) - targetRow) + Math.abs(i % 7 - 3);
      return sum + side * (jungleValues[Math.abs(piece)] + (11 - distance) * 4 + (distance <= 2 ? 24 : 0));
    }, 0);
  },
  priority(state, move) {
    return (jungleDens.includes(move.to) ? 1000 : 0) + jungleValues[Math.abs(state.board[move.to])]
      + (Math.floor(move.from / 7) - Math.floor(move.to / 7)) * state.turn;
  },
  choose(state, moves, random) { return search(this, state, moves, random, 3, 12); },
};

function checkerOptions(board, from, turn, jumpsOnly) {
  const rank = board[from] * turn, moves = [];
  for (const [dx, dy] of diagonal) {
    if (rank === 1 && dy !== -turn) continue;
    const near = step(from, dx, dy, 8, 8);
    if (near < 0) continue;
    if (!board[near]) {
      if (!jumpsOnly) moves.push({ from, to: near });
    } else if (board[near] * turn < 0) {
      const far = step(near, dx, dy, 8, 8);
      if (far >= 0 && !board[far]) moves.push({ from, to: far, jumped: near });
    }
  }
  return moves;
}

export const checkers = {
  create() {
    const board = Array.from({ length: 64 }, (_, i) => {
      const y = Math.floor(i / 8);
      return (i % 8 + y) % 2 ? (y < 3 ? -1 : y > 4 ? 1 : 0) : 0;
    });
    return initial(board, { forced: -1 }, true);
  },
  moves({ board, turn, forced }) {
    if (forced >= 0) return checkerOptions(board, forced, turn, true);
    const choices = board.flatMap((p, from) => p * turn > 0 ? checkerOptions(board, from, turn, false) : []);
    const jumps = choices.filter(move => move.jumped !== undefined);
    return jumps.length ? jumps : choices;
  },
  apply(state, move, record = true) {
    const board = slide(state.board, move), wasMan = Math.abs(board[move.to]) === 1;
    const jump = move.jumped !== undefined;
    if (jump) board[move.jumped] = 0;
    const crowned = wasMan && Math.floor(move.to / 8) === (state.turn === 1 ? 0 : 7);
    if (crowned) board[move.to] = state.turn * 2;
    const again = jump && !crowned && checkerOptions(board, move.to, state.turn, true).length > 0;
    return advance(state, move, {
      board, turn: again ? state.turn : -state.turn, forced: again ? move.to : -1,
      quiet: jump || wasMan ? 0 : state.quiet + 1,
      outcome: countSide(board, -state.turn) ? null : won(state.turn, '吃光对方棋子'),
    }, record);
  },
  result(state, moves) { return state.outcome || stuckOrRepeat(state, moves) || (state.quiet >= 80 ? won(0, '双方四十回合均未取得进展') : null); },
  evaluate({ board }) {
    return board.reduce((sum, p, i) => {
      if (!p) return sum;
      const side = Math.sign(p), y = Math.floor(i / 8);
      const bonus = Math.abs(p) === 2 ? 175 : 100 + (side === 1 ? 7 - y : y) * 6;
      return sum + side * (bonus + 4 - Math.abs(3.5 - i % 8));
    }, 0);
  },
  priority(state, move) {
    return (move.jumped === undefined ? 0 : Math.abs(state.board[move.jumped]) * 20) + (move.to < 8 || move.to >= 56 ? 8 : 0);
  },
  choose(state, moves, random) { return search(this, state, moves, random, 4, 12); },
};

export const throne = 24;
export const corners = [0, 6, 42, 48];
const restricted = i => i === throne || corners.includes(i);
const taflStep = (i, dx, dy) => step(i, dx, dy, 7, 7);
function taflPaths(board, from) {
  const moves = [], king = board[from] === 2;
  for (const [dx, dy] of orthogonal) {
    for (let to = taflStep(from, dx, dy); to >= 0 && !board[to]; to = taflStep(to, dx, dy)) {
      if (king || !restricted(to)) moves.push({ from, to });
    }
  }
  return moves;
}
function anvil(board, i, side) {
  return i >= 0 && (board[i] * side > 0 || (!board[i] && restricted(i)));
}
export const tafl = {
  create() {
    const board = Array(49).fill(0);
    for (const i of [3, 10, 21, 22, 26, 27, 38, 45]) board[i] = -1;
    for (const i of [17, 23, 25, 31]) board[i] = 1;
    board[throne] = 2;
    return initial(board, { turn: -1 }, true);
  },
  moves({ board, turn }) { return board.flatMap((p, from) => p * turn > 0 ? taflPaths(board, from) : []); },
  apply(state, move, record = true) {
    const { turn } = state, board = slide(state.board, move);
    if (board[move.to] === 2 && corners.includes(move.to)) {
      return advance(state, move, { board, outcome: won(1, '国王抵达角落') }, record);
    }
    const captured = [];
    for (const [dx, dy] of orthogonal) {
      const near = taflStep(move.to, dx, dy);
      if (near < 0 || board[near] * turn >= 0) continue;
      const far = taflStep(near, dx, dy);
      if (board[near] === 2 && (near === throne || [17, 23, 25, 31].includes(near))) {
        const surrounded = orthogonal.every(([a, b]) => {
          const square = taflStep(near, a, b);
          return square === throne || board[square] === -1;
        });
        if (surrounded) captured.push(near);
      } else if (anvil(board, far, turn)) captured.push(near);
    }
    captured.forEach(i => { board[i] = 0; });
    return advance(state, move, { board, captured, outcome: board.includes(2) ? null : won(-1, '国王被围捕') }, record);
  },
  result(state, moves) { return state.outcome || stuckOrRepeat(state, moves); },
  evaluate({ board }) {
    const king = board.indexOf(2);
    if (king < 0) return -1_000_000;
    const paths = taflPaths(board, king);
    const x = king % 7, y = Math.floor(king / 7);
    const dist = Math.min(x, 6 - x) + Math.min(y, 6 - y);
    return (countSide(board, 1) - 1) * 60 - countSide(board, -1) * 38 + paths.length * 3
      + paths.filter(m => corners.includes(m.to)).length * 140 + (6 - dist) * 8;
  },
  priority(state, move) {
    if (corners.includes(move.to)) return 10_000;
    const target = state.board.indexOf(2);
    return 12 - Math.abs(move.to % 7 - target % 7) - Math.abs(Math.floor(move.to / 7) - Math.floor(target / 7));
  },
  choose(state, moves, random) { return search(this, state, moves, random, 3, 10); },
};
