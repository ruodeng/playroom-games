import { canvas, control, element, keyboard, line, position } from './spatial-ui.js';
import { segmentsCross } from './spatial-workshop.js';

const gearDriver = 10;
const outputs = new Map([[4, 1], [24, -1]]);
const gearFixed = new Set([gearDriver, ...outputs.keys()]);
const gearLimit = 12;
const hexOffsets = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
export const gearAxles = Array.from({ length: 25 }, (_, index) => index).filter(i => ![5, 9, 15, 19, 22].includes(i));
const gearPoint = index => [index % 5, Math.floor(index / 5)];
const gearCenter = index => {
  const [x, y] = gearPoint(index);
  return [40 + 51 * (x + 0.5 * y), 35 + (51 * Math.sqrt(3) / 2) * y];
};
const gearNeighbors = new Map(gearAxles.map(index => {
  const [x, y] = gearPoint(index);
  const neighbors = hexOffsets.map(([dx, dy]) => [x + dx, y + dy])
    .filter(([a, b]) => a >= 0 && a < 5 && b >= 0 && b < 5)
    .map(([a, b]) => b * 5 + a).filter(nearby => gearAxles.includes(nearby));
  return [index, neighbors];
}));

export function gearDrive(installed) {
  const gears = new Set([...installed, ...gearFixed]);
  const spins = new Map([[gearDriver, 1]]);
  const conflicts = new Set();
  const queue = [gearDriver];
  for (const index of queue) {
    for (const other of gearNeighbors.get(index)) {
      if (!gears.has(other)) continue;
      const required = -spins.get(index);
      if (!spins.has(other)) {
        spins.set(other, required);
        queue.push(other);
      } else if (spins.get(other) !== required) {
        conflicts.add(other);
        conflicts.add(index);
      }
    }
  }
  const reached = [...outputs].filter(([index, spin]) => spins.get(index) === spin).length;
  return { spins, conflicts, reached, solved: conflicts.size === 0 && reached === outputs.size };
}

