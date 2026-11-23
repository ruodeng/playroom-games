import { arrowIndex, canvas, control, element, grid, keyboard, labelCell, line, position, seconds } from './spatial-ui.js';

const knotEdges = [
  ...Array.from({ length: 10 }, (_, i) => [i, (i + 1) % 10]),
  [0, 2], [2, 4], [4, 6], [6, 8], [8, 0], [2, 6],
];
const knotPoints = Array.from({ length: 10 }, (_, i) => {
  const angle = (2 * i / 10 - 0.5) * Math.PI;
  return [200 + 154 * Math.cos(angle), 200 + 154 * Math.sin(angle)];
});
export const knotInitial = [3, 8, 0, 6, 1, 9, 4, 2, 7, 5];

export function segmentsCross(a, b, c, d) {
  const side = ([x1, y1], [x2, y2], [x, y]) => (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1);
  return side(a, b, c) * side(a, b, d) < -1e-8 && side(c, d, a) * side(c, d, b) < -1e-8;
}

export function knotCrossings(order) {
  const points = order.map((_, number) => knotPoints[order.indexOf(number)]);
  const crossings = new Set();
  let count = 0;
  knotEdges.forEach(([a, b], first) => {
    for (let second = first + 1; second < knotEdges.length; second++) {
      const [c, d] = knotEdges[second];
      if (segmentsCross(points[a], points[b], points[c], points[d])) {
        crossings.add(first);
        crossings.add(second);
        count++;
      }
    }
  });
  return { points, crossings, count };
}

export function mountKnot(host, api) {
  const order = [...knotInitial];
  let selected = -1;
  let swaps = 0;
  let finished = false;
  const board = element(host, 'div', 'sp-diagram sp-knot');
  board.setAttribute('role', 'group');
  board.setAttribute('aria-label', '圆形绳结棋盘');
  const [, context] = canvas(board, 400, 400, '连接同编号节点的绳子');
  const nodes = order.map((_, i) => {
    const node = control(board, api, '', () => swap(i), 'sp-node');
    const [x, y] = knotPoints[i];
    position(node, x / 4, y / 4);
    return node;
  });
  keyboard(board, api, (key, event) => {
    const direction = arrowIndex(key);
    const index = nodes.indexOf(event.target);
    if (direction < 0 || index < 0) return false;
    nodes[(index + (direction < 2 ? 1 : 9)) % 10].focus({ preventScroll: true });
    return true;
  });

  function swap(index) {
    if (finished) return;
    if (selected === -1) selected = index;
    else {
      if (selected !== index) {
        [order[selected], order[index]] = [order[index], order[selected]];
        swaps++;
      }
      selected = -1;
    }
    draw();
  }

  function draw() {
    const { points, crossings, count } = knotCrossings(order);
    context.clearRect(0, 0, 400, 400);
    context.beginPath();
    context.arc(200, 200, 154, 0, 2 * Math.PI);
    context.strokeStyle = '#c5cbb5';
    context.lineWidth = 1.5;
    context.stroke();
    knotEdges.forEach(([a, b], i) => line(context, points[a], points[b], crossings.has(i) ? '#b75a52' : '#537759', crossings.has(i) ? 3 : 4));
    nodes.forEach((button, index) => {
      const peg = order[index];
      const neighbors = knotEdges.filter(edge => edge.includes(peg)).map(([a, b]) => (peg === a ? b : a) + 1);
      button.textContent = String(peg + 1);
      button.setAttribute('aria-label', `节点 ${peg + 1}，连向 ${neighbors.join('、')}`);
      button.setAttribute('aria-pressed', String(selected === index));
    });
    api.status(`绳线交叉 ${count} 处 · 交换 ${swaps} 次${selected >= 0 ? ` · 已选节点 ${order[selected] + 1}` : ''}`);
    if (!count) {
      finished = true;
      api.end('每根绳子都已解开！', swaps);
    }
  }
  draw();
}

const balanceDistances = [-4, -3, -2, -1, 1, 2, 3, 4];
export const balanceLevels = [
  { fixed: [[-4, 5], [4, 2]], weights: [1, 2, 3] },
  { fixed: [[-3, 7], [4, 2]], weights: [2, 3, 4, 5] },
  { fixed: [[-4, 4], [3, 7]], weights: [2, 4, 5, 7] },
];

export function balanceTorque(fixed, placed) {
  let left = 0;
  let right = 0;
  for (const [distance, mass] of [...fixed, ...placed]) {
    if (distance < 0) left -= distance * mass;
    else right += distance * mass;
  }
  return { left, right };
}

