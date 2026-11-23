export const range = count => Array.from({ length: count }, (_, i) => i);
export const blank = (count, value = 0) => Array(count).fill(value);
export const eachCell = side => range(side * side);
export const rowAt = (index, side) => Math.floor(index / side);
export const columnAt = (index, side) => index % side;
export const sameLine = (actual, expected) => actual.length === expected.length && actual.every((value, i) => value === expected[i]);

export function orthogonal(index, side) {
  const row = rowAt(index, side);
  const column = columnAt(index, side);
  return [
    ...(row ? [index - side] : []),
    ...(column ? [index - 1] : []),
    ...(column < side - 1 ? [index + 1] : []),
    ...(row < side - 1 ? [index + side] : []),
  ];
}

export function lines(board, side) {
  const indices = range(side);
  return {
    rows: indices.map(row => board.slice(row * side, (row + 1) * side)),
    columns: indices.map(column => indices.map(row => board[row * side + column])),
  };
}

function connected(start, neighbors) {
  const found = new Set([start]);
  for (const current of found) for (const neighbor of neighbors(current)) found.add(neighbor);
  return found;
}

export function runs(line) {
  const groups = [];
  let length = 0;
  for (const value of [...line, 0]) {
    if (value === 1) length++;
    else if (length) {
      groups.push(length);
      length = 0;
    }
  }
  return groups;
}

const woven = [
  ['00100', '01110', '11111', '01110', '00100'],
  ['00011000', '00111100', '01111110', '00011000', '01111110', '11111111', '00011000', '00011000'],
  ['0010110000', '0001010000', '0010010000', '0100010000', '1111110000', '0000010000', '1111111110', '0111111100', '0011111000', '0001110000'],
];

export const nonograms = woven.map(pattern => {
  const side = pattern.length;
  const { rows, columns } = lines(pattern.join('').split('').map(Number), side);
  return { side, rows: rows.map(runs), columns: columns.map(runs) };
});

export function nonogramMatches(board, { side, rows, columns }) {
  const current = lines(board, side);
  return {
    rows: current.rows.map((line, i) => sameLine(runs(line), rows[i])),
    columns: current.columns.map((line, i) => sameLine(runs(line), columns[i])),
  };
}

const islands = [
  [0, 0, 2], [0, 3, 2], [0, 6, 2], [2, 0, 3], [2, 4, 4], [2, 6, 5],
  [4, 1, 1], [4, 3, 3], [4, 6, 5], [6, 0, 2], [6, 1, 3], [6, 4, 2], [6, 6, 2],
];

const bridgeEdges = islands.flatMap(([row, column], a) => {
  const right = islands.findIndex(([r, c]) => r === row && c > column);
  const below = islands.findIndex(([r, c]) => c === column && r > row);
  return [right, below].filter(b => b >= 0).map(b => [a, b]);
});

function between(value, start, end) {
  return value > start && value < end;
}

function bridgesCross(first, second) {
  const [a, b] = first.map(i => islands[i]);
  const [c, d] = second.map(i => islands[i]);
  if ((a[0] === b[0]) === (c[0] === d[0])) return false;
  if (a[0] !== b[0]) return bridgesCross(second, first);
  return between(c[1], a[1], b[1]) && between(a[0], c[0], d[0]);
}

export const hashi = {
  side: 7,
  islands,
  edges: bridgeEdges,
  crosses: bridgeEdges.map(edge => bridgeEdges.flatMap((other, i) => bridgesCross(edge, other) ? [i] : [])),
};

export function bridgeTotals(board) {
  const counts = blank(islands.length);
  bridgeEdges.forEach(([a, b], i) => {
    counts[a] += board[i];
    counts[b] += board[i];
  });
  return counts;
}

export function bridgesSolved(board) {
  if (bridgeTotals(board).some((count, i) => count !== islands[i][2])) return false;
  const neighbors = islands.map(() => []);
  for (const [i, [a, b]] of bridgeEdges.entries()) {
    if (!board[i]) continue;
    if (hashi.crosses[i].some(j => board[j])) return false;
    neighbors[a].push(b);
    neighbors[b].push(a);
  }
  return connected(0, i => neighbors[i]).size === islands.length;
}

