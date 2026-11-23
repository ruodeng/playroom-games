import { coordinate, directions, element, makeBoard, paint, setup } from './strategy-view.js';

const TRUCK_WIDTH = 6;
const TRUCK_HEIGHT = 4;
const WHEEL_ARCHES = new Set([2, 22]);
export const cargo = [
  { name: '书柜', mass: 2, shape: [[0, 0], [1, 0], [0, 1]] },
  { name: '床头柜', mass: 1, shape: [[0, 0], [1, 0]] },
  { name: '沙发', mass: 1, shape: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { name: '茶几', mass: 2, shape: [[0, 0], [1, 0], [2, 0]] },
  { name: '冰箱', mass: 1, shape: [[0, 0], [0, 1], [1, 1]] },
  { name: '餐桌', mass: 2, shape: [[0, 0], [1, 0], [2, 0]] },
  { name: '床架', mass: 1, shape: [[0, 0], [1, 0], [2, 0]] },
];
const CARGO_MARKS = ['书', '柜', '沙', '几', '冰', '桌', '床'];

export function rotateCargo(shape) {
  const limit = Math.max(...shape.map(([, y]) => y));
  return shape.map(([x, y]) => [limit - y, x]);
}

export function fitCargo(anchor, shape, occupied) {
  const x = anchor % TRUCK_WIDTH;
  const y = Math.floor(anchor / TRUCK_WIDTH);
  const indices = shape.map(([dx, dy]) => (y + dy) * TRUCK_WIDTH + x + dx);
  if (shape.some(([dx, dy]) => x + dx >= TRUCK_WIDTH || y + dy >= TRUCK_HEIGHT)
    || indices.some(index => WHEEL_ARCHES.has(index) || occupied.has(index))) return null;
  return indices;
}

export function truckWeights(occupied) {
  const weights = [0, 0];
  for (const [cell, item] of occupied) weights[Number(cell % TRUCK_WIDTH >= TRUCK_WIDTH / 2)] += cargo[item].mass;
  return weights;
}

export function mountTruck(host, api) {
  const view = setup(host, api, 'truck');
  const items = element(view.root, 'div', 'x-actions');
  const surfaces = element(view.root, 'div', 'strategy-truck-surfaces');
  const { cells } = makeBoard(view, surfaces, TRUCK_WIDTH, TRUCK_HEIGHT, '货车车厢', place);
  const sample = element(surfaces, 'div', 'strategy-piece');
  const itemTitle = element(sample, 'strong');
  const { cells: shapeCells } = makeBoard(view, sample, 4, 4, '所选货物形状');
  const controls = element(view.root, 'div', 'x-actions');
  const orientations = cargo.map(item => item.shape);
  const placed = new Map();
  const occupied = new Map();
  let selected = 0;
  const cards = cargo.map((item, index) => view.button(items, item.name, () => {
    selected = index;
    draw();
  }));
  const rotate = view.button(controls, '旋转 90°', () => {
    orientations[selected] = rotateCargo(orientations[selected]);
    draw();
  });
  const lift = view.button(controls, '取回货物', () => {
    for (const index of placed.get(selected)) occupied.delete(index);
    placed.delete(selected);
    draw();
    view.status('已取回货物，可旋转后重新装车。');
  });
  const close = view.button(controls, '锁好车厢', () => {
    const [left, right] = truckWeights(occupied);
    if (Math.abs(left - right) > 4) view.status('两侧载荷之差超过四格重，需重新排布。');
    else view.end(`七件货物全部装车，左右载荷 ${left} / ${right} 格重。`);
  });
  element(view.root, 'p', 'x-note', '选货后点一下车厢空格，从该格起摆放。点击车厢里的货物也可直接选中。');

  function place(index) {
    if (occupied.has(index)) {
      selected = occupied.get(index);
      draw();
      return;
    }
    if (placed.has(selected)) {
      view.status('这件货物已装上车，请先取回或改选其他货物。');
      return;
    }
    const fit = fitCargo(index, orientations[selected], occupied);
    if (!fit) {
      view.status('货物会压住轮拱、其他货物或超出车厢。');
      return;
    }
    for (const cell of fit) occupied.set(cell, selected);
    placed.set(selected, fit);
    const next = cargo.findIndex((_, item) => !placed.has(item));
    if (next >= 0) selected = next;
    draw();
    view.status(placed.size === cargo.length ? '货物已全部放入，请检查载荷后锁好车厢。' : '已装入一件货物。');
  }

  function draw() {
    const [left, right] = truckWeights(occupied);
    view.stats([`已装 ${placed.size}/7`, `左侧 ${left}`, `右侧 ${right}`, `载荷差 ${Math.abs(left - right)}/4`]);
    cards.forEach((card, index) => {
      card.setAttribute('aria-pressed', String(index === selected));
      card.textContent = cargo[index].name + (placed.has(index) ? ' ✓' : '');
    });
    cells.forEach((cell, index) => {
      const item = occupied.get(index);
      const used = occupied.has(index);
      const blocked = WHEEL_ARCHES.has(index);
      paint(cell, used ? CARGO_MARKS[item] : blocked ? '▲' : '·',
        `${coordinate(index, TRUCK_WIDTH)} ${used ? cargo[item].name : blocked ? '轮拱' : '空货位'}`,
        [used ? (item % 2 ? 'is-target' : 'is-player') : blocked ? 'is-blocked' : 'is-clear', index % TRUCK_WIDTH === 2 && 'truck-left-edge'].filter(Boolean).join(' '));
      cell.setAttribute('aria-pressed', String(item === selected));
      cell.disabled = blocked;
    });
    itemTitle.textContent = `${cargo[selected].name} · ${cargo[selected].mass} 格重/格`;
    const shape = orientations[selected];
    shapeCells.forEach((cell, index) => {
      const fills = shape.some(([x, y]) => index === y * 4 + x);
      paint(cell, fills ? CARGO_MARKS[selected] : '', fills ? '所占格' : '空格', fills ? 'is-player' : 'is-clear');
    });
    rotate.disabled = placed.has(selected);
    lift.disabled = !placed.has(selected);
    close.disabled = placed.size !== cargo.length;
  }

  draw();
  view.status('装入七件货物，同时保持左右载荷接近。');
}

const GARAGE_SIZE = 6;
export const garages = [
  [
    { mark: '红', x: 1, y: 2, length: 2, vertical: false },
    { mark: '甲', x: 3, y: 0, length: 3, vertical: true },
    { mark: '乙', x: 2, y: 4, length: 3, vertical: false },
    { mark: '丙', x: 5, y: 1, length: 3, vertical: true },
    { mark: '丁', x: 4, y: 5, length: 2, vertical: false },
    { mark: '戊', x: 1, y: 0, length: 2, vertical: true },
  ],
  [
    { mark: '红', x: 1, y: 2, length: 2, vertical: false },
    { mark: '甲', x: 4, y: 1, length: 2, vertical: true },
    { mark: '乙', x: 2, y: 4, length: 2, vertical: true },
    { mark: '丙', x: 3, y: 5, length: 2, vertical: false },
    { mark: '丁', x: 3, y: 0, length: 2, vertical: false },
    { mark: '戊', x: 5, y: 0, length: 3, vertical: true },
    { mark: '己', x: 4, y: 4, length: 2, vertical: false },
    { mark: '庚', x: 1, y: 3, length: 2, vertical: true },
    { mark: '辛', x: 3, y: 1, length: 2, vertical: true },
    { mark: '壬', x: 1, y: 0, length: 2, vertical: false },
  ],
];

export function garageOccupancy(cars) {
  const occupied = new Map();
  cars.forEach(({ x, y, length, vertical }, car) => {
    for (let offset = 0; offset < length; offset++) {
      occupied.set((y + (vertical ? offset : 0)) * GARAGE_SIZE + x + (vertical ? 0 : offset), car);
    }
  });
  return occupied;
}

export function moveCar(cars, index, direction) {
  const car = cars[index];
  const { dx, dy } = directions[direction];
  if (car.vertical ? dx : dy) return null;
  const x = car.x + dx;
  const y = car.y + dy;
  const endX = x + (car.vertical ? 0 : car.length - 1);
  const endY = y + (car.vertical ? car.length - 1 : 0);
  if (index === 0 && dx === 1 && endX >= GARAGE_SIZE) return { cars, escaped: true };
  if (x < 0 || y < 0 || endX >= GARAGE_SIZE || endY >= GARAGE_SIZE) return null;
  const occupied = garageOccupancy(cars);
  const leading = dx + dy > 0 ? endY * GARAGE_SIZE + endX : y * GARAGE_SIZE + x;
  if (occupied.has(leading)) return null;
  return { cars: cars.map((other, i) => i === index ? { ...other, x, y } : other), escaped: false };
}

export function mountGarage(host, api) {
  const view = setup(host, api, 'garage');
  const { cells } = makeBoard(view, view.root, GARAGE_SIZE, GARAGE_SIZE, '停车场', index => {
    const car = garageOccupancy(cars).get(index);
    if (car !== undefined) {
      selected = car;
      draw();
    }
  });
  const actions = element(view.root, 'div', 'x-actions');
  let level = 0;
  let cars = garages[level];
  let selected = 0;
  let moves = 0;
  let escaped = false;
  const arrows = directions.map(({ arrow, label }, index) => {
    const button = view.button(actions, arrow, () => move(index));
    button.setAttribute('aria-label', label + '移动');
    return button;
  });
  const reset = view.button(actions, '重排本关', () => {
    cars = garages[level];
    selected = moves = 0;
    draw();
    view.status('已将车辆恢复到本关起点。');
  });
  const advance = view.button(actions, '驶往第二座车库', () => {
    level++;
    cars = garages[level];
    selected = moves = 0;
    escaped = false;
    draw();
    view.status('第二座车库停放得更紧密。');
  });
  element(view.root, 'p', 'x-note', '选车后使用箭头按钮。第三行右侧的「出」是红车出口。');

  function move(direction) {
    if (escaped) return;
    const next = moveCar(cars, selected, direction);
    if (!next) return;
    cars = next.cars;
    escaped = next.escaped;
    moves++;
    draw();
    if (escaped && level === garages.length - 1) view.end('红车已驶出两座车库。');
    else if (escaped) view.status('第一座车库已经驶出，可以前往下一关。');
  }

  function draw() {
    view.stats([`车库 ${level + 1}/${garages.length}`, `移动 ${moves} 步`, `所选 ${cars[selected].mark}车`]);
    const occupied = garageOccupancy(cars);
    cells.forEach((cell, index) => {
      const occupant = occupied.get(index);
      const car = escaped && occupant === 0 ? undefined : cars[occupant];
      const exit = index === 2 * GARAGE_SIZE + GARAGE_SIZE - 1;
      const symbol = car ? car.mark + (car.vertical ? '↕' : '↔') : exit ? '出' : '·';
      paint(cell, symbol, `${coordinate(index, GARAGE_SIZE)} ${car ? car.mark + '车，' + (car.vertical ? '纵向' : '横向') : exit ? '出口' : '空车位'}`,
        `${car ? occupant === 0 ? 'is-danger' : 'is-player' : exit ? 'is-target' : ''} ${exit ? 'garage-exit-lane' : ''}`);
      cell.setAttribute('aria-pressed', String(Boolean(car) && occupant === selected));
      cell.disabled = escaped || !car;
    });
    arrows.forEach((arrow, i) => { arrow.disabled = escaped || !moveCar(cars, selected, i); });
    reset.disabled = escaped;
    advance.hidden = !escaped || level > 0;
  }
  draw();
  view.status('将挡路车辆沿各自方向挪开，让红车出库。');
}