export function mountGears(host, api) {
  const installed = new Set();
  let testing = false;
  let finished = false;
  const board = element(host, 'div', 'sp-diagram sp-gears');
  board.setAttribute('role', 'group');
  board.setAttribute('aria-label', '齿轮轴网格');
  const [, context] = canvas(board, 388, 247, '相邻齿轮之间的轴线');
  for (const [index, neighbors] of gearNeighbors) {
    for (const other of neighbors) if (other > index) line(context, gearCenter(index), gearCenter(other), '#ccd1ba', 1.5);
  }
  const gears = new Map(gearAxles.map(index => {
    const node = control(board, api, '', () => toggle(index), 'sp-node sp-gear-node');
    const [x, y] = gearCenter(index);
    position(node, x / 3.88, y / 2.47);
    const rotor = element(node, 'span', 'sp-rotor');
    const center = element(node, 'span', 'sp-gear-center');
    node.disabled = gearFixed.has(index);
    return [index, { node, rotor, center }];
  }));
  keyboard(board, api, (key, event) => {
    const direction = { ArrowRight: 0, ArrowDown: 1, ArrowLeft: 3, ArrowUp: 4 }[key];
    const current = [...gears].find(([, { node }]) => node === event.target)?.[0];
    if (direction === undefined || current === undefined) return false;
    const options = [direction, (direction + 5) % 6, (direction + 1) % 6];
    const [x, y] = gearPoint(current);
    for (const dir of options) {
      const [dx, dy] = hexOffsets[dir];
      const next = gears.get((y + dy) * 5 + x + dx)?.node;
      if (x + dx >= 0 && x + dx < 5 && next && !next.disabled) {
        next.focus({ preventScroll: true });
        break;
      }
    }
    return true;
  });
  const actions = element(host, 'div', 'x-actions');
  const test = control(actions, api, '检查传动', () => {
    if (finished) return;
    testing = true;
    draw();
  });

  function toggle(index) {
    if (finished || gearFixed.has(index)) return;
    if (installed.has(index)) installed.delete(index);
    else if (installed.size < gearLimit) installed.add(index);
    else {
      api.status('架上已没有备用齿轮。拆下一枚可继续安装。');
      return;
    }
    testing = false;
    draw();
  }

  function draw() {
    const { spins, conflicts, reached, solved } = gearDrive(installed);
    for (const [index, { node, rotor, center }] of gears) {
      const driving = index === gearDriver;
      const isOutput = outputs.has(index);
      const occupied = gearFixed.has(index) || installed.has(index);
      const spin = spins.get(index);
      const target = outputs.get(index);
      const direction = target === 1 ? '顺时针' : '逆时针';
      const powered = spin && testing && !conflicts.size;
      const mark = target ? target === 1 ? '↻' : '↺' : driving ? '↻' : '·';
      node.classList.toggle('sp-driver', driving);
      node.classList.toggle('sp-output', isOutput);
      node.classList.toggle('sp-occupied', occupied);
      node.classList.toggle('sp-conflict', testing && conflicts.has(index));
      node.classList.toggle('sp-disconnected', testing && occupied && !spin);
      node.classList.toggle('sp-correct', isOutput && powered && spin === target);
      rotor.classList.toggle('sp-spinning', Boolean(powered));
      rotor.classList.toggle('sp-anticlockwise', powered === -1);
      center.textContent = occupied ? mark : '';
      const [x, y] = gearPoint(index);
      const label = driving ? '顺时针动力输入' : isOutput ? `要求${direction}的输出轮` : occupied ? '有齿轮，按下可拆除' : '空轴，按下可安装';
      const state = testing && occupied ? conflicts.has(index) ? '，传动冲突' : spin ? `，${spin === 1 ? '顺时针' : '逆时针'}传动` : '，未连接动力' : '';
      node.setAttribute('aria-label', `第 ${y + 1} 行第 ${x + 1} 列，${label}${state}`);
      if (!gearFixed.has(index)) node.setAttribute('aria-pressed', String(occupied));
    }
    const info = testing ? conflicts.size ? ' · 啮合冲突，传动卡死' : ` · 输出正确 ${reached} / ${outputs.size}` : '';
    api.status(`已安装 ${installed.size} / ${gearLimit} 枚齿轮${info}`);
    if (testing && solved) {
      finished = true;
      test.disabled = true;
      api.end('两枚输出轮都按指定方向转动！', installed.size);
    }
  }
  draw();
}

const deckLength = 4;
export const bridgeJoints = Array.from({ length: 10 }, (_, index) => [index % 5, Number(index >= 5)]);
export const bridgeDeck = Array.from({ length: deckLength }, (_, x) => [x, x + 1]);
const span = ([a, b]) => Math.hypot(bridgeJoints[a][0] - bridgeJoints[b][0], bridgeJoints[a][1] - bridgeJoints[b][1]);
const bridgeKey = (a, b) => `${Math.min(a, b)}-${Math.max(a, b)}`;
const same = ([a, b], c, d) => bridgeKey(a, b) === bridgeKey(c, d);
const inBounds = (a, b) => a !== b && span([a, b]) <= Math.SQRT2;
export const bridgeMaterial = bars => bars.reduce((sum, pair) => sum + (span(pair) > 1 ? 14 : 10), 0);

export function bridgeChange(bars, a, b) {
  if (!inBounds(a, b)) return { bars, warning: '两节点距离太远。请选择相邻的节点。' };
  if (bridgeDeck.some(pair => same(pair, a, b))) return { bars, warning: '桥面已铺好，可继续搭建支撑杆件。' };
  if (bars.some(pair => same(pair, a, b))) return { bars: bars.filter(pair => !same(pair, a, b)) };
  if (bars.some(([c, d]) => segmentsCross(bridgeJoints[a], bridgeJoints[b], bridgeJoints[c], bridgeJoints[d]))) {
    return { bars, warning: '两根斜杆会交叉。先拆掉原有斜杆再换向。' };
  }
  return { bars: [...bars, [Math.min(a, b), Math.max(a, b)]] };
}

// A pin at the left support fixes both axes. The roller at the right fixes only its height.
const fixedDirections = new Set([0, 1, 9]);
const axialRigidity = 360;
const tensionLimit = 23;
const compressionLimit = 16.25;
const deflectionLimit = 0.16;

