import { coordinate, element, makeBoard, paint, setup } from './strategy-view.js';

const WIDTH = 8;
const HEIGHT = 6;
const TOWERS = {
  arrow: { name: '箭塔', glyph: '弓', cost: 4, range: 3, damage: 2 },
  cannon: { name: '炮塔', glyph: '炮', cost: 6, range: 2, damage: 3 },
  frost: { name: '霜塔', glyph: '霜', cost: 5, range: 2, damage: 1 },
};

function route(...points) {
  const path = [];
  for (let i = 0; i < points.length; i++) {
    let [x, y] = points[i - 1] || points[i];
    const [targetX, targetY] = points[i];
    while (x !== targetX || y !== targetY || path.length === 0) {
      x += Math.sign(targetX - x);
      y += Math.sign(targetY - y);
      path.push(y * WIDTH + x);
    }
  }
  return path;
}

export const forestStages = [
  { name: '苔石小径', path: route([0, 2], [7, 2]), rocks: [4, 8, 30, 43], wood: 14 },
  { name: '溪谷转弯', path: route([0, 1], [3, 1], [3, 4], [7, 4]), rocks: [4, 7, 14, 25, 46], wood: 15 },
  { name: '松林折径', path: route([0, 4], [2, 4], [2, 1], [5, 1], [5, 3], [7, 3]), rocks: [3, 16, 23, 43, 45], wood: 16 },
  { name: '石峡回廊', path: route([0, 2], [1, 2], [1, 0], [4, 0], [4, 4], [6, 4], [6, 2], [7, 2]), rocks: [10, 11, 21, 32, 41, 47], wood: 17 },
  { name: '盘根山道', path: route([0, 4], [1, 4], [1, 1], [3, 1], [3, 3], [5, 3], [5, 1], [7, 1]), rocks: [5, 20, 23, 24, 34, 38, 42, 45], wood: 18 },
  { name: '林海关口', path: route([0, 0], [2, 0], [2, 4], [4, 4], [4, 1], [6, 1], [6, 4], [7, 4]), rocks: [4, 11, 16, 21, 25, 29, 32, 41, 47], wood: 21 },
];

function distance(a, b) {
  return Math.abs(a % WIDTH - b % WIDTH) + Math.abs(Math.floor(a / WIDTH) - Math.floor(b / WIDTH));
}

export function forestState(level) {
  return { level, wood: forestStages[level].wood, placed: new Map(), wave: 0, remaining: 0, enemies: [], tick: 0 };
}

export function startForestWave(state) {
  state.wave++;
  state.tick = 0;
  state.remaining = 7 + state.level + state.wave * 2;
}

export function forestTick(state) {
  const { path } = forestStages[state.level];
  let leaks = 0;
  let kills = 0;
  for (const enemy of state.enemies) {
    if (!enemy.frozen || (state.tick + enemy.entered) % 2 === 0) enemy.step++;
    enemy.frozen = false;
    if (enemy.step >= path.length) leaks++;
  }
  state.enemies = state.enemies.filter(enemy => enemy.step < path.length);
  if (state.remaining && state.tick % (state.wave === 1 ? 2 : 1) === 0) {
    const boss = state.remaining === 1 && state.wave === 2;
    const hp = 4 + state.level + state.wave * 2 + (boss ? 6 : 0);
    state.enemies.push({ entered: state.tick, step: 0, hp, boss, frozen: false });
    state.remaining--;
  }
  for (const [index, tower] of state.placed) {
    const type = TOWERS[tower.type];
    const target = state.enemies
      .filter(enemy => enemy.hp > 0 && distance(index, path[enemy.step]) <= type.range)
      .reduce((first, enemy) => !first || enemy.step > first.step ? enemy : first, null);
    if (!target) continue;
    target.hp -= type.damage + tower.level - 1;
    if (tower.type === 'frost') target.frozen = true;
    if (tower.type === 'cannon') {
      for (const enemy of state.enemies) {
        if (enemy !== target && Math.abs(enemy.step - target.step) <= 1) enemy.hp -= tower.level;
      }
    }
  }
  state.enemies = state.enemies.filter(enemy => {
    if (enemy.hp > 0) return true;
    kills++;
    state.wood += enemy.boss ? 4 : 2;
    return false;
  });
  state.tick++;
  return { kills, leaks, done: state.remaining === 0 && state.enemies.length === 0 };
}