export function mountBalance(host, api) {
  let stage = 0;
  let selected = -1;
  let placed = new Map();
  let complete = false;
  let finished = false;
  const board = element(host, 'div', 'sp-scale');
  board.setAttribute('role', 'group');
  board.setAttribute('aria-label', '天平配重槽');
  element(board, 'span', 'sp-scale-base');
  const lever = element(board, 'div', 'sp-scale-lever');
  const slots = balanceDistances.map((distance, i) => {
    const button = control(lever, api, '', () => useSlot(distance), 'sp-slot');
    button.style.left = `${(i < 4 ? i : i + 1) * 10 + 10}%`;
    return button;
  });
  keyboard(lever, api, (key, event) => {
    const direction = arrowIndex(key);
    if (direction !== 1 && direction !== 3) return false;
    const step = direction === 1 ? 1 : -1;
    for (let index = slots.indexOf(event.target) + step; index >= 0 && index < slots.length; index += step) {
      if (!slots[index].disabled) {
        slots[index].focus({ preventScroll: true });
        break;
      }
    }
    return true;
  });
  const torque = element(host, 'div', 'x-note sp-torque');
  const tray = element(host, 'div', 'x-actions');
  const weights = Array.from({ length: 4 }, (_, index) => control(tray, api, '', () => {
    if (complete || finished || [...placed.values()].includes(index)) return;
    selected = selected === index ? -1 : index;
    draw();
  }, 'sp-control sp-weight'));
  const actions = element(host, 'div', 'x-actions');
  const next = control(actions, api, '下一台天平', () => {
    if (!complete || finished) return;
    stage++;
    placed = new Map();
    selected = -1;
    complete = false;
    draw();
    weights[0].focus({ preventScroll: true });
  });

  function useSlot(distance) {
    if (complete || finished) return;
    const level = balanceLevels[stage];
    if (level.fixed.some(([slot]) => slot === distance)) return;
    if (placed.has(distance)) {
      selected = placed.get(distance);
      placed.delete(distance);
    } else if (selected >= 0) {
      placed.set(distance, selected);
      selected = -1;
    } else {
      api.status('请先从下方选择一枚砝码。');
      return;
    }
    draw();
  }

  function draw() {
    const level = balanceLevels[stage];
    const fixed = new Map(level.fixed);
    const { left, right } = balanceTorque(level.fixed, Array.from(placed, ([distance, index]) => [distance, level.weights[index]]));
    const tilt = Math.max(-12, Math.min(12, (right - left) * 0.75));
    lever.style.setProperty('--sp-tilt', `${tilt}deg`);
    const allPlaced = placed.size === level.weights.length;
    complete = allPlaced && left === right;
    torque.textContent = `左力矩 ${left}  ·  右力矩 ${right}`;
    slots.forEach((button, i) => {
      const distance = balanceDistances[i];
      const locked = fixed.has(distance);
      const mass = locked ? fixed.get(distance) : level.weights[placed.get(distance)];
      button.disabled = locked || complete;
      button.classList.toggle('sp-fixed', locked);
      button.classList.toggle('sp-filled', mass !== undefined);
      button.textContent = mass ?? '·';
      button.dataset.distance = String(Math.abs(distance));
      button.setAttribute('aria-label', `${distance < 0 ? '左' : '右'}侧距支点 ${Math.abs(distance)}，${locked ? '固定' : ''}${mass === undefined ? '空槽' : `重量 ${mass}`}`);
    });
    weights.forEach((button, index) => {
      const used = [...placed.values()].includes(index);
      button.hidden = index >= level.weights.length;
      button.disabled = used || complete;
      button.textContent = String(level.weights[index] ?? '');
      button.setAttribute('aria-label', `重量 ${level.weights[index]} 的砝码${used ? '，已放置' : ''}`);
      button.setAttribute('aria-pressed', String(index === selected));
    });
    next.hidden = !complete || stage === balanceLevels.length - 1;
    api.status(`第 ${stage + 1} / ${balanceLevels.length} 台 · ${complete ? '已配平' : allPlaced ? '尚未配平，可取回砝码调整' : `已放 ${placed.size} / ${level.weights.length} 枚`}`);
    if (complete && stage === balanceLevels.length - 1 && !finished) {
      finished = true;
      api.end('三台天平都已配平！', seconds(api));
    }
  }
  draw();
}

const paperSize = 6;
export const newPaper = () => Array.from({ length: paperSize }, (_, y) => Array.from({ length: paperSize }, (_, x) => [y * paperSize + x]));
const transpose = paper => paper[0].map((_, x) => paper.map(row => row[x]));

export function foldPaper(paper, edge, depth) {
  const vertical = edge === 'left' || edge === 'right';
  const reverse = edge === 'bottom' || edge === 'right';
  let oriented = vertical ? transpose(paper) : paper;
  if (depth < 1 || depth * 2 > oriented.length) return null;
  if (reverse) oriented = [...oriented].reverse();
  let folded = oriented.slice(depth).map(row => [...row]);
  for (let y = 0; y < depth; y++) {
    const row = depth - y - 1;
    folded[row] = folded[row].map((layers, x) => [...layers, ...oriented[y][x]]);
  }
  if (reverse) folded.reverse();
  if (vertical) folded = transpose(folded);
  return folded;
}

