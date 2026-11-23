import { element, makeBoard, paint, setup } from './strategy-view.js';

const TRAINS = [
  { name: '甲', direction: 1, node: 1 },
  { name: '乙', direction: -1, node: 7 },
  { name: '丙', direction: 1, node: 0 },
  { name: '丁', direction: -1, node: 8 },
];
const MAIN = 9;
const SIDING = [9, 10, 11];
const RAIL_SPOTS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 3, 4, 5];

export function railState() {
  return TRAINS.map(train => ({ ...train, arrived: false }));
}

function nextStation(train, westSiding, eastSiding) {
  const { node, direction } = train;
  if (direction === 1 && node === 2 && westSiding) return SIDING[0];
  if (direction === -1 && node === 6 && eastSiding) return SIDING[2];
  if (node === SIDING[2] && direction === 1) return 6;
  if (node === SIDING[0] && direction === -1) return 2;
  return node + direction;
}

export function dispatchTrains(trains, moving, westSiding, eastSiding) {
  const next = trains.map((train, i) => train.arrived || !moving.has(i)
    ? train : { ...train, node: nextStation(train, westSiding, eastSiding) });
  for (let a = 0; a < next.length; a++) {
    if (next[a].arrived) continue;
    for (let b = a + 1; b < next.length; b++) {
      if (next[b].arrived) continue;
      const sameNode = next[a].node === next[b].node;
      const swap = next[a].node === trains[b].node && next[b].node === trains[a].node;
      if (sameNode || swap) return { collision: [a, b], trains: next };
    }
  }
  return {
    collision: null,
    trains: next.map(train => ({
      ...train, arrived: train.arrived || train.node === (train.direction === 1 ? MAIN - 1 : 0),
    })),
  };
}

export function mountRail(host, api) {
  const view = setup(host, api, 'rail');
  const { cells } = makeBoard(view, view.root, 11, 2, '单线与会让线');
  const vehicles = element(view.root, 'div', 'x-actions');
  const switches = element(view.root, 'div', 'x-actions');
  const actions = element(view.root, 'div', 'x-actions');
  element(view.root, 'p', 'x-note', '上排是会让线，下排是主线。东行在西岔选路，西行在东岔选路。');
  let trains = railState();
  let selected = new Set([0, 1, 2, 3]);
  let switchesOpen = [true, false];
  let tick = 0;
  let collision = null;
  const controls = trains.map(({ name, direction }, i) => view.button(vehicles, `${name} ${direction === 1 ? '→' : '←'}`, () => {
    if (selected.has(i)) selected.delete(i);
    else selected.add(i);
    draw();
  }));
  const switchButtons = ['西道岔', '东道岔'].map((name, i) => view.button(switches, name, () => {
    switchesOpen[i] = !switchesOpen[i];
    draw();
  }));
  const advance = view.button(actions, '推进一拍', () => {
    const next = dispatchTrains(trains, selected, ...switchesOpen);
    tick++;
    trains = next.trains;
    collision = next.collision;
    for (const i of selected) if (trains[i].arrived) selected.delete(i);
    draw();
    if (collision) {
      view.end(`${trains[collision[0]].name}车和${trains[collision[1]].name}车发生碰撞。`);
    } else if (trains.every(train => train.arrived)) {
      view.end('四辆列车安全抵达。', tick);
    } else {
      view.status('已推进一拍。重新确认发车列车和道岔。');
    }
  });

  function draw() {
    view.stats([`拍数 ${tick}`, `抵达 ${trains.filter(train => train.arrived).length}/4`]);
    cells.forEach((cell, i) => {
      const node = RAIL_SPOTS.indexOf(i);
      if (node < 0) {
        paint(cell, i === 11 ? '西' : i === 21 ? '东' : i === 2 ? '╱' : i === 6 ? '╲' : '', '轨道边缘', 'is-clear');
        return;
      }
      const occupants = trains.filter(train => train.node === node && !train.arrived);
      const crashed = collision?.some(index => trains[index].node === node);
      const name = node === 2 ? '西道岔' : node === 6 ? '东道岔' : node >= MAIN ? '会让线' : '主线';
      const symbol = crashed ? '×' : occupants.length ? occupants.map(train => train.name + (train.direction === 1 ? '›' : '‹')).join('')
        : node === 2 || node === 6 ? '┴' : '═';
      paint(cell, symbol, `${name} ${occupants.map(train => train.name + '车').join('、')}`,
        crashed ? 'is-danger' : occupants.length ? 'is-player' : node >= MAIN ? 'is-target' : 'is-path');
    });
    trains.forEach((train, index) => {
      controls[index].disabled = train.arrived;
      controls[index].setAttribute('aria-pressed', String(selected.has(index)));
      controls[index].textContent = `${train.name} ${train.arrived ? '已到' : train.direction === 1 ? '→' : '←'}`;
    });
    switchButtons.forEach((button, i) => {
      button.textContent = `${i ? '东岔' : '西岔'} · ${switchesOpen[i] ? '会让线' : '主线'}`;
      button.setAttribute('aria-pressed', String(switchesOpen[i]));
    });
    advance.disabled = selected.size === 0;
  }
  draw();
  view.status('选中列车可发车。上下两线可在中段会让。');
}