function solveMatrix(stiffness, loads) {
  const matrix = stiffness.map((row, i) => [...row, loads[i]]);
  const n = loads.length;
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(matrix[j][i]) > Math.abs(matrix[pivot][i])) pivot = j;
    }
    if (Math.abs(matrix[pivot][i]) < 1e-7) return null;
    [matrix[i], matrix[pivot]] = [matrix[pivot], matrix[i]];
    for (let j = i + 1; j < n; j++) {
      const ratio = matrix[j][i] / matrix[i][i];
      for (let k = i; k <= n; k++) matrix[j][k] -= ratio * matrix[i][k];
    }
  }
  const displacement = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let rhs = matrix[i][n];
    for (let j = i + 1; j < n; j++) rhs -= matrix[i][j] * displacement[j];
    displacement[i] = rhs / matrix[i][i];
  }
  return displacement;
}

export function testBridge(bars) {
  const allBars = [...bridgeDeck, ...bars];
  const joints = [...new Set(allBars.flat())];
  const freedom = joints.flatMap(joint => [2 * joint, 2 * joint + 1]).filter(dof => !fixedDirections.has(dof));
  const variable = new Map(freedom.map((dof, i) => [dof, i]));
  const matrix = freedom.map(() => new Array(freedom.length).fill(0));
  const baseLoads = new Array(freedom.length).fill(0);
  const weight = (load, joint, mass) => {
    const y = variable.get(2 * joint + 1);
    if (y !== undefined) load[y] -= mass;
  };
  for (let joint = 0; joint <= deckLength; joint++) weight(baseLoads, joint, 0.5);
  const model = allBars.map(([a, b]) => {
    const [ax, ay] = bridgeJoints[a];
    const [bx, by] = bridgeJoints[b];
    const length = span([a, b]);
    const cx = (bx - ax) / length;
    const cy = (by - ay) / length;
    const axial = [[a * 2, -cx], [a * 2 + 1, -cy], [b * 2, cx], [b * 2 + 1, cy]]
      .filter(([dof]) => variable.has(dof)).map(([dof, c]) => [variable.get(dof), c]);
    const rigidity = axialRigidity / length;
    for (const [i, c] of axial) for (const [j, d] of axial) matrix[i][j] += rigidity * c * d;
    weight(baseLoads, a, 0.07 * length);
    weight(baseLoads, b, 0.07 * length);
    return { key: bridgeKey(a, b), length, rigidity, axial };
  });
  const maximum = new Map();
  let maxDeflection = 0;
  for (let caseIndex = 0; caseIndex <= 2 * deckLength; caseIndex++) {
    const loads = [...baseLoads];
    const truck = caseIndex / 2;
    const left = Math.floor(truck);
    weight(loads, left, 5.5 * (1 - truck + left));
    if (truck !== left) weight(loads, left + 1, 5.5 * (truck - left));
    const movement = solveMatrix(matrix, loads);
    if (!movement) return { passed: false, reason: 'unstable', truck: 0, maximum };
    maxDeflection = Math.max(maxDeflection, ...movement.map(Math.abs));
    let overloaded = false;
    for (const { key, length, rigidity, axial } of model) {
      const force = rigidity * axial.reduce((sum, [index, component]) => sum + component * movement[index], 0);
      const capacity = force < 0 ? compressionLimit / length ** 2 : tensionLimit;
      const ratio = Math.abs(force) / capacity;
      if (ratio > (maximum.get(key)?.ratio ?? 0)) maximum.set(key, { ratio, force });
      if (ratio > 1) overloaded = true;
    }
    if (overloaded) return { passed: false, reason: 'overload', truck, maximum };
    if (maxDeflection > deflectionLimit) return { passed: false, reason: 'deflection', truck, maximum };
  }
  return { passed: true, truck: deckLength, maximum };
}

const bridgeCenter = ([x, y]) => [41 + 84 * x, 165 - 84 * y];
const bridgeReason = {
  unstable: '结构会松动。试着用三角形锁住相邻节点。',
  overload: '杆件超载。红杆需要分担荷载。',
  deflection: '桥面位移超过限值。试着增加支撑。',
};

