import {
  akari, binaryAnalysis, blank, bridgeTotals, bridgesSolved, colorMap, columnAt, eachCell,
  galleryAnalysis, hashi, islandAnalysis, loopAnalysis, mapAnalysis, nonogramMatches, nonograms,
  nurikabe, range, rectangleSelection, rowAt, shikaku, skyscrapers, slitherlink, takuzu, tentAnalysis,
  tents, towerAnalysis,
} from './paper-models.js';

const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
const position = (index, side) => [rowAt(index, side), columnAt(index, side)];
const coordinate = (index, side) => `第 ${rowAt(index, side) + 1} 行第 ${columnAt(index, side) + 1} 列`;
const clueText = values => values.join(' ') || '0';

function button(text, className = '') {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = text;
  return element;
}

function setCell(element, text, label, classes = '') {
  element.textContent = text;
  element.className = `paper-cell ${classes}`;
  element.setAttribute('aria-label', label);
}

function place(element, row, column) {
  element.style.gridRow = row + 1;
  element.style.gridColumn = column + 1;
}

function statusClass(count, target) {
  if (count === target) return 'paper-matched';
  return count > target ? 'paper-conflict' : '';
}

function createSurface(host, api) {
  const root = document.createElement('div');
  root.className = 'paper-game';
  const toolbar = document.createElement('div');
  toolbar.className = 'x-toolbar paper-toolbar';
  const stage = document.createElement('div');
  stage.className = 'paper-stage';
  const actions = document.createElement('div');
  actions.className = 'x-actions paper-actions';
  const note = document.createElement('p');
  note.className = 'x-note paper-note';
  note.setAttribute('role', 'status');
  root.append(toolbar, stage, actions, note);
  host.replaceChildren(root);

  const controls = [];
  let indexByButton = new Map();
  let focused;
  let grid;
  let state;
  let paint;
  let useCell;
  let useKey;
  let clearSelection;
  let finished = false;
  const history = [];
  const listen = (element, event, fn) => element.addEventListener(event, fn, { signal: api.signal });

  function focusCell(cell, move = false) {
    if (focused) focused.element.tabIndex = -1;
    focused = cell;
    cell.element.tabIndex = 0;
    if (move) cell.element.focus({ preventScroll: true });
  }

  const tool = (parent, label, act) => {
    const element = button(label, 'paper-tool');
    parent.append(element);
    controls.push(element);
    listen(element, 'click', () => {
      if (!finished) act();
    });
    return element;
  };
  const undo = tool(actions, '撤回', () => {
    if (history.length === 0) return;
    clearSelection?.();
    state = history.pop();
    undo.disabled = history.length === 0;
    paint(state);
  });
  undo.disabled = true;

  listen(root, 'click', event => {
    const cell = indexByButton.get(event.target.closest?.('button'));
    if (cell && !finished) {
      focusCell(cell);
      useCell(cell.index);
    }
  });
  listen(root, 'focusin', event => {
    const cell = indexByButton.get(event.target);
    if (cell && !finished) focusCell(cell);
  });
  listen(root, 'keydown', event => {
    if (finished || event.ctrlKey || event.metaKey || event.altKey) return;
    const cell = indexByButton.get(event.target);
    if (!cell) return;
    const direction = arrows[event.key];
    if (direction) {
      const [dr, dc] = direction;
      let nearest;
      let distance = Infinity;
      for (const other of indexByButton.values()) {
        const dy = other.row - cell.row;
        const dx = other.column - cell.column;
        const forward = dr * dy + dc * dx;
        const across = Math.abs(dc * dy + dr * dx);
        if (forward <= 0 || forward + across * 0.7 >= distance) continue;
        distance = forward + across * 0.7;
        nearest = other;
      }
      if (nearest) focusCell(nearest, true);
    } else if (event.key.toLowerCase() === 'z' && !undo.disabled) {
      undo.click();
    } else if (event.key !== 'Home' && event.key !== 'End' && !useKey?.(cell.index, event.key)) {
      return;
    } else if (event.key === 'Home' || event.key === 'End') {
      const cells = [...indexByButton.values()];
      focusCell(event.key === 'Home' ? cells[0] : cells.at(-1), true);
    }
    event.preventDefault();
    event.stopPropagation();
  });

  return {
    api,
    tool: (label, act) => tool(toolbar, label, act),
    palette(items, name = '标记工具') {
      const group = document.createElement('div');
      group.className = 'paper-palette';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', name);
      toolbar.append(group);
      let value = items[0][0];
      const options = items.map(([id, text, className]) => {
        const element = tool(group, text, () => {
          value = id;
          update();
        });
        if (className) element.classList.add(className);
        return [id, element];
      });
      function update() {
        options.forEach(([id, element]) => element.setAttribute('aria-pressed', String(id === value)));
      }
      update();
      return { get value() { return value; } };
    },
    grid(columns, label, classes = '') {
      grid = document.createElement('div');
      grid.className = `x-grid paper-board ${classes}`;
      grid.style.setProperty('--cols', columns);
      grid.setAttribute('role', 'group');
      grid.setAttribute('aria-label', label);
      stage.replaceChildren(grid);
      indexByButton = new Map();
      focused = null;
      return grid;
    },
    cell(index, row, column, text = '', label = '') {
      const element = button(text, 'paper-cell');
      if (label) element.setAttribute('aria-label', label);
      place(element, row, column);
      grid.append(element);
      indexByButton.set(element, { element, index, row, column });
      element.tabIndex = -1;
      if (!focused) focusCell(indexByButton.get(element));
      return element;
    },
    clue(row, column, text, label = '') {
      const element = document.createElement('span');
      element.className = 'paper-clue';
      element.textContent = text;
      if (label) {
        element.setAttribute('role', 'img');
        element.setAttribute('aria-label', label);
      } else {
        element.setAttribute('aria-hidden', 'true');
      }
      place(element, row, column);
      grid.append(element);
      return element;
    },
    start(initial, config) {
      state = initial;
      history.length = 0;
      undo.disabled = true;
      ({ paint, useCell, useKey, clearSelection } = config);
      paint(state);
    },
    get state() { return state; },
    commit(next) {
      history.push(state);
      state = next;
      undo.disabled = false;
      paint(state);
    },
    write(index, value) {
      if (state[index] === value) return;
      const next = [...state];
      next[index] = value;
      this.commit(next);
    },
    toggle(index, value) {
      this.write(index, state[index] === value ? 0 : value);
    },
    note(text) {
      if (note.textContent !== text) note.textContent = text;
    },
    end(message) {
      if (finished) return;
      finished = true;
      note.textContent = message;
      for (const element of controls) element.disabled = true;
      for (const element of indexByButton.keys()) element.disabled = true;
      api.end(message, Math.max(1, Math.round(api.elapsed())));
    },
  };
}

