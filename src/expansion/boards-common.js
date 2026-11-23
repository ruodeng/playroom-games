export const orthogonal = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const diagonal = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
export const around = [...orthogonal, ...diagonal];
export const coord = (x, y, w, h) => x < 0 || x >= w || y < 0 || y >= h ? -1 : y * w + x;
export const countSide = (board, side) => board.reduce((n, p) => n + (p * side > 0), 0);
export const won = (winner, reason) => ({ winner, reason });

export function step(from, dx, dy, w, h) {
  return coord(from % w + dx, Math.floor(from / w) + dy, w, h);
}

export function slide(board, move) {
  const next = board.slice();
  next[move.to] = next[move.from];
  next[move.from] = 0;
  return next;
}

// Repetition includes side to move and any rights that affect available moves.
function position(state) {
  if (state.fen) return state.fen.split(' ').slice(0, 4).join(' ');
  return [state.board.join(','), state.turn, state.reserve, state.forced, state.taking].join('/');
}

export function initial(board, fields = {}, remember = false) {
  const state = { board, turn: 1, ply: 0, quiet: 0, last: null, ...fields };
  if (remember) state.history = [{ key: position(state), mover: 0, check: false }];
  return state;
}

export function advance(state, move, fields, record = true) {
  const next = {
    ...state, turn: -state.turn, ply: state.ply + 1, quiet: state.quiet + 1, last: move, ...fields,
  };
  if (record && state.history) {
    const key = position(next);
    next.history = [...state.history, { key, mover: state.turn, check: Boolean(next.checked) }];
    const matches = [];
    next.history.forEach((entry, i) => { if (entry.key === key) matches.push(i); });
    if (matches.length >= 3) next.cycle = next.history.slice(matches.at(-3) + 1);
  }
  return next;
}

export function stuckOrRepeat(state, moves) {
  if (!moves.length) return won(-state.turn, '无合法走法');
  if (state.cycle) return won(0, '同一局面出现三次');
  return null;
}

// Values are always from the human side's perspective. Extra turns retain that side's objective.
export function search(engine, state, moves, random, depth, width = Infinity) {
  const payoff = (outcome, remaining) => outcome.winner * (1_000_000 + remaining);
  function ordered(s, choices) {
    return engine.priority ? choices.slice().sort((a, b) => engine.priority(s, b) - engine.priority(s, a)) : choices;
  }
  function visit(s, remaining, alpha, beta) {
    if (s.outcome) return payoff(s.outcome, remaining);
    if (remaining <= 0) return engine.evaluate(s);
    const replies = engine.moves(s);
    const end = engine.result(s, replies);
    if (end) return payoff(end, remaining);
    let best = s.turn === 1 ? -Infinity : Infinity;
    for (const reply of ordered(s, replies).slice(0, width)) {
      const value = visit(engine.apply(s, reply, false), remaining - 1, alpha, beta);
      if (s.turn === 1) { best = Math.max(best, value); alpha = Math.max(alpha, best); }
      else { best = Math.min(best, value); beta = Math.min(beta, best); }
      if (alpha >= beta) break;
    }
    return best;
  }
  const shuffled = moves.map(move => ({ move, tie: random() })).sort((a, b) => a.tie - b.tie).map(entry => entry.move);
  let best = -Infinity, choice = shuffled[0];
  for (const move of ordered(state, shuffled)) {
    const alpha = state.turn === 1 ? best : -Infinity, beta = state.turn === -1 ? -best : Infinity;
    const value = state.turn * visit(engine.apply(state, move, false), depth - 1, alpha, beta);
    if (value > best) { best = value; choice = move; }
  }
  return choice;
}