const loopSide = 5;
const dotSide = loopSide + 1;
const horizontalEdges = dotSide * loopSide;
const loopEdges = [
  ...range(horizontalEdges).map(i => {
    const a = rowAt(i, loopSide) * dotSide + columnAt(i, loopSide);
    return [a, a + 1];
  }),
  ...range(horizontalEdges).map(i => [i, i + dotSide]),
];
const loopCells = eachCell(loopSide).map(i => {
  const vertical = horizontalEdges + rowAt(i, loopSide) * dotSide + columnAt(i, loopSide);
  return [i, i + loopSide, vertical, vertical + 1];
});
const interior = ['01100', '11110', '11010', '10011', '11011'].join('');
const omittedLoopClues = new Set([1, 7, 12, 16, 20, 24]);
const loopClues = loopCells.map((edges, i) => {
  if (omittedLoopClues.has(i)) return null;
  const neighbors = [i >= loopSide ? i - loopSide : -1, i + loopSide,
    i % loopSide ? i - 1 : -1, i % loopSide < loopSide - 1 ? i + 1 : -1];
  return edges.filter((_, direction) => interior[i] !== (interior[neighbors[direction]] ?? '0')).length;
});

export const slitherlink = { side: loopSide, edges: loopEdges, cells: loopCells, clues: loopClues };

export function loopAnalysis(board) {
  const counts = loopCells.map(edges => edges.filter(i => board[i] === 1).length);
  const neighbors = eachCell(dotSide).map(() => []);
  for (const [i, [a, b]] of loopEdges.entries()) {
    if (board[i] !== 1) continue;
    neighbors[a].push(b);
    neighbors[b].push(a);
  }
  const used = neighbors.filter(line => line.length).length;
  const start = neighbors.findIndex(line => line.length);
  const matches = loopClues.map((clue, i) => clue === null || counts[i] === clue);
  const solved = used > 0
    && matches.every(Boolean)
    && neighbors.every(line => line.length === 0 || line.length === 2)
    && connected(start, i => neighbors[i]).size === used;
  return { counts, matches, solved };
}

const tentSide = 7;
const trees = new Set([9, 4, 15, 24, 28, 33, 40, 13, 44]);
export const tents = { side: tentSide, trees, rows: [2, 0, 3, 0, 2, 1, 1], columns: [1, 1, 1, 2, 1, 1, 2] };

export function tentAnalysis(board) {
  const placed = eachCell(tentSide).filter(i => board[i] === 1);
  const conflicts = new Set();
  const current = lines(board, tentSide);
  const rows = current.rows.map(line => line.filter(value => value === 1).length);
  const columns = current.columns.map(line => line.filter(value => value === 1).length);
  for (const [ix, a] of placed.entries()) {
    if (!orthogonal(a, tentSide).some(i => trees.has(i)) || trees.has(a)) conflicts.add(a);
    for (const b of placed.slice(ix + 1)) {
      if (Math.abs(rowAt(a, tentSide) - rowAt(b, tentSide)) <= 1
          && Math.abs(columnAt(a, tentSide) - columnAt(b, tentSide)) <= 1) {
        conflicts.add(a);
        conflicts.add(b);
      }
    }
  }
  const owners = new Map();
  function assign(tree, seen) {
    for (const tent of orthogonal(tree, tentSide)) {
      if (board[tent] !== 1 || seen.has(tent)) continue;
      seen.add(tent);
      if (!owners.has(tent) || assign(owners.get(tent), seen)) {
        owners.set(tent, tree);
        return true;
      }
    }
    return false;
  }
  const matching = [...trees].filter(tree => assign(tree, new Set())).length;
  const solved = conflicts.size === 0 && matching === trees.size
    && sameLine(rows, tents.rows) && sameLine(columns, tents.columns);
  return { rows, columns, conflicts, matching, solved };
}