function startNonogram(ui) {
  let level = 0;
  let practice = false;
  const sizes = nonograms.map(({ side }, i) => ui.tool(`${side}×${side}`, () => {
    if (i === level) return;
    level = i;
    if (!practice) ui.api.unrank();
    practice = true;
    setup();
  }));
  const mode = ui.palette([[1, '涂黑'], [2, '标空']]);
  setup();

  function setup() {
    const puzzle = nonograms[level];
    const { side, rows, columns } = puzzle;
    sizes.forEach((element, i) => element.setAttribute('aria-pressed', String(level === i)));
    const grid = ui.grid(side + 1, '数织棋盘', 'paper-nonogram');
    grid.style.setProperty('--paper-side', side);
    const rowClues = rows.map((line, i) => ui.clue(i + 1, 0, clueText(line), `第 ${i + 1} 行线索 ${clueText(line)}`));
    const colClues = columns.map((line, i) => ui.clue(0, i + 1, line.join('\n') || '0', `第 ${i + 1} 列线索 ${clueText(line)}`));
    const cells = eachCell(side).map(i => {
      const [row, column] = position(i, side);
      return ui.cell(i, row + 1, column + 1);
    });
    ui.start(blank(cells.length), {
      useCell: i => ui.toggle(i, mode.value),
      paint(board) {
        cells.forEach((cell, i) => {
          const [row, column] = position(i, side);
          const value = board[i];
          const mark = ['', '黑格', '标空'][value] || '未涂';
          setCell(cell, value === 2 ? '×' : '', `${coordinate(i, side)}，${mark}，行线索 ${clueText(rows[row])}，列线索 ${clueText(columns[column])}`, ['','paper-dark','paper-cross'][value]);
          cell.classList.toggle('paper-rule-right', (column + 1) % 5 === 0 && column < side - 1);
          cell.classList.toggle('paper-rule-bottom', (row + 1) % 5 === 0 && row < side - 1);
        });
        const match = nonogramMatches(board, puzzle);
        rowClues.forEach((clue, i) => clue.classList.toggle('paper-matched', match.rows[i]));
        colClues.forEach((clue, i) => clue.classList.toggle('paper-matched', match.columns[i]));
        const checked = [...match.rows, ...match.columns].filter(Boolean).length;
        ui.note(`${checked} / ${side * 2} 条行列符合线索。${practice ? ' 当前为练习。' : ''}`);
        if (checked === side * 2) ui.end('所有行列都符合线索，图案完成。');
      },
    });
  }
}