export function mountBridge(host, api) {
  let bars = [];
  let selected = -1;
  let report = null;
  let timing = null;
  let finished = false;
  const board = element(host, 'div', 'sp-diagram sp-bridge');
  board.setAttribute('role', 'group');
  board.setAttribute('aria-label', '桥梁搭建节点');
  const [, context] = canvas(board, 418, 230, '桥梁桁架与两岸支撑');
  const vehicle = element(board, 'span', 'sp-truck', '▰');
  vehicle.setAttribute('aria-hidden', 'true');
  const nodes = bridgeJoints.map((joint, index) => {
    const button = control(board, api, index < 5 ? String(index + 1) : String.fromCharCode(60 + index), () => choose(index), 'sp-node sp-bridge-node');
    const [x, y] = bridgeCenter(joint);
    position(button, 100 * x / 418, 100 * y / 230);
    return button;
  });
  keyboard(board, api, (key, event) => {
    const index = nodes.indexOf(event.target);
    if (index < 0) return false;
    const x = index % 5;
    const next = key === 'ArrowLeft' && x > 0 ? index - 1 : key === 'ArrowRight' && x < 4 ? index + 1
      : key === 'ArrowUp' && index < 5 ? index + 5 : key === 'ArrowDown' && index >= 5 ? index - 5 : -1;
    if (next < 0) return false;
    nodes[next].focus({ preventScroll: true });
    return true;
  });
  const toolbar = element(host, 'div', 'x-actions');
  const test = control(toolbar, api, '测试承重', () => {
    if (timing || finished) return;
    report = testBridge(bars);
    selected = -1;
    if (report.reason === 'unstable') {
      draw();
      return;
    }
    timing = { elapsed: 0, duration: Math.max(0.45, report.truck * 0.5) };
    draw();
    const stop = api.frame(dt => {
      timing.elapsed = Math.min(timing.duration, timing.elapsed + dt);
      drawVehicle();
      if (timing.elapsed < timing.duration) return;
      stop();
      timing = null;
      finished = report.passed;
      draw();
      if (finished) api.end('货车顺利到达对岸！', bridgeMaterial(bars));
    });
  });

  function choose(index) {
    if (timing || finished) return;
    let warning;
    if (index === selected) selected = -1;
    else if (selected < 0) selected = index;
    else {
      ({ bars, warning } = bridgeChange(bars, selected, index));
      report = null;
      selected = -1;
    }
    draw(warning);
  }

  function drawVehicle() {
    const truck = timing ? report.truck * timing.elapsed / timing.duration : report?.truck ?? 0;
    const [x, y] = bridgeCenter([truck, 0]);
    position(vehicle, 100 * x / 418, 100 * (y - 24) / 230);
  }

  function draw(warning) {
    context.clearRect(0, 0, 418, 230);
    context.fillStyle = '#cddfdf';
    context.fillRect(0, 192, 418, 38);
    context.fillStyle = '#bcc5a2';
    context.fillRect(0, 171, 50, 59);
    context.fillRect(368, 171, 50, 59);
    for (const [a, b] of [...bridgeDeck, ...bars]) {
      const state = !timing && report?.maximum.get(bridgeKey(a, b));
      const deck = bridgeDeck.some(pair => same(pair, a, b));
      const color = state?.ratio > 1 ? '#b24443' : state?.ratio > 0.65 ? '#a4773e' : deck ? '#475a51' : '#587954';
      line(context, bridgeCenter(bridgeJoints[a]), bridgeCenter(bridgeJoints[b]), color, deck ? 8 : 5);
    }
    nodes.forEach((button, index) => {
      button.disabled = Boolean(timing) || finished;
      button.setAttribute('aria-pressed', String(index === selected));
      const connected = bars.filter(pair => pair.includes(index)).length;
      button.setAttribute('aria-label', `${index < 5 ? '桥面' : '上排'}节点 ${button.textContent}，连接 ${connected} 根杆件`);
    });
    test.disabled = Boolean(timing) || finished;
    drawVehicle();
    const note = warning ?? (timing ? '货车正在通过' : report ? report.passed ? '已通过测试' : bridgeReason[report.reason] : selected >= 0 ? '再选相邻节点搭建或拆除' : '选择第一个节点');
    api.status(`材料 ${bridgeMaterial(bars)} 料点 · ${note}`);
  }
  draw();
}