const ARRIVALS = [
  ['c', 'c', 'cc', ''],
  ['c', 'cc', '', 'c'],
  ['', '', 'c', 'c'],
  ['cc', 'A', 'c', 'cc'],
  ['', 'c', 'c', ''],
  ['c', '', 'cc', 'c'],
  ['cc', 'c', 'A', ''],
  ['c', 'cc', '', 'c'],
  ['', 'c', 'cc', 'c'],
  ['cc', '', 'c', 'cc'],
  ['c', '', 'c', 'A'],
  ['', 'cc', '', ''],
  ['c', 'c', 'cc', 'c'],
  ['c', '', '', 'c'],
];
const LANES = ['北向', '东向', '南向', '西向'];

export function signalState() {
  return { ticks: 0, phase: 0, queues: LANES.map(() => []), passed: 0 };
}

export function advanceSignal(state, change) {
  const next = {
    ticks: state.ticks + 1,
    phase: change ? 1 - state.phase : state.phase,
    queues: state.queues.map(lane => [...lane]),
    passed: state.passed,
  };
  for (let index = 0; index < LANES.length; index++) {
    if (!change && index % 2 === state.phase) {
      next.passed += next.queues[index].splice(0, 2).length;
    }
    for (const car of ARRIVALS[state.ticks]?.[index] ?? '') {
      next.queues[index].push({ emergency: car === 'A', arrived: next.ticks });
    }
  }
  const congested = next.queues.findIndex(lane => lane.length > 7);
  const overdue = next.queues.findIndex(lane => lane.some(car => car.emergency && next.ticks - car.arrived > 4));
  const emptied = next.ticks >= ARRIVALS.length && next.queues.every(lane => lane.length === 0);
  const loss = congested >= 0 ? `${LANES[congested]}排队超过七辆，路口堵塞。`
    : overdue >= 0 ? `${LANES[overdue]}急救车等待超时。`
      : next.ticks >= 20 && !emptied ? '二十拍已到，仍有车辆未通过。' : null;
  return { next, loss, emptied };
}

export function mountSignal(host, api) {
  const view = setup(host, api, 'signal');
  const board = element(view.root, 'div', 'strategy-intersection');
  const routes = LANES.map((name, i) => {
    const lane = element(board, 'div', `strategy-lane strategy-lane-${i}`);
    element(lane, 'strong', '', name);
    const queue = element(lane, 'span');
    const light = element(lane, 'span', 'strategy-light');
    return { lane, queue, light };
  });
  const center = element(board, 'div', 'strategy-junction', '十字路口');
  const forecast = element(view.root, 'ul', 'strategy-forecast');
  forecast.setAttribute('aria-label', '未来来车');
  const actions = element(view.root, 'div', 'x-actions');
  let state = signalState();
  const hold = view.button(actions, '保持绿灯', () => step(false));
  const change = view.button(actions, '切换方向 · 全红一拍', () => step(true));

  function step(switching) {
    const { next, loss, emptied } = advanceSignal(state, switching);
    state = next;
    draw();
    if (loss) view.end(loss);
    else if (emptied) view.end(`全部 ${state.passed} 辆车在第 ${state.ticks} 拍前通过。`);
    else view.status(switching ? '全红拍结束，新方向现在可以放行。' : '当前绿灯车道已放行，本拍车辆已经抵达。');
  }

  function draw() {
    view.stats([`拍数 ${state.ticks}/20`, `已通行 ${state.passed} 辆`]);
    routes.forEach(({ lane, queue, light }, index) => {
      const open = state.phase === index % 2;
      const cars = state.queues[index];
      const emergency = cars.filter(car => car.emergency);
      lane.classList.toggle('is-danger', cars.length >= 6 || emergency.some(car => state.ticks - car.arrived >= 3));
      queue.textContent = `${cars.length} 辆${emergency.length ? ` · 急救等待 ${state.ticks - emergency[0].arrived} 拍` : ''}`;
      light.textContent = open ? '绿灯' : '红灯';
      light.className = `strategy-light ${open ? 'is-open' : ''}`;
    });
    const axis = state.phase === 0 ? '南北' : '东西';
    center.textContent = `${axis}放行`;
    hold.textContent = `保持${axis}绿灯`;
    change.textContent = `切到${state.phase === 0 ? '东西' : '南北'} · 全红一拍`;
    forecast.replaceChildren();
    const arrivals = ARRIVALS.slice(state.ticks, state.ticks + 3);
    if (!arrivals.length) element(forecast, 'li', '', '接下来没有新车。');
    arrivals.forEach((turn, i) => {
      const detail = turn.map((lane, j) => lane ? `${LANES[j]}${lane.length}${lane.includes('A') ? '（急救）' : ''}` : '').filter(Boolean);
      element(forecast, 'li', '', `第 ${state.ticks + i + 1} 拍 · ${detail.join(' / ') || '没有来车'}`);
    });
  }
  draw();
  view.status('先查看未来来车，再决定保持绿灯或切换方向。');
}