function startHashi(ui) {
  const { side, islands, edges, crosses } = hashi;
  const grid = ui.grid(side, '数桥棋盘', 'paper-hashi');
  grid.style.setProperty('--paper-side', side);
  const bridges = edges.map(([a, b]) => {
    const [row, column] = islands[a];
    const [endRow, endColumn] = islands[b];
    const element = document.createElement('span');
    element.className = `paper-bridge ${row === endRow ? 'paper-bridge-across' : 'paper-bridge-down'}`;
    element.setAttribute('aria-hidden', 'true');
    for (const [name, value] of [['r', row], ['c', column], ['dr', endRow - row], ['dc', endColumn - column]]) {
      element.style.setProperty(`--paper-${name}`, value);
    }
    grid.append(element);
    return element;
  });
  const cells = islands.map(([row, column], i) => ui.cell(i, row, column));
  let selected = null;
  let notice = '';
  const clearSelection = () => { selected = null; notice = ''; };

  function paint(board) {
    const totals = bridgeTotals(board);
    bridges.forEach((bridge, i) => { bridge.dataset.count = board[i]; });
    islands.forEach(([row, column, target], i) => {
      const links = edges.flatMap(([a, b], index) => {
        if (!board[index] || (a !== i && b !== i)) return [];
        const [r, c] = islands[a === i ? b : a];
        return [`至第 ${r + 1} 行第 ${c + 1} 列 ${board[index]} 座`];
      });
      setCell(cells[i], target, `第 ${row + 1} 行第 ${column + 1} 列，岛屿，已架 ${totals[i]} / ${target} 座${links.length ? '，' + links.join('，') : ''}`, `paper-island ${statusClass(totals[i], target)} ${selected === i ? 'paper-selected' : ''}`);
      cells[i].setAttribute('aria-pressed', String(selected === i));
    });
    const matched = totals.filter((value, i) => value === islands[i][2]).length;
    ui.note(notice || (matched === islands.length
      ? '桥数正确。再检查所有岛屿是否互通。'
      : `已满足 ${matched} / ${islands.length} 座岛屿。先点一座岛，再点另一座。`));
    if (bridgesSolved(board)) ui.end('桥数都正确，群岛已连通。');
  }

  ui.start(blank(edges.length), {
    paint,
    clearSelection,
    useKey(_, key) {
      if (key !== 'Escape' || selected === null) return false;
      clearSelection();
      paint(ui.state);
      return true;
    },
    useCell(i) {
      notice = '';
      if (selected === null || selected === i) {
        selected = selected === i ? null : i;
        paint(ui.state);
        return;
      }
      const a = Math.min(selected, i);
      const b = Math.max(selected, i);
      const index = edges.findIndex(edge => edge[0] === a && edge[1] === b);
      if (index < 0) {
        selected = i;
        notice = '只能连接同行或同列中没有岛屿阻隔的两座岛。';
      } else if (ui.state[index] === 0 && crosses[index].some(j => ui.state[j])) {
        notice = '这座桥会和已经架好的桥相交。';
      } else {
        clearSelection();
        ui.write(index, (ui.state[index] + 1) % 3);
        return;
      }
      paint(ui.state);
    },
  });
}

