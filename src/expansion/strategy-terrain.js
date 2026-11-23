import { coordinate, element, makeBoard, neighbors, paint, setup } from './strategy-view.js';

const SURVEY_SIZE = 5;
const BEACONS = ['甲', '乙', '丙'];

export function surveyDistance(a, b) {
  return Math.abs(a % SURVEY_SIZE - b % SURVEY_SIZE)
    + Math.abs(Math.floor(a / SURVEY_SIZE) - Math.floor(b / SURVEY_SIZE));
}

export function createWrecks(random) {
  const pool = Array.from({ length: SURVEY_SIZE ** 2 }, (_, index) => index);
  return BEACONS.map(() => pool.splice(Math.floor(random() * pool.length), 1)[0]);
}

export function mountSurvey(host, api) {
  const view = setup(host, api, 'survey');
  const wrecks = createWrecks(() => api.random());
  const { cells } = makeBoard(view, view.root, SURVEY_SIZE, SURVEY_SIZE, '海床测绘网格', index => {
    selected = index;
    draw();
  });
  const actions = element(view.root, 'div', 'x-actions');
  const log = element(view.root, 'ol', 'strategy-soundings');
  log.setAttribute('aria-label', '声呐读数');
  const read = new Map();
  const marked = new Set();
  const misses = new Set();
  let selected = 0;
  const pulse = view.button(actions, '发射声呐', () => {
    const distances = wrecks.map(wreck => surveyDistance(selected, wreck));
    read.set(selected, distances);
    element(log, 'li', '', `${coordinate(selected, SURVEY_SIZE)} · ${distances.map((distance, index) => `${BEACONS[index]} ${distance} 格`).join(' / ')}`);
    draw();
    view.status('读数已记录。可在另一列或另一行继续测量。');
  });
  const buoy = view.button(actions, '投放浮标', () => {
    const index = wrecks.indexOf(selected);
    if (index >= 0) {
      marked.add(selected);
      draw();
      if (marked.size === wrecks.length) view.end('三艘沉船全部定位，海床测绘完成。');
      else view.status(`确认 ${BEACONS[index]} 号沉船。`);
    } else {
      misses.add(selected);
      draw();
      if (misses.size >= 2) view.end('浮标已经用完，仍有未定位的沉船。');
      else view.status('这个格子没有沉船，只剩一次试错机会。');
    }
  });

  function draw() {
    view.stats([`声呐 ${6 - read.size} 次`, `定位 ${marked.size}/3`, `剩余试错 ${2 - misses.size} 次`]);
    cells.forEach((cell, index) => {
      const position = coordinate(index, SURVEY_SIZE);
      const wreck = marked.has(index) ? BEACONS[wrecks.indexOf(index)] : '';
      const type = wreck ? 'is-target' : misses.has(index) ? 'is-danger' : read.has(index) ? 'is-scanned' : 'is-water';
      paint(cell, wreck || (misses.has(index) ? '×' : position),
        `${position}${wreck ? ' 已确认沉船 ' + wreck : misses.has(index) ? ' 投放落空' : read.has(index) ? ' 已测量' : ''}`,
        type);
      cell.setAttribute('aria-pressed', String(selected === index));
    });
    pulse.textContent = `在 ${coordinate(selected, SURVEY_SIZE)} 测量`;
    buoy.textContent = `在 ${coordinate(selected, SURVEY_SIZE)} 投标`;
    pulse.disabled = read.size >= 6 || read.has(selected);
    buoy.disabled = marked.has(selected) || misses.has(selected);
  }
  draw();
  view.status('选择坐标后测量。横竖格距会分别记在甲、乙、丙三个信号上。');
}

