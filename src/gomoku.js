export const SIZE = 15;
export const BLACK = 1;
export const WHITE = 2;
const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];

export function createGame() {
  return { board: Array(SIZE * SIZE).fill(0), moves: [], turn: BLACK, winner: 0, winningLine: [], draw: false };
}

export function inside(row, col) {
  return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

export function findWinningLine(board, row, col, player) {
  for (const [dr, dc] of DIRECTIONS) {
    const line = [[row, col]];
    for (const direction of [-1, 1]) {
      let r = row + dr * direction;
      let c = col + dc * direction;
      while (inside(r, c) && board[r * SIZE + c] === player) {
        line.push([r, c]);
        r += dr * direction;
        c += dc * direction;
      }
    }
    if (line.length >= 5) return line.map(([r, c]) => r * SIZE + c);
  }
  return [];
}

export function placeStone(game, row, col) {
  if (!inside(row, col) || game.winner || game.draw || game.board[row * SIZE + col]) return null;
  const board = [...game.board];
  board[row * SIZE + col] = game.turn;
  const moves = [...game.moves, { row, col, player: game.turn }];
  const winningLine = findWinningLine(board, row, col, game.turn);
  const winner = winningLine.length ? game.turn : 0;
  return { board, moves, turn: 3 - game.turn, winner, winningLine, draw: !winner && moves.length === SIZE * SIZE };
}

export function replayMoves(moves) {
  if (!Array.isArray(moves) || moves.length > SIZE * SIZE) throw new Error('无效的对局记录');
  let game = createGame();
  for (const move of moves) {
    if (!move || move.player !== game.turn) throw new Error('落子顺序不正确');
    const next = placeStone(game, move.row, move.col);
    if (!next) throw new Error('对局记录包含无效落子');
    game = next;
  }
  return game;
}

export function undoMoves(game, count = 1) {
  return replayMoves(game.moves.slice(0, Math.max(0, game.moves.length - count)));
}

export function undoCount(game, humanPlayer) {
  if (!game.moves.length) return 0;
  const lastHumanMove = game.moves.findLastIndex(move => move.player === humanPlayer);
  return lastHumanMove < 0 ? 0 : game.moves.length - lastHumanMove;
}

export function coordinate(row, col) {
  return `${String.fromCharCode(65 + col)}${SIZE - row}`;
}

function candidates(board) {
  const found = new Set();
  for (let index = 0; index < board.length; index++) {
    if (!board[index]) continue;
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const r = row + dr;
        const c = col + dc;
        if (inside(r, c) && !board[r * SIZE + c]) found.add(r * SIZE + c);
      }
    }
  }
  return found.size ? [...found] : board[112] === 0 ? [112] : [];
}

// Score each line through a potential move, including broken threes and fours.
function attackScore(board, index, player) {
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  let score = 0;
  let strongThreats = 0;
  board[index] = player;
  for (const [dr, dc] of DIRECTIONS) {
    let line = '';
    for (let offset = -5; offset <= 5; offset++) {
      const r = row + dr * offset;
      const c = col + dc * offset;
      line += !inside(r, c) ? '2' : board[r * SIZE + c] === player ? '1' : board[r * SIZE + c] === 0 ? '0' : '2';
    }
    if (line.includes('11111')) { board[index] = 0; return 1_000_000; }
    let value = 0;
    if (line.includes('011110')) value = 80_000;
    else if (['01111', '11110', '11011', '11101', '10111'].some(pattern => line.includes(pattern))) value = 9_000;
    else if (['01110', '010110', '011010'].some(pattern => line.includes(pattern))) value = 3_500;
    else if (['001110', '011100', '01011', '11010', '10110', '01101'].some(pattern => line.includes(pattern))) value = 450;
    else if (['001100', '001010', '010100'].some(pattern => line.includes(pattern))) value = 140;
    else if (line.includes('010')) value = 20;
    if (value >= 3_500) strongThreats++;
    score += value;
  }
  board[index] = 0;
  if (strongThreats > 1) score += 20_000;
  return score;
}

function rankMoves(board, player) {
  return candidates(board).map(index => {
    const attack = attackScore(board, index, player);
    const defense = attackScore(board, index, 3 - player);
    const distance = Math.abs(Math.floor(index / SIZE) - 7) + Math.abs(index % SIZE - 7);
    return { index, attack, defense, score: attack + defense * 1.08 - distance };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
}

export function chooseMove(game, difficulty = 'normal', random = Math.random) {
  if (game.winner || game.draw) return null;
  const board = [...game.board];
  const ranked = rankMoves(board, game.turn);
  if (!ranked.length) return null;
  // Always take a win before blocking; even the relaxed opponent understands five in a row.
  const winning = ranked.find(move => move.attack >= 1_000_000);
  const blocking = ranked.find(move => move.defense >= 1_000_000);
  let choice = winning || blocking;
  if (!choice && difficulty === 'easy') {
    const top = ranked.slice(0, 4);
    choice = top[Math.min(top.length - 1, Math.floor(Math.max(0, random()) * top.length))];
  }
  if (!choice && difficulty === 'hard') {
    choice = ranked.slice(0, 10).map(move => {
      board[move.index] = game.turn;
      const response = rankMoves(board, 3 - game.turn)[0];
      board[move.index] = 0;
      return { ...move, searchScore: move.score - (response?.score ?? 0) * 0.85 };
    }).sort((a, b) => b.searchScore - a.searchScore)[0];
  }
  choice ??= ranked[0];
  return { row: Math.floor(choice.index / SIZE), col: choice.index % SIZE };
}