function startLoop(ui) {
  const { side, edges, clues } = slitherlink;
  const dotSide = side + 1;
  const mode = ui.palette([[1, '画线'], [2, '标记 ×']]);
  const grid = ui.grid(side * 2 + 1, '数回点阵', 'paper-loop');
  grid.style.setProperty('--paper-side', side);
  eachCell(dotSide).forEach(i => {
    const [row, column] = position(i, dotSide);
    const dot = ui.clue(row * 2, column * 2, '');
    dot.classList.add('paper-dot');
  });
  const numbers = clues.map((clue, i) => {
    const [row, column] = position(i, side);
    return ui.clue(row * 2 + 1, column * 2 + 1, clue ?? '', clue === null ? '' : `${coordinate(i, side)}的四边需要 ${clue} 条线`);
  });
  const edgeViews = edges.map(([a, b], i) => {
    const [row, column] = position(a, dotSide);
    const [otherRow, otherColumn] = position(b, dotSide);
    const horizontal = row === otherRow;
    const cell = ui.cell(i, row + otherRow, column + otherColumn);
    return { cell, horizontal, label: `${coordinate(a, dotSide)}点到${coordinate(b, dotSide)}点的边` };
  });
  ui.start(blank(edges.length), {
    useCell: i => ui.toggle(i, mode.value),
    paint(board) {
      edgeViews.forEach(({ cell, horizontal, label }, i) => {
        const value = board[i];
        setCell(cell, value === 2 ? '×' : '', `${label}，${['未画线', '有线', '已打叉'][value]}`, `paper-edge ${horizontal ? 'paper-edge-across' : 'paper-edge-down'}`);
        cell.dataset.mark = value;
      });
      const { counts, matches, solved } = loopAnalysis(board);
      numbers.forEach((element, i) => {
        element.className = `paper-clue ${clues[i] === null ? '' : statusClass(counts[i], clues[i])}`;
      });
      const total = clues.filter(clue => clue !== null).length;
      const matched = matches.filter((ok, i) => ok && clues[i] !== null).length;
      ui.note(matched === total
        ? '数字都已满足。检查这些线是否只围成一个环。'
        : `${matched} / ${total} 个数字的边数正确。`);
      if (solved) ui.end('所有线索都已满足，闭环完成。');
    },
  });
}

function startTents(ui) {
  const { side, trees, rows, columns } = tents;
  const mode = ui.palette([[1, '放帐篷'], [2, '标草地']]);
  ui.grid(side + 1, '帐篷与树棋盘', 'paper-lined paper-camp');
  const rowClues = rows.map((clue, i) => ui.clue(i + 1, 0, clue, `第 ${i + 1} 行需要 ${clue} 顶帐篷`));
  const colClues = columns.map((clue, i) => ui.clue(0, i + 1, clue, `第 ${i + 1} 列需要 ${clue} 顶帐篷`));
  const cells = eachCell(side).map(i => {
    const [row, column] = position(i, side);
    if (!trees.has(i)) return ui.cell(i, row + 1, column + 1);
    const tree = ui.clue(row + 1, column + 1, '♣', `${coordinate(i, side)}，树`);
    tree.className = 'paper-cell paper-tree';
    return null;
  });
  ui.start(blank(cells.length), {
    useCell: i => ui.toggle(i, mode.value),
    paint(board) {
      const result = tentAnalysis(board);
      cells.forEach((cell, i) => {
        if (!cell) return;
        const [row, column] = position(i, side);
        const value = board[i];
        setCell(cell, ['', '△', '·'][value], `${coordinate(i, side)}，${['空格', '帐篷', '草地'][value]}，行线索 ${rows[row]}，列线索 ${columns[column]}${result.conflicts.has(i) ? '，帐篷位置冲突' : ''}`, `${['', 'paper-tent', 'paper-grass'][value]} ${result.conflicts.has(i) ? 'paper-conflict' : ''}`);
      });
      rowClues.forEach((element, i) => { element.className = `paper-clue ${statusClass(result.rows[i], rows[i])}`; });
      colClues.forEach((element, i) => { element.className = `paper-clue ${statusClass(result.columns[i], columns[i])}`; });
      ui.note(result.conflicts.size
        ? '标红的帐篷挨着另一顶帐篷，或周围没有树。'
        : `已为 ${result.matching} / ${trees.size} 棵树配到帐篷。`);
      if (result.solved) ui.end('帐篷已经排好，每棵树都有一顶。');
    },
  });
}