const FIRE_SIZE = 7;
export const fireMap = [
  '..b~~..',
  'Fbbb.rV',
  '.r.b...',
  '..~bbb.',
  '..~.r..',
  'F...b.V',
  'rr..~..',
].join('');
const TERRAIN = {
  '.': { symbol: '♣', label: '森林', kind: 'is-grass' },
  b: { symbol: '芒', label: '灌木', kind: 'is-brush' },
  r: { symbol: '▲', label: '岩石', kind: 'is-blocked' },
  '~': { symbol: '≈', label: '水面', kind: 'is-water' },
  V: { symbol: '村', label: '村庄', kind: 'is-target' },
  F: { symbol: '♣', label: '森林', kind: 'is-grass' },
};

export function fireState() {
  return {
    turn: 0,
    burning: new Set([...fireMap].flatMap((type, index) => type === 'F' ? [index] : [])),
    ash: new Set(),
    cuts: new Set(),
  };
}

export function advanceFire(state, cuts) {
  const next = {
    turn: state.turn + 1,
    burning: new Set(),
    ash: new Set([...state.ash, ...state.burning]),
    cuts: new Set([...state.cuts, ...cuts]),
  };
  const flammable = index => index >= 0 && !['r', '~'].includes(fireMap[index]) && !next.cuts.has(index);
  const ignite = index => {
    if (flammable(index) && !next.ash.has(index)) next.burning.add(index);
  };
  for (const index of state.burning) {
    const adjacent = neighbors(index, FIRE_SIZE, FIRE_SIZE);
    adjacent.forEach(ignite);
    const east = adjacent[1];
    if (fireMap[index] === 'b' && flammable(east)) ignite(neighbors(east, FIRE_SIZE, FIRE_SIZE)[1]);
  }
  return next;
}

export function mountFire(host, api) {
  const view = setup(host, api, 'fire');
  const { cells } = makeBoard(view, view.root, FIRE_SIZE, FIRE_SIZE, '山火地形图', mark);
  const actions = element(view.root, 'div', 'x-actions');
  let state = fireState();
  const planned = new Set();
  const step = view.button(actions, '推进一拍', () => {
    state = advanceFire(state, planned);
    planned.clear();
    draw();
    if ([...state.burning].some(index => fireMap[index] === 'V')) view.end('火线烧进了村庄。');
    else if (!state.burning.size || state.turn === 7) view.end('两座村庄平安，山火已扑灭。');
    else view.status('火线已向前蔓延。请安排下一拍的隔离带。');
  });
  element(view.root, 'p', 'x-note', '♣ 森林 · 芒 灌木 · ▲ 岩石 · ≈ 水 · 村 村庄 · 隔 隔离带。风向朝东。');

  function mark(index) {
    if (planned.has(index)) planned.delete(index);
    else if (planned.size < 2 && state.cuts.size + planned.size < 8) planned.add(index);
    else view.status(planned.size >= 2 ? '每拍只来得及砍两格。' : '整局的八格隔离带已用完。');
    draw();
  }

  function draw() {
    view.stats([`降雨倒计时 ${7 - state.turn} 拍`, `剩余砍伐 ${8 - state.cuts.size - planned.size} 格`, `本拍标记 ${planned.size}/2`]);
    cells.forEach((cell, index) => {
      const type = fireMap[index];
      const terrain = TERRAIN[type];
      const burning = state.burning.has(index);
      const ash = state.ash.has(index);
      const cut = state.cuts.has(index);
      const tagged = planned.has(index);
      const symbol = burning ? '火' : ash ? '灰' : cut ? '隔' : terrain.symbol;
      const kind = burning ? 'is-danger' : ash ? 'is-blocked' : cut ? 'is-clearcut' : terrain.kind;
      paint(cell, symbol, `${coordinate(index, FIRE_SIZE)} ${terrain.label}${burning ? ' 停留火线' : ash ? ' 已烧毁' : cut ? ' 已隔离' : ''}`, kind);
      cell.setAttribute('aria-pressed', String(tagged));
      cell.disabled = !['.', 'b'].includes(type) || burning || ash || cut;
    });
    step.textContent = planned.size ? `砍出 ${planned.size} 格并推进` : '直接推进一拍';
  }
  draw();
  view.status('标记要砍的树林，再推进火线。');
}