export function mountForest(host, api) {
  const view = setup(host, api, 'forest');
  const palette = element(view.root, 'div', 'x-actions');
  const { cells } = makeBoard(view, view.root, WIDTH, HEIGHT, '林间防线', place);
  const actions = element(view.root, 'div', 'x-actions');
  let state = forestState(0);
  let selected = 'arrow';
  let hearts = 14;
  let total = 0;
  let active = false;
  let ended = false;
  const towerButtons = Object.entries(TOWERS).map(([key, tower]) => [key, view.button(
    palette, `${tower.name} · ${tower.cost} 木`, () => {
      selected = key;
      draw();
      view.status(`已选${tower.name}。点草地建造，点已有的同种塔升级。`);
    },
  )]);
  const advance = view.button(actions, '', () => {
    if (state.wave >= 2) {
      total += state.wood;
      state = forestState(state.level + 1);
    } else {
      startForestWave(state);
      active = true;
      view.status('敌人已进入小路，仍可在草地建塔或升级。');
    }
    draw();
  });
  element(view.root, 'p', 'x-note', '箭塔射程 3 格 · 炮塔范围伤害 · 霜塔减速。升级最多两次。');

  function place(index) {
    const type = TOWERS[selected];
    const tower = state.placed.get(index);
    const cost = type.cost - (tower ? 1 : 0);
    if (tower && (tower.type !== selected || tower.level === 3)) {
      view.status(tower.level === 3 ? '这座塔已满级。' : '请选择与已有防御塔相同的类型再升级。');
      return;
    }
    if (state.wood < cost) {
      view.status(`需要 ${cost} 木材，击退敌人可获得木材。`);
      return;
    }
    state.wood -= cost;
    state.placed.set(index, { type: selected, level: (tower?.level ?? 0) + 1 });
    view.status(tower ? `${type.name}升至 ${tower.level + 1} 级。` : `已建造${type.name}。`);
    draw();
  }

  function draw() {
    const stage = forestStages[state.level];
    view.stats([`第 ${state.level + 1}/6 关 · ${stage.name}`, `波次 ${state.wave}/2`, `耐久 ${hearts}`, `木材 ${state.wood}`]);
    for (const [key, button] of towerButtons) button.setAttribute('aria-pressed', String(key === selected));
    cells.forEach((cell, index) => {
      const routeIndex = stage.path.indexOf(index);
      const tower = state.placed.get(index);
      const crowd = routeIndex < 0 ? [] : state.enemies.filter(enemy => enemy.step === routeIndex);
      const rock = stage.rocks.includes(index);
      const routeSymbol = routeIndex === 0 ? '入' : routeIndex === stage.path.length - 1 ? '出' : '·';
      const terrain = routeIndex >= 0 ? '小路' : rock ? '岩石' : '草地';
      const symbol = crowd.length ? (crowd.some(enemy => enemy.boss) ? '王' : crowd.length === 1 ? '敌' : String(crowd.length))
        : tower ? TOWERS[tower.type].glyph + tower.level : routeIndex >= 0 ? routeSymbol : rock ? '▲' : '·';
      paint(cell, symbol,
        `${coordinate(index, WIDTH)} ${crowd.length ? crowd.length + ' 个敌人' : tower ? TOWERS[tower.type].name + tower.level + ' 级' : terrain}`,
        crowd.length ? 'is-danger' : tower ? 'is-player' : routeIndex >= 0 ? 'is-path' : rock ? 'is-blocked' : 'is-grass');
      cell.disabled = routeIndex >= 0 || rock;
    });
    advance.disabled = active;
    advance.textContent = active ? '防守中' : state.wave === 2 ? '前往下一片林地' : `开始第 ${state.wave + 1} 波`;
  }

  function update() {
    if (!active || ended) return;
    const { kills, leaks, done } = forestTick(state);
    hearts = Math.max(0, hearts - leaks);
    total += kills * 10;
    active = !done;
    draw();
    if (hearts === 0) {
      ended = true;
      view.end(`防线在第 ${state.level + 1} 片林地被突破。`);
    } else if (done && state.wave === 2 && state.level === forestStages.length - 1) {
      ended = true;
      const score = total + state.wood + hearts * 20;
      view.end('守住了全部六片林地。', score);
    } else if (done) {
      view.status(state.wave === 2 ? '这片林地已守住，可以前往下一关。' : '第一波结束，可用新增木材修建防线。');
    }
  }
  draw();
  view.status('先在草地建塔，再手动开始敌人波次。');
  api.every(update, 610);
}