function startTowers(ui) {
  const { side, clues } = skyscrapers;
  const mode = ui.palette([[1, '1'], [2, '2'], [3, '3'], [4, '4'], [0, '擦除']], '楼高');
  const grid = ui.grid(side + 2, '摩天楼棋盘', 'paper-lined paper-towers');
  grid.style.setProperty('--paper-side', side);
  const edgeClues = { top: [], left: [], right: [], bottom: [] };
  const edges = [
    ['top', '从上方', '↓', i => [0, i + 1]], ['left', '从左侧', '→', i => [i + 1, 0]],
    ['right', '从右侧', '←', i => [i + 1, side + 1]], ['bottom', '从下方', '↑', i => [side + 1, i + 1]],
  ];
  for (const [direction, label, arrow, locate] of edges) {
    edgeClues[direction] = clues[direction].map((clue, i) => ui.clue(...locate(i), `${arrow}${clue}`, `${label}看见 ${clue} 栋楼`));
  }
  const cells = eachCell(side).map(i => {
    const [row, column] = position(i, side);
    return ui.cell(i, row + 1, column + 1);
  });
  ui.start(blank(cells.length), {
    useCell: i => ui.write(i, mode.value),
    useKey(i, key) {
      if (/^[1-4]$/.test(key)) ui.write(i, Number(key));
      else if (key === '0' || key === 'Delete' || key === 'Backspace') ui.write(i, 0);
      else return false;
      return true;
    },
    paint(board) {
      const result = towerAnalysis(board);
      cells.forEach((cell, i) => {
        const [row, column] = position(i, side);
        const value = board[i];
        setCell(cell, value || '', `${coordinate(i, side)}，${value ? value + ' 层' : '空格'}，上 ${clues.top[column]}、下 ${clues.bottom[column]}、左 ${clues.left[row]}、右 ${clues.right[row]}${result.conflicts.has(i) ? '，行列有重复楼高' : ''}`, `paper-tower ${result.conflicts.has(i) ? 'paper-conflict' : ''}`);
        cell.style.setProperty('--paper-height', value);
      });
      let matched = 0;
      for (const [direction] of edges) {
        const vertical = direction === 'top' || direction === 'bottom';
        edgeClues[direction].forEach((element, i) => {
          const filled = (vertical ? result.columns : result.rows)[i].every(Boolean);
          const correct = clues[direction][i] === result.counts[direction][i];
          if (filled && correct) matched++;
          element.className = `paper-clue ${filled ? (correct ? 'paper-matched' : 'paper-conflict') : ''}`;
        });
      }
      ui.note(result.conflicts.size ? '同一行或列里有重复的楼高。' : `${matched} / ${side * 4} 个方向的楼数符合线索。`);
      if (result.solved) ui.end('每个方向看见的楼数都对了。');
    },
  });
}

function borders(element, index, side, same) {
  const [row, column] = position(index, side);
  element.classList.toggle('paper-border-top', row === 0 || !same(index - side));
  element.classList.toggle('paper-border-right', column === side - 1 || !same(index + 1));
  element.classList.toggle('paper-border-bottom', row === side - 1 || !same(index + side));
  element.classList.toggle('paper-border-left', column === 0 || !same(index - 1));
}

function standardCells(ui, side) {
  return eachCell(side).map(i => ui.cell(i, ...position(i, side)));
}

function startRectangles(ui) {
  const { side, clues } = shikaku;
  const groups = [...clues.keys()];
  ui.grid(side, '矩形分割棋盘', 'paper-regions paper-shikaku');
  const cells = standardCells(ui, side);
  let corner = null;
  let notice = '';
  const clearSelection = () => { corner = null; notice = ''; };
  function paint(board) {
    cells.forEach((cell, i) => {
      const clue = clues.get(i);
      const group = board[i];
      const color = groups.indexOf(group) % 4 + 1;
      const status = group >= 0 ? `属于面积 ${clues.get(group)} 的矩形` : '未分配';
      setCell(cell, clue ?? '', `${coordinate(i, side)}${clue ? '，线索 ' + clue : ''}，${status}${corner === i ? '，已选为起点' : ''}`, `${group >= 0 ? 'paper-region paper-color-' + color : ''} ${corner === i ? 'paper-selected' : ''}`);
      cell.setAttribute('aria-pressed', String(corner === i));
      if (group >= 0) borders(cell, i, side, j => board[j] === group);
    });
    const filled = board.filter(i => i >= 0).length;
    ui.note(notice || (corner === null
      ? `已划定 ${filled} / ${cells.length} 格。请选择矩形的起点。`
      : `起点为${coordinate(corner, side)}。请选择对角格。`));
    if (filled === cells.length) ui.end('矩形刚好铺满棋盘，面积都正确。');
  }

  ui.start(blank(cells.length, -1), {
    paint,
    clearSelection,
    useKey(_, key) {
      if (key !== 'Escape' || corner === null) return false;
      clearSelection();
      paint(ui.state);
      return true;
    },
    useCell(i) {
      const board = ui.state;
      notice = '';
      if (corner === null) {
        if (board[i] >= 0) {
          ui.commit(board.map(group => group === board[i] ? -1 : group));
          return;
        }
        corner = i;
      } else {
        const result = rectangleSelection(board, corner, i);
        if (result.error) {
          notice = result.error + ' 请选择另一个角，或撤销起点。';
        } else {
          clearSelection();
          const next = [...board];
          for (const cell of result.cells) next[cell] = result.clue;
          ui.commit(next);
          return;
        }
      }
      paint(board);
    },
  });
  ui.tool('撤销起点', () => {
    clearSelection();
    paint(ui.state);
  });
}

