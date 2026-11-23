import { advance, initial, orthogonal, step, won } from './boards-common.js';

const neighbors = Array.from({ length: 81 }, (_, i) => orthogonal.map(([dx, dy]) => step(i, dx, dy, 9, 9)).filter(n => n >= 0));
const keyOf = board => board.join(',');
const komi = 6.5;

function group(board, start) {
  const color = board[start], stones = [start], seen = new Set(stones), liberties = new Set();
  for (let i = 0; i < stones.length; i++) {
    for (const n of neighbors[stones[i]]) {
      if (!board[n]) liberties.add(n);
      else if (board[n] === color && !seen.has(n)) { seen.add(n); stones.push(n); }
    }
  }
  return { stones, liberties };
}

function placement(state, to) {
  if (state.board[to]) return null;
  const side = state.turn, board = state.board.slice(), examined = new Set();
  let captured = 0;
  board[to] = side;
  for (const n of neighbors[to]) {
    if (board[n] !== -side || examined.has(n)) continue;
    const enemy = group(board, n);
    enemy.stones.forEach(i => examined.add(i));
    if (!enemy.liberties.size) {
      enemy.stones.forEach(i => { board[i] = 0; });
      captured += enemy.stones.length;
    }
  }
  const own = group(board, to);
  if (!own.liberties.size) return null;
  const key = keyOf(board);
  if (state.positions.has(key)) return null;
  return { to, board, key, captured, liberties: own.liberties.size };
}

export function goScore(board) {
  const area = [0, 0], seen = new Set();
  board.forEach((stone, i) => {
    if (stone) { area[stone === 1 ? 0 : 1]++; return; }
    if (seen.has(i)) return;
    const region = [i], borders = new Set();
    seen.add(i);
    for (let k = 0; k < region.length; k++) {
      for (const n of neighbors[region[k]]) {
        if (board[n]) borders.add(board[n]);
        else if (!seen.has(n)) { seen.add(n); region.push(n); }
      }
    }
    if (borders.size === 1) area[borders.has(1) ? 0 : 1] += region.length;
  });
  return [area[0], area[1] + komi];
}

function influence(state, move) {
  const { to, board, captured, liberties } = move, { turn } = state;
  const old = state.board, near = neighbors[to];
  let value = captured * 35, friends = 0, enemies = 0;
  const seen = new Set();
  for (const n of near) {
    if (old[n] === turn) friends++;
    if (old[n] === -turn) enemies++;
    if (!old[n] || seen.has(n)) continue;
    const previous = group(old, n);
    previous.stones.forEach(i => seen.add(i));
    if (old[n] === turn && previous.liberties.size === 1 && liberties > 1) value += 16 + Math.min(previous.stones.length, 6) * 5;
    if (board[n] === -turn && group(board, n).liberties.size === 1) value += previous.stones.length * 2 + 4;
  }
  if (liberties === 1 && !captured) value -= 40;
  if (!enemies && friends === near.length) return value - 70;
  if (!enemies && friends >= near.length - 1) value -= 13;
  const x = to % 9, y = Math.floor(to / 9), edge = Math.min(x, 8 - x, y, 8 - y);
  value += Math.min(edge, 2) * 2 + Math.min(liberties, 4) + (enemies ? 3 : 0) - friends;
  if (state.ply < 20) {
    const occupied = old.flatMap((p, i) => p ? [Math.abs(i % 9 - x) + Math.abs(Math.floor(i / 9) - y)] : []);
    const spacing = occupied.length ? Math.min(...occupied) : 3;
    value += 7 - Math.abs(spacing - 3) * 3 - Math.abs(edge - 2) * 2;
  }
  return value;
}

export const go = {
  create() {
    const board = Array(81).fill(0);
    return initial(board, { positions: new Set([keyOf(board)]), passes: 0, captures: [0, 0] });
  },
  moves(state) {
    if (state.passes >= 2) return [];
    const moves = [];
    for (let i = 0; i < 81; i++) {
      const move = placement(state, i);
      if (move) moves.push(move);
    }
    moves.push({ kind: 'pass' });
    return moves;
  },
  apply(state, move) {
    if (move.kind === 'pass') return advance(state, move, { passes: state.passes + 1 });
    const captures = state.captures.slice();
    captures[state.turn === 1 ? 0 : 1] += move.captured;
    const positions = new Set(state.positions);
    positions.add(move.key);
    return advance(state, { to: move.to }, { board: move.board, positions, captures, passes: 0 });
  },
  result(state) {
    if (state.passes < 2) return null;
    const [black, white] = goScore(state.board);
    return won(Math.sign(black - white), '双方停着，黑 ' + black + ' 分，白 ' + white + ' 分（含贴分）');
  },
  choose(state, moves, random) {
    const pass = moves.find(move => move.kind === 'pass');
    if (state.passes) {
      const [black, white] = goScore(state.board);
      if (Math.sign(black - white) === state.turn) return pass;
    }
    let best = 0, choice = pass;
    for (const move of moves) {
      if (move === pass) continue;
      const value = influence(state, move) + random() * 2;
      if (value > best) { best = value; choice = move; }
    }
    return choice;
  },
};