const towerSide = 4;
const towerSolution = [2, 1, 4, 3, 4, 3, 2, 1, 1, 4, 3, 2, 3, 2, 1, 4];

function visible(line) {
  let highest = 0;
  let count = 0;
  for (const height of line) {
    if (height <= highest) continue;
    highest = height;
    count++;
  }
  return count;
}

function skyline(board) {
  const { rows, columns } = lines(board, towerSide);
  return {
    top: columns.map(visible),
    left: rows.map(visible),
    right: rows.map(line => visible([...line].reverse())),
    bottom: columns.map(line => visible([...line].reverse())),
  };
}

export const skyscrapers = { side: towerSide, clues: skyline(towerSolution) };

export function towerAnalysis(board) {
  const { rows, columns } = lines(board, towerSide);
  const counts = skyline(board);
  const conflicts = new Set();
  rows.forEach((line, row) => line.forEach((value, column) => {
    if (value && (line.filter(i => i === value).length > 1 || columns[column].filter(i => i === value).length > 1)) {
      conflicts.add(row * towerSide + column);
    }
  }));
  const solved = board.every(Boolean) && conflicts.size === 0
    && Object.entries(counts).every(([direction, line]) => sameLine(line, skyscrapers.clues[direction]));
  return { counts, rows, columns, conflicts, solved };
}

const rectangleSide = 6;
const rectangleClues = new Map([[6, 6], [2, 4], [15, 4], [11, 6], [25, 6], [27, 2], [34, 4], [32, 4]]);
export const shikaku = { side: rectangleSide, clues: rectangleClues };

export function rectangleSelection(board, a, b) {
  const firstRow = Math.min(rowAt(a, rectangleSide), rowAt(b, rectangleSide));
  const lastRow = Math.max(rowAt(a, rectangleSide), rowAt(b, rectangleSide));
  const firstColumn = Math.min(columnAt(a, rectangleSide), columnAt(b, rectangleSide));
  const lastColumn = Math.max(columnAt(a, rectangleSide), columnAt(b, rectangleSide));
  const cells = eachCell(rectangleSide).filter(i => {
    const row = rowAt(i, rectangleSide);
    const column = columnAt(i, rectangleSide);
    return row >= firstRow && row <= lastRow && column >= firstColumn && column <= lastColumn;
  });
  if (cells.some(i => board[i] !== -1)) return { error: '这个矩形会覆盖已划定的格子。' };
  const clues = cells.filter(i => rectangleClues.has(i));
  if (clues.length !== 1) return { error: '每个矩形需要恰好一个数字。' };
  if (rectangleClues.get(clues[0]) !== cells.length) return { error: '矩形面积必须等于里面的数字。' };
  return { cells, clue: clues[0] };
}

export const nurikabe = { side: 6, clues: new Map([[0, 3], [4, 1], [12, 1], [34, 6], [25, 2], [30, 1]]) };

export function islandAnalysis(board) {
  const { side, clues } = nurikabe;
  const indices = eachCell(side);
  const conflicts = new Set();
  let complete = 0;
  const sea = indices.filter(i => board[i] === 1);
  const land = new Set(indices.filter(i => board[i] === 2));
  for (const i of land) {
    const island = connected(i, j => orthogonal(j, side).filter(k => board[k] === 2));
    const numbers = [...island].filter(j => clues.has(j));
    for (const j of island) land.delete(j);
    if (numbers.length > 1 || (numbers.length === 1 && island.size > clues.get(numbers[0]))) {
      for (const j of island) conflicts.add(j);
    }
    if (numbers.length === 1 && island.size === clues.get(numbers[0])) complete++;
  }
  for (const i of sea) {
    if (rowAt(i, side) === side - 1 || columnAt(i, side) === side - 1) continue;
    const square = [i, i + 1, i + side, i + side + 1];
    if (square.every(j => board[j] === 1)) square.forEach(j => conflicts.add(j));
  }
  const solved = board.every(Boolean) && conflicts.size === 0 && complete === clues.size && sea.length > 0
    && board.filter(value => value === 2).length === [...clues.values()].reduce((sum, value) => sum + value, 0)
    && connected(sea[0], i => orthogonal(i, side).filter(j => board[j] === 1)).size === sea.length;
  return { conflicts, complete, solved };
}