function startIslands(ui) {
  const { side, clues } = nurikabe;
  const mode = ui.palette([[1, '海水'], [2, '陆地']]);
  ui.grid(side, '孤岛成海棋盘', 'paper-lined paper-nurikabe');
  const cells = eachCell(side).map(i => {
    const [row, column] = position(i, side);
    return clues.has(i)
      ? ui.clue(row, column, clues.get(i), `${coordinate(i, side)}，面积 ${clues.get(i)} 的岛`)
      : ui.cell(i, row, column);
  });
  ui.start(cells.map((_, i) => clues.has(i) ? 2 : 0), {
    useCell: i => ui.toggle(i, mode.value),
    paint(board) {
      const result = islandAnalysis(board);
      cells.forEach((cell, i) => {
        const value = board[i];
        const clue = clues.get(i);
        const label = clue ? '面积 ' + clue + ' 的岛' : ['未划分', '海水', '陆地'][value];
        setCell(cell, clue ?? ['', '≈', '·'][value], `${coordinate(i, side)}，${label}${result.conflicts.has(i) ? '，划分冲突' : ''}`, `${['', 'paper-sea', 'paper-land'][value]} ${result.conflicts.has(i) ? 'paper-conflict' : ''}`);
      });
      const remaining = board.filter(value => !value).length;
      ui.note(result.conflicts.size
        ? '出现了 2×2 海格、相连的编号岛，或超出面积的陆地。'
        : remaining
          ? `已有 ${result.complete} / ${clues.size} 座岛面积正确，还剩 ${remaining} 个空格。`
          : '检查海水是否连通，以及每片陆地是否有数字且面积正确。');
      if (result.solved) ui.end('每座岛的面积都对，海水也连成一片。');
    },
  });
}

function startMap(ui) {
  const { side, regions, names } = colorMap;
  const colors = ['未着色', '蓝', '赭', '绿', '紫'];
  const mode = ui.palette([
    ...colors.slice(1).map((label, i) => [i + 1, label, 'paper-color-' + (i + 1)]),
    [0, '擦除'],
  ], '着色工具');
  ui.grid(side, '四色地图棋盘', 'paper-regions paper-map');
  const cells = standardCells(ui, side);
  const anchors = names.map(name => {
    const matching = eachCell(side).filter(i => regions[i] === name);
    const center = [0, 1].map(axis => matching.reduce((sum, i) => sum + position(i, side)[axis], 0) / matching.length);
    return matching.reduce((nearest, i) => {
      const distance = index => position(index, side).reduce((sum, n, axis) => sum + (n - center[axis]) ** 2, 0);
      return distance(i) < distance(nearest) ? i : nearest;
    });
  });
  ui.start(blank(names.length), {
    useCell: i => ui.write(names.indexOf(regions[i]), mode.value),
    paint(board) {
      const { conflicts, solved } = mapAnalysis(board);
      cells.forEach((cell, i) => {
        const name = regions[i];
        const region = names.indexOf(name);
        const value = board[region];
        const mark = anchors[region] === i ? name + (value ? ' ' + colors[value] : '') : '';
        setCell(cell, mark, `${coordinate(i, side)}，区域 ${name}，${colors[value]}${conflicts.has(region) ? '，与相邻区同色' : ''}`, `paper-region paper-color-${value} ${conflicts.has(region) ? 'paper-region-conflict' : ''}`);
        borders(cell, i, side, j => regions[j] === name);
      });
      ui.note(conflicts.size
        ? '标红区域和它的邻区用了同一种颜色。'
        : `已着色 ${board.filter(Boolean).length} / ${names.length} 个区域。`);
      if (solved) ui.end('所有区域都已着色，相邻区域颜色各异。');
    },
  });
}

