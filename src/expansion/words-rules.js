export function shuffled(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export const crosswordColumns = 7;

export function buildCrossword(entries) {
  const board = new Map();
  const clues = entries.map(([row, col, direction, word, text], index) => {
    const cells = [...word].map((letter, offset) => {
      const cellRow = row + (direction === '纵' ? offset : 0);
      const cellCol = col + (direction === '横' ? offset : 0);
      const position = cellRow * crosswordColumns + cellCol;
      const cell = board.get(position) ?? { answer: letter, clues: [], starts: [] };
      cell.clues.push(index);
      if (offset === 0) cell.starts.push(index + 1);
      board.set(position, cell);
      return position;
    });
    return { cells, direction, text, word };
  });
  return { board, clues };
}

export function oneLetterApart(left, right) {
  return left.length === right.length && [...left].filter((letter, index) => letter !== right[index]).length === 1;
}

export function shortestLadder(start, goal, bank) {
  const paths = [[start]];
  const used = new Set([start]);
  for (const path of paths) {
    const last = path.at(-1);
    if (last === goal) return path;
    for (const word of bank) {
      if (used.has(word) || !oneLetterApart(last, word)) continue;
      used.add(word);
      paths.push([...path, word]);
    }
  }
  return null;
}

const SEARCH_SIZE = 7;
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function buildSearch(placements, random) {
  const letters = Array(SEARCH_SIZE ** 2).fill('');
  for (const [word, , row, col, dy, dx] of placements) {
    [...word].forEach((letter, index) => {
      const position = (row + index * dy) * SEARCH_SIZE + col + index * dx;
      letters[position] = letter;
    });
  }
  return letters.map(letter => letter || alphabet[Math.floor(random() * alphabet.length)]);
}

export function searchLine(start, end) {
  const row = Math.floor(start / SEARCH_SIZE);
  const col = start % SEARCH_SIZE;
  const dy = Math.floor(end / SEARCH_SIZE) - row;
  const dx = end % SEARCH_SIZE - col;
  if ((dy && dx && Math.abs(dy) !== Math.abs(dx)) || start === end) return [];
  const step = Math.sign(dy) * SEARCH_SIZE + Math.sign(dx);
  return Array.from({ length: Math.max(Math.abs(dx), Math.abs(dy)) + 1 }, (_, index) => start + index * step);
}

export function rotateLetters(text, shift) {
  return text.replace(/[A-Z]/g, letter => alphabet[(alphabet.indexOf(letter) + shift + 26) % 26]);
}

export function truthCount(statements, suspect) {
  return statements.filter(([, trueIf]) => trueIf.includes(suspect)).length;
}

export const operators = ['+', '−', '×', '÷'];

export function numberCard(value) {
  return { numerator: value, denominator: 1, expression: String(value) };
}

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

export function combine(left, operator, right) {
  const { numerator: a, denominator: b } = left;
  const { numerator: c, denominator: d } = right;
  let numerator;
  let denominator;
  switch (operator) {
    case '+': [numerator, denominator] = [a * d + c * b, b * d]; break;
    case '−': [numerator, denominator] = [a * d - c * b, b * d]; break;
    case '×': [numerator, denominator] = [a * c, b * d]; break;
    case '÷': [numerator, denominator] = [a * d, b * c]; break;
    default: return null;
  }
  if (!denominator) return null;
  const divisor = gcd(Math.abs(numerator), Math.abs(denominator)) * Math.sign(denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor, expression: `(${left.expression} ${operator} ${right.expression})` };
}

export function isTwentyFour(card) {
  return card.numerator === 24 * card.denominator;
}

export function solveTwentyFour(cards) {
  if (cards.length === 1) return isTwentyFour(cards[0]) ? cards[0].expression : null;
  for (const [left, a] of cards.entries()) {
    for (const [right, b] of cards.entries()) {
      if (left === right) continue;
      for (const operator of operators) {
        const result = combine(a, operator, b);
        if (!result) continue;
        const remaining = cards.filter((_, index) => index !== left && index !== right);
        const solution = solveTwentyFour([...remaining, result]);
        if (solution) return solution;
      }
    }
  }
  return null;
}
