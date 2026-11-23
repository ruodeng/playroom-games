import { Chess } from './boards-chess-vendor.js';
import { advance, coord, diagonal, initial, orthogonal, search, slide, step, won } from './boards-common.js';

const [GENERAL, ADVISER, ELEPHANT, HORSE, CHARIOT, CANNON, SOLDIER] = [1, 2, 3, 4, 5, 6, 7];
const horseSteps = [[-2, -1], [-2, 1], [-1, -2], [1, -2], [2, -1], [2, 1], [-1, 2], [1, 2]];
const values = [0, 10_000, 200, 200, 425, 920, 460, 105];
const crossed = (side, y) => side === 1 ? y < 5 : y > 4;
const inPalace = (side, x, y) => x >= 3 && x <= 5 && (side === 1 ? y >= 7 && y <= 9 : y >= 0 && y <= 2);
const xiStep = (i, dx, dy) => step(i, dx, dy, 9, 10);

export function xiangqiCheck(board, side) {
  const king = board.indexOf(side * GENERAL);
  if (king < 0) return true;
  const enemy = -side, row = Math.floor(king / 9);
  for (const [dx, dy] of orthogonal) {
    let seen = 0, distance = 0;
    for (let i = xiStep(king, dx, dy); i >= 0; i = xiStep(i, dx, dy)) {
      distance++;
      if (!board[i]) continue;
      if (!seen && (board[i] === enemy * CHARIOT || (board[i] === enemy * GENERAL && (!dx || distance === 1)))) return true;
      if (seen && board[i] === enemy * CANNON) return true;
      if (++seen === 2) break;
    }
  }
  for (const [dx, dy] of horseSteps) {
    const from = xiStep(king, dx, dy);
    if (from < 0 || board[from] !== enemy * HORSE) continue;
    const leg = xiStep(from, Math.abs(dx) === 2 ? -Math.sign(dx) : 0, Math.abs(dy) === 2 ? -Math.sign(dy) : 0);
    if (!board[leg]) return true;
  }
  if (board[xiStep(king, 0, enemy)] === enemy * SOLDIER) return true;
  return crossed(enemy, row) && [-1, 1].some(dx => board[xiStep(king, dx, 0)] === enemy * SOLDIER);
}

function xiMoves(state) {
  const { board, turn } = state, moves = [];
  for (let from = 0; from < board.length; from++) {
    const kind = board[from] * turn;
    if (kind <= 0) continue;
    const x = from % 9, y = Math.floor(from / 9);
    const add = to => {
      if (to < 0 || board[to] * turn > 0 || Math.abs(board[to]) === GENERAL) return;
      const move = { from, to };
      if (!xiangqiCheck(slide(board, move), turn)) moves.push(move);
    };
    if (kind === CHARIOT || kind === CANNON) {
      for (const [dx, dy] of orthogonal) {
        let screen = false;
        for (let i = xiStep(from, dx, dy); i >= 0; i = xiStep(i, dx, dy)) {
          if (!board[i]) { if (!screen) add(i); continue; }
          if (kind === CHARIOT || screen) { add(i); break; }
          screen = true;
        }
      }
    } else if (kind === GENERAL || kind === ADVISER) {
      for (const [dx, dy] of kind === GENERAL ? orthogonal : diagonal) {
        if (inPalace(turn, x + dx, y + dy)) add(xiStep(from, dx, dy));
      }
    } else if (kind === ELEPHANT) {
      for (const [dx, dy] of diagonal) {
        if (!board[xiStep(from, dx, dy)] && !crossed(turn, y + 2 * dy)) add(xiStep(from, 2 * dx, 2 * dy));
      }
    } else if (kind === HORSE) {
      for (const [dx, dy] of horseSteps) {
        const leg = xiStep(from, Math.abs(dx) === 2 ? Math.sign(dx) : 0, Math.abs(dy) === 2 ? Math.sign(dy) : 0);
        if (!board[leg]) add(xiStep(from, dx, dy));
      }
    } else if (kind === SOLDIER) {
      add(xiStep(from, 0, -turn));
      if (crossed(turn, y)) { add(xiStep(from, -1, 0)); add(xiStep(from, 1, 0)); }
    }
  }
  return moves;
}

function xiEvaluation(state) {
  let score = state.checked ? -state.turn * 20 : 0;
  state.board.forEach((piece, i) => {
    if (!piece) return;
    const kind = Math.abs(piece), side = Math.sign(piece);
    const x = i % 9, y = Math.floor(i / 9), progress = side === 1 ? 9 - y : y;
    let bonus = 0;
    if (kind === SOLDIER) bonus = progress * 3 + (crossed(side, y) ? 55 - Math.abs(x - 4) * 5 : 0);
    else if ([HORSE, CANNON, CHARIOT].includes(kind)) {
      bonus = 15 - 2 * Math.abs(x - 4) + Math.min(progress, 6) * 2;
      if (kind === HORSE && (x === 0 || x === 8)) bonus -= 15;
    }
    score += side * (values[kind] + bonus);
  });
  return score;
}