function startGallery(ui) {
  const { side, walls, cells: floor } = akari;
  const mode = ui.palette([[1, '放灯'], [2, '标记不放灯']]);
  ui.grid(side, '美术馆棋盘', 'paper-lined paper-gallery');
  const cells = eachCell(side).map(i => {
    const [row, column] = position(i, side);
    return walls.has(i) ? ui.clue(row, column, walls.get(i) ?? '', coordinate(i, side)) : ui.cell(i, row, column);
  });
  ui.start(blank(cells.length), {
    useCell: i => ui.toggle(i, mode.value),
    paint(board) {
      const { lit, conflicts, counts, solved } = galleryAnalysis(board);
      cells.forEach((cell, i) => {
        if (walls.has(i)) {
          const clue = walls.get(i);
          const count = counts.get(i);
          const label = clue === null ? '无数字的墙' : `数字墙 ${clue}，已相邻 ${count} 盏灯`;
          setCell(cell, clue ?? '', `${coordinate(i, side)}，${label}`, `paper-wall ${clue === null ? '' : statusClass(count, clue)}`);
          return;
        }
        const value = board[i];
        const label = ['', '，有灯', '，标记不放灯'][value];
        setCell(cell, ['', '☼', '·'][value], `${coordinate(i, side)}，${lit.has(i) ? '已照亮' : '未照亮'}${label}${conflicts.has(i) ? '，和另一盏灯互相照到' : ''}`, `${lit.has(i) ? 'paper-lit' : ''} ${conflicts.has(i) ? 'paper-conflict' : ''}`);
      });
      ui.note(conflicts.size
        ? '标红的灯照到了彼此。'
        : `已照亮 ${lit.size} / ${floor.length} 格。数字墙的相邻灯数也要符合线索。`);
      if (solved) ui.end('展室全部亮了，灯数也符合数字墙。');
    },
  });
}

function startBinary(ui) {
  const { side, clues } = takuzu;
  const mode = ui.palette([[2, '黑'], [1, '白'], [0, '擦除']], '黑白工具');
  ui.grid(side, '黑白二进制棋盘', 'paper-lined paper-binary');
  const cells = clues.map((clue, i) => clue
    ? ui.clue(...position(i, side), '•', coordinate(i, side))
    : ui.cell(i, ...position(i, side)));
  ui.start([...clues], {
    useCell: i => ui.write(i, mode.value),
    useKey(i, key) {
      if (key === 'b' || key === 'B') ui.write(i, 2);
      else if (key === 'w' || key === 'W') ui.write(i, 1);
      else if (key === '0' || key === 'Delete' || key === 'Backspace') ui.write(i, 0);
      else return false;
      return true;
    },
    paint(board) {
      const result = binaryAnalysis(board);
      cells.forEach((cell, i) => {
        const [row, column] = position(i, side);
        const value = board[i];
        const conflict = result.wrongRows[row] || result.wrongColumns[column];
        const fixed = clues[i] ? '，题目线索' : '';
        setCell(cell, clues[i] ? '•' : '', `${coordinate(i, side)}，${['空格', '白格', '黑格'][value]}${fixed}${conflict ? '，行或列有冲突' : ''}`, `${['', 'paper-white', 'paper-dark'][value]} ${conflict ? 'paper-conflict' : ''}`);
      });
      ui.note(result.wrongRows.some(Boolean) || result.wrongColumns.some(Boolean)
        ? '标红行列出现了三连、颜色超量或重复。'
        : `还剩 ${board.filter(value => !value).length} 个空格。`);
      if (result.solved) ui.end('黑白平衡，行列都符合规则。');
    },
  });
}

const starters = {
  nonogram: startNonogram,
  hashi: startHashi,
  slitherlink: startLoop,
  'tents-and-trees': startTents,
  skyscrapers: startTowers,
  shikaku: startRectangles,
  nurikabe: startIslands,
  'four-color-map': startMap,
  akari: startGallery,
  takuzu: startBinary,
};

export function mount(id, host, api) {
  starters[id](createSurface(host, api));
}