const mapSide = 7;
const regions = ['GAAAAAH', 'GABBBAH', 'GABDDAH', 'GACDCAH', 'EECCCFH', 'EECFFFH', 'IIFFFFH'].join('');
const regionNames = [...new Set(regions)].sort();
const mapEdges = regionNames.map(name => new Set());
eachCell(mapSide).forEach(i => {
  const a = regionNames.indexOf(regions[i]);
  for (const neighbor of orthogonal(i, mapSide)) {
    const b = regionNames.indexOf(regions[neighbor]);
    if (a !== b) mapEdges[a].add(b);
  }
});

export const colorMap = { side: mapSide, regions, names: regionNames, edges: mapEdges };

export function mapAnalysis(board) {
  const conflicts = new Set();
  for (const [i, neighbors] of mapEdges.entries()) {
    if (board[i] && [...neighbors].some(j => board[j] === board[i])) conflicts.add(i);
  }
  return { conflicts, solved: board.every(Boolean) && conflicts.size === 0 };
}

const gallerySide = 6;
const walls = new Map([[2, 1], [9, 0], [12, null], [16, 1], [19, 0], [23, null], [26, null], [29, 1], [33, 1]]);
const galleryCells = eachCell(gallerySide).filter(i => !walls.has(i));

function sight(start) {
  const cells = [];
  for (const [dr, dc] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    let row = rowAt(start, gallerySide) + dr;
    let column = columnAt(start, gallerySide) + dc;
    while (row >= 0 && column >= 0 && row < gallerySide && column < gallerySide) {
      const next = row * gallerySide + column;
      if (walls.has(next)) break;
      cells.push(next);
      row += dr;
      column += dc;
    }
  }
  return cells;
}

const sightlines = new Map(galleryCells.map(i => [i, sight(i)]));
export const akari = { side: gallerySide, walls, cells: galleryCells };

export function galleryAnalysis(board) {
  const lit = new Set();
  const conflicts = new Set();
  const counts = new Map();
  for (const lamp of galleryCells.filter(i => board[i] === 1)) {
    lit.add(lamp);
    for (const i of sightlines.get(lamp)) {
      lit.add(i);
      if (board[i] === 1) conflicts.add(i);
    }
  }
  for (const [i, clue] of walls) {
    if (clue === null) continue;
    counts.set(i, orthogonal(i, gallerySide).filter(j => board[j] === 1).length);
  }
  const solved = lit.size === galleryCells.length && conflicts.size === 0
    && [...counts].every(([i, count]) => count === walls.get(i));
  return { lit, conflicts, counts, solved };
}

const binarySide = 6;
const binaryClues = [...'010011..11.0.........1.0....11......'].map(value => value === '.' ? 0 : Number(value) + 1);
export const takuzu = { side: binarySide, clues: binaryClues };

function binaryLineConflicts(line, index, all) {
  const half = line.length / 2;
  return [1, 2].some(value => line.filter(v => v === value).length > half)
    || line.some((value, i) => value && value === line[i + 1] && value === line[i + 2])
    || (line.every(Boolean) && all.some((other, i) => index !== i && sameLine(line, other)));
}

export function binaryAnalysis(board) {
  const { rows, columns } = lines(board, binarySide);
  const wrongRows = rows.map(binaryLineConflicts);
  const wrongColumns = columns.map(binaryLineConflicts);
  return {
    wrongRows,
    wrongColumns,
    solved: board.every(Boolean) && !wrongRows.some(Boolean) && !wrongColumns.some(Boolean),
  };
}