export const paperLevels = [
  { name: '四角花', target: [7, 8, 13, 14, 31, 32] },
  { name: '双回纹', target: [9, 10, 13, 19, 27, 28] },
];
const paperEdges = [['top', '上边'], ['right', '右边'], ['bottom', '下边'], ['left', '左边']];

export function mountPaper(host, api) {
  let stage = 0;
  let paper = newPaper();
  let edge = 'top';
  let folds = 0;
  let punches = [];
  let complete = false;
  let finished = false;
  let history = [];
  const panels = element(host, 'div', 'sp-paper-panels');
  const shape = element(panels, 'div', 'sp-paper-panel');
  element(shape, 'p', 'x-note', '原纸图样');
  const original = grid(shape, api, paperSize, paperSize, '原纸上的目标孔位', null, 'sp-paper-target');
  const work = element(panels, 'div', 'sp-paper-panel');
  element(work, 'p', 'x-note', '操作纸面 · 数字表示层数');
  const working = grid(work, api, paperSize, paperSize, '当前折叠的纸', punch, 'sp-paper-work');
  const toolbar = element(host, 'div', 'x-toolbar sp-paper-edges');
  const edges = paperEdges.map(([value, name]) => control(toolbar, api, `折${name}`, () => {
    edge = value;
    draw();
  }));
  const foldActions = element(host, 'div', 'x-actions sp-paper-folds');
  const depths = [1, 2, 3].map(depth => control(foldActions, api, '', () => fold(depth)));
  const actions = element(host, 'div', 'x-actions');
  const undo = control(actions, api, '撤回操作', () => {
    if (!history.length || complete || finished) return;
    ({ paper, folds, punches } = history.pop());
    draw();
  });
  const next = control(actions, api, '下一张图样', () => {
    if (!complete || finished) return;
    stage++;
    paper = newPaper();
    edge = 'top';
    folds = 0;
    punches = [];
    complete = false;
    history = [];
    draw();
    edges[0].focus({ preventScroll: true });
  });

  function remember() { history.push({ paper, folds, punches }); }

  function fold(depth) {
    if (folds === 2 || complete || finished) return;
    const folded = foldPaper(paper, edge, depth);
    if (!folded) return;
    remember();
    paper = folded;
    folds++;
    draw();
    if (folds === 2) working.cells[0].focus({ preventScroll: true });
  }

  function punch(index) {
    if (folds < 2 || punches.length >= 2 || complete || finished || punches.includes(index)) return;
    const layers = paper[Math.floor(index / paperSize)]?.[index % paperSize];
    if (!layers) return;
    remember();
    punches = [...punches, index];
    draw();
  }

  function draw() {
    const target = new Set(paperLevels[stage].target);
    const holes = new Set(punches.flatMap(i => paper[Math.floor(i / paperSize)][i % paperSize]));
    complete = punches.length === 2 && holes.size === target.size && [...holes].every(hole => target.has(hole));
    original.cells.forEach((cell, index) => {
      const marked = target.has(index);
      const hole = holes.has(index);
      cell.classList.toggle('sp-marked', marked);
      cell.classList.toggle('sp-correct', marked && hole);
      cell.classList.toggle('sp-extra', !marked && hole);
      cell.textContent = hole ? '●' : marked ? '◎' : '';
      labelCell(cell, index, paperSize, hole ? marked ? '已对准' : '多出的孔' : marked ? '目标孔' : '空白');
    });
    working.cells.forEach((cell, index) => {
      const layers = paper[Math.floor(index / paperSize)]?.[index % paperSize];
      const punched = punches.includes(index);
      cell.style.visibility = layers ? '' : 'hidden';
      cell.disabled = !layers || folds < 2 || punches.length >= 2 || punched;
      cell.classList.toggle('sp-punched', punched);
      cell.dataset.layers = String(layers?.length ?? '');
      cell.textContent = layers ? punched ? '●' : String(layers.length) : '';
      labelCell(cell, index, paperSize, `${layers?.length ?? 0} 层${punched ? '，已打孔' : ''}`);
    });
    const column = edge === 'left' || edge === 'right';
    const limit = Math.floor((column ? paper[0].length : paper.length) / 2);
    edges.forEach((button, i) => {
      button.setAttribute('aria-pressed', String(edge === paperEdges[i][0]));
      button.disabled = folds === 2;
    });
    depths.forEach((button, i) => {
      button.textContent = `折起 ${i + 1} ${column ? '列' : '行'}`;
      button.disabled = folds === 2 || i + 1 > limit;
    });
    undo.disabled = !history.length || complete;
    next.hidden = !complete || stage === paperLevels.length - 1;
    const note = complete ? '孔位全部对准' : punches.length === 2 ? '孔位未对准，撤回后可调整' : `折叠 ${folds} / 2 · 打孔 ${punches.length} / 2`;
    api.status(`第 ${stage + 1} / ${paperLevels.length} 张 · ${paperLevels[stage].name} · ${note}`);
    if (complete && stage === paperLevels.length - 1 && !finished) {
      finished = true;
      api.end('两张纸展开后都与图样完全对齐！', seconds(api));
    }
  }
  draw();
}
