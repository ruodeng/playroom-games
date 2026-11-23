export const SOLITAIRE_SUITS = ['♠', '♥', '♣', '♦'];
export const SOLITAIRE_SUIT_NAMES = ['黑桃', '红桃', '梅花', '方块'];

export function solitaireRank(rank) { return ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][rank]; }
export function solitaireRed(card) { return card.suit === 1 || card.suit === 3; }

export function createSolitaire(random = Math.random) {
  const deck = Array.from({ length: 52 }, (_, id) => ({ id, suit: Math.floor(id / 13), rank: id % 13 + 1, faceUp: false }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const tableau = Array.from({ length: 7 }, (_, column) => Array.from({ length: column + 1 }, (_, index) => ({ ...deck.pop(), faceUp: index === column })));
  return { stock: deck, waste: [], tableau, foundations: [[], [], [], []], moves: 0, score: 0, status: 'playing', previous: null };
}

export function solitaireSource(game, source) {
  if (!source) return [];
  if (source.pile === 'waste') return game.waste.slice(-1);
  if (source.pile === 'foundation' && Number.isInteger(source.column)) return game.foundations[source.column]?.slice(-1) || [];
  if (source.pile !== 'tableau' || !Number.isInteger(source.column) || !Number.isInteger(source.index)) return [];
  const column = game.tableau[source.column];
  if (!column || source.index < 0 || source.index >= column.length) return [];
  return column.slice(source.index);
}

function validStack(cards) {
  return cards.length > 0 && cards.every((card, index) => card.faceUp && (!index || (cards[index - 1].rank === card.rank + 1 && solitaireRed(cards[index - 1]) !== solitaireRed(card))));
}

function accepts(game, cards, destination) {
  if (!destination || !Number.isInteger(destination.column)) return false;
  const card = cards[0];
  if (!card) return false;
  if (destination.pile === 'foundation') {
    const pile = game.foundations[destination.column];
    return !!pile && cards.length === 1 && card.suit === destination.column && card.rank === pile.length + 1;
  }
  if (destination.pile !== 'tableau') return false;
  const pile = game.tableau[destination.column];
  if (!pile) return false;
  const top = pile.at(-1);
  return top ? top.faceUp && top.rank === card.rank + 1 && solitaireRed(top) !== solitaireRed(card) : card.rank === 13;
}

export function canMoveSolitaire(game, source, destination) {
  if (game.status !== 'playing' || !source || !destination || (source.pile === destination.pile && source.column === destination.column)) return false;
  const cards = solitaireSource(game, source);
  return validStack(cards) && accepts(game, cards, destination);
}

export function solitaireMoves(game) {
  if (game.status !== 'playing') return [];
  const sources = [{ pile: 'waste' }];
  game.tableau.forEach((column, col) => column.forEach((card, index) => { if (card.faceUp) sources.push({ pile: 'tableau', column: col, index }); }));
  game.foundations.forEach((_, column) => sources.push({ pile: 'foundation', column }));
  const destinations = [...Array.from({ length: 7 }, (_, column) => ({ pile: 'tableau', column })), ...Array.from({ length: 4 }, (_, column) => ({ pile: 'foundation', column }))];
  return sources.flatMap(source => destinations.filter(destination => canMoveSolitaire(game, source, destination)).map(destination => ({ source, destination })));
}

// Draw-one recycling makes every card in stock and waste reachable. Checking
// those cards avoids declaring a loss just because today's waste top is blocked.
export function hasSolitaireMoves(game) {
  const playing = { ...game, status: 'playing' };
  if (solitaireMoves(playing).length) return true;
  const destinations = [...Array.from({ length: 7 }, (_, column) => ({ pile: 'tableau', column })), ...Array.from({ length: 4 }, (_, column) => ({ pile: 'foundation', column }))];
  return [...game.stock, ...game.waste].some(card => destinations.some(destination => accepts(game, [{ ...card, faceUp: true }], destination)));
}

function finish(game) {
  const total = game.foundations.reduce((sum, pile) => sum + pile.length, 0);
  return { ...game, score: total * 10, status: total === 52 ? 'won' : hasSolitaireMoves(game) ? 'playing' : 'lost' };
}

export function drawSolitaire(game) {
  if (game.status !== 'playing' || (!game.stock.length && !game.waste.length)) return game;
  if (!game.stock.length) {
    return finish({ ...game, stock: [...game.waste].reverse().map(card => ({ ...card, faceUp: false })), waste: [], moves: game.moves + 1, previous: game });
  }
  return finish({ ...game, stock: game.stock.slice(0, -1), waste: [...game.waste, { ...game.stock.at(-1), faceUp: true }], moves: game.moves + 1, previous: game });
}

export function moveSolitaire(game, source, destination) {
  if (!canMoveSolitaire(game, source, destination)) return game;
  const cards = solitaireSource(game, source);
  let waste = game.waste;
  const tableau = game.tableau.map(column => [...column]);
  const foundations = game.foundations.map(pile => [...pile]);
  if (source.pile === 'waste') waste = waste.slice(0, -1);
  else if (source.pile === 'foundation') foundations[source.column].pop();
  else {
    tableau[source.column] = tableau[source.column].slice(0, source.index);
    const top = tableau[source.column].at(-1);
    if (top && !top.faceUp) tableau[source.column][tableau[source.column].length - 1] = { ...top, faceUp: true };
  }
  (destination.pile === 'tableau' ? tableau : foundations)[destination.column].push(...cards);
  return finish({ ...game, waste, tableau, foundations, moves: game.moves + 1, previous: game });
}

export function undoSolitaire(game) { return game.previous || game; }