export const xiangqi = {
  create() {
    const board = Array(90).fill(0), back = [CHARIOT, HORSE, ELEPHANT, ADVISER, GENERAL, ADVISER, ELEPHANT, HORSE, CHARIOT];
    for (const side of [-1, 1]) {
      const row = y => side === -1 ? y : 9 - y;
      back.forEach((p, x) => { board[coord(x, row(0), 9, 10)] = side * p; });
      for (const x of [1, 7]) board[row(2) * 9 + x] = side * CANNON;
      for (const x of [0, 2, 4, 6, 8]) board[row(3) * 9 + x] = side * SOLDIER;
    }
    return initial(board, { checked: false }, true);
  },
  moves: xiMoves,
  apply(state, move, record = true) {
    const board = slide(state.board, move);
    return advance(state, move, { board, quiet: state.board[move.to] ? 0 : state.quiet + 1, checked: xiangqiCheck(board, -state.turn) }, record);
  },
  result(state, moves) {
    if (!moves.length) return won(-state.turn, xiangqiCheck(state.board, state.turn) ? '将死' : '困毙');
    if (state.cycle) {
      const checkingSides = [1, -1].filter(side => {
        const turns = state.cycle.filter(entry => entry.mover === side);
        return turns.length && turns.every(entry => entry.check);
      });
      return checkingSides.length === 1 ? won(-checkingSides[0], '单方长将') : won(0, '同一局面出现三次');
    }
    return state.quiet >= 120 ? won(0, '连续六十回合未吃子') : null;
  },
  evaluate: xiEvaluation,
  priority(state, move) {
    return values[Math.abs(state.board[move.to])] * 8 - (state.board[move.to] ? values[Math.abs(state.board[move.from])] / 15 : 0)
      + (Math.floor(move.from / 9) - Math.floor(move.to / 9)) * state.turn + 4 - Math.abs(move.to % 9 - 4);
  },
  choose(state, moves, random, level = 1) {
    return search(this, state, moves, random, [1, 2, 3][level], level === 2 ? 14 : Infinity);
  },
};

const chessPieces = ['', 'p', 'n', 'b', 'r', 'q', 'k'];
const chessValues = [0, 100, 320, 335, 505, 915, 20_000];
const chessIndex = square => (8 - Number(square[1])) * 8 + square.charCodeAt(0) - 97;
function chessBoard(game) {
  return game.board().flat().map(piece => piece ? (piece.color === 'w' ? 1 : -1) * chessPieces.indexOf(piece.type) : 0);
}

export function chessStart(fen) {
  const game = new Chess(fen);
  return initial(chessBoard(game), { game, fen: game.fen(), checked: game.inCheck(), turn: game.turn() === 'w' ? 1 : -1 }, true);
}

export const chess = {
  create: chessStart,
  moves(state) {
    return state.game.moves({ verbose: true }).map(move => ({
      from: chessIndex(move.from), to: chessIndex(move.to), promotion: move.promotion, after: move.after,
      captured: chessPieces.indexOf(move.captured || ''), san: move.san,
    }));
  },
  apply(state, move, record = true) {
    const game = new Chess(move.after);
    return advance(state, move, {
      game, fen: game.fen(), board: chessBoard(game), checked: game.inCheck(),
      outcome: move.san.endsWith('#') ? won(state.turn, '将死对方国王') : null,
    }, record);
  },
  result(state, moves) {
    if (state.outcome) return state.outcome;
    if (!moves.length) return state.checked ? won(-state.turn, '将死对方国王') : won(0, '逼和');
    if (state.game.isInsufficientMaterial()) return won(0, '子力不足');
    if (state.cycle) return won(0, '同一局面出现三次');
    return state.game.isDrawByFiftyMoves() ? won(0, '五十回合未动兵或吃子') : null;
  },
  evaluate(state) {
    let score = state.checked ? -state.turn * 17 : 0;
    state.board.forEach((piece, i) => {
      if (!piece) return;
      const kind = Math.abs(piece), side = Math.sign(piece), x = i % 8, y = Math.floor(i / 8);
      const center = 7 - Math.abs(3.5 - x) - Math.abs(3.5 - y);
      const progress = side === 1 ? 7 - y : y;
      const bonus = kind === 1 ? progress * 6 + center * 2 : kind === 2 || kind === 3 ? center * 7 : 0;
      score += side * (chessValues[kind] + bonus);
    });
    return score;
  },
  priority(state, move) {
    return (move.san.endsWith('#') ? 100_000 : 0) + chessValues[move.captured] * 8
      + (move.promotion ? chessValues[chessPieces.indexOf(move.promotion)] : 0) + (move.san.endsWith('+') ? 60 : 0);
  },
  choose(state, moves, random) { return search(this, state, moves, random, 2, 10); },
};
