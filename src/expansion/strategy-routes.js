import { buildNetwork, element, setup } from './strategy-view.js';

const STATIONS = {
  depot: { name: '集散站', position: [13, 50] },
  north: { name: '北门', position: [34, 20] },
  pier: { name: '码头', position: [34, 79] },
  hotel: { name: '旅店', position: [60, 55] },
  office: { name: '事务所', position: [83, 23] },
  lab: { name: '实验室', position: [85, 80] },
};
export const relayRoads = [
  ['depot', 'north', 2],
  ['depot', 'pier', 2],
  ['north', 'office', 2, [3, 7, 11, 15]],
  ['north', 'hotel', 4],
  ['pier', 'hotel', 2, [2, 5, 8, 11, 14]],
  ['hotel', 'office', 2],
  ['hotel', 'lab', 3],
  ['pier', 'lab', 2, [5, 9, 13, 17]],
];
export const deliveries = [
  { name: '公文', origin: 'depot', destination: 'office', due: 7 },
  { name: '样品', origin: 'north', destination: 'lab', due: 13 },
  { name: '药包', origin: 'lab', destination: 'hotel', due: 17 },
];

function opposite(edge, here) {
  return edge[0] === here ? edge[1] : edge[1] === here ? edge[0] : null;
}

export function relayState() {
  return { here: 'depot', time: 0, parcels: ['carried', 'waiting', 'waiting'] };
}

export function advanceRelay(state, destination) {
  const edge = destination ? relayRoads.find(road => opposite(road, state.here) === destination) : null;
  if (destination && (!edge || edge[3] && !edge[3].includes(state.time))) return null;
  const here = destination || state.here;
  const time = state.time + (edge?.[2] ?? 1);
  const parcels = state.parcels.map((parcel, i) => {
    if (parcel === 'waiting' && deliveries[i].origin === here) return 'carried';
    if (parcel === 'carried' && deliveries[i].destination === here && time <= deliveries[i].due) return 'delivered';
    return parcel;
  });
  const late = deliveries.find((parcel, index) => parcels[index] !== 'delivered' && time >= parcel.due);
  return { state: { here, time, parcels }, late, finished: parcels.every(parcel => parcel === 'delivered') };
}

export function mountRelay(host, api) {
  const view = setup(host, api, 'relay');
  const { markers, links } = buildNetwork(view, STATIONS, relayRoads, step,
    edge => edge[3] ? `接 ${edge[2]}` : `${edge[2]} 格`);
  const outgoing = element(view.root, 'ul', 'strategy-forecast');
  outgoing.setAttribute('aria-label', '可用接驳');
  const registry = element(view.root, 'ul', 'strategy-dispatch-list');
  registry.setAttribute('aria-label', '送件清单');
  const actions = element(view.root, 'div', 'x-actions');
  view.button(actions, '等一格时间', () => step(null));
  let state = relayState();

  function step(destination) {
    const next = advanceRelay(state, destination);
    if (!next) {
      view.status('这段接驳尚未发车。查看发车表或换用步行线路。');
      return;
    }
    const previous = state;
    state = next.state;
    draw();
    if (next.late) view.end(`${next.late.name}未赶上第 ${next.late.due} 格的送达期限。`);
    else if (next.finished) view.end(`三件急件全部准时签收，总用时 ${state.time} 格。`);
    else {
      const changed = deliveries.flatMap((parcel, i) => previous.parcels[i] === state.parcels[i]
        ? [] : [parcel.name + (state.parcels[i] === 'carried' ? '已取件' : '已签收')]);
      view.status(changed.length ? changed.join('，') + '。' : destination ? `已抵达${STATIONS[destination].name}。` : '已等候一格时间。');
    }
  }

  function draw() {
    view.stats([`时间 ${state.time}`, STATIONS[state.here].name, `签收 ${state.parcels.filter(parcel => parcel === 'delivered').length}/3`]);
    const roads = relayRoads.filter(edge => opposite(edge, state.here));
    for (const [key, marker] of Object.entries(markers)) {
      const edge = roads.find(road => opposite(road, state.here) === key);
      marker.disabled = !edge || Boolean(edge[3] && !edge[3].includes(state.time));
      marker.classList.toggle('is-current', key === state.here);
      marker.setAttribute('aria-current', key === state.here ? 'location' : 'false');
    }
    links.forEach(({ line, edge }) => {
      line.classList.toggle('is-available', roads.includes(edge) && (!edge[3] || edge[3].includes(state.time)));
      line.classList.toggle('is-scheduled', Boolean(edge[3]));
    });
    outgoing.replaceChildren();
    roads.forEach(edge => {
      const nextStop = STATIONS[opposite(edge, state.here)].name;
      const times = edge[3]?.filter(time => time >= state.time);
      const schedule = times ? times.length ? `第 ${times.join('、')} 格发车` : '已无班次' : '步行随时出发';
      element(outgoing, 'li', '', `${nextStop} · 用时 ${edge[2]} 格 · ${schedule}`);
    });
    registry.replaceChildren();
    deliveries.forEach(({ name, origin, destination, due }, i) => {
      const statuses = { waiting: '待取', carried: '在途', delivered: '已签收' };
      element(registry, 'li', state.parcels[i] === 'delivered' ? 'is-done' : '',
        `${name} · ${STATIONS[origin].name} → ${STATIONS[destination].name} · ${due} 格截止 · ${statuses[state.parcels[i]]}`);
    });
  }
  draw();
  view.status('点击相邻站点出发。定时接驳须等到发车时刻。');
}

const COAST = {
  harbor: { name: '安全港', position: [14, 51] },
  inlet: { name: '河口', position: [36, 51] },
  north: { name: '北滩', position: [58, 20], people: 2, flood: 8 },
  south: { name: '南滩', position: [58, 81], people: 1, flood: 12 },
  island: { name: '孤岛', position: [84, 51], people: 1, flood: 13 },
};
const CHANNELS = [
  ['harbor', 'inlet', 0],
  ['inlet', 'north', 1],
  ['inlet', 'south', 0],
  ['inlet', 'island', 3],
  ['north', 'island', 2],
  ['south', 'island', 1],
];
const TIDES = [0, 1, 2, 2, 3, 3, 2, 1, 0, 1, 2, 2, 3, 3, 2, 1, 0];
const COAST_DEADLINE = TIDES.length - 1;

export function tideState() {
  return { time: 0, here: 'harbor', aboard: 0, saved: 0, waiting: { north: 2, south: 1, island: 1 } };
}

export function advanceTide(state, action, destination) {
  const next = { ...state, time: state.time + 1, waiting: { ...state.waiting } };
  if (action === 'sail') {
    const channel = CHANNELS.find(edge => opposite(edge, state.here) === destination);
    if (!channel || TIDES[state.time] < channel[2]) return null;
    next.here = destination;
  } else if (action === 'board') {
    if (!state.waiting[state.here] || state.aboard >= 2) return null;
    const embarking = Math.min(2 - state.aboard, state.waiting[state.here]);
    next.waiting[state.here] -= embarking;
    next.aboard += embarking;
  } else if (action === 'unload') {
    if (!state.aboard || state.here !== 'harbor') return null;
    next.saved += state.aboard;
    next.aboard = 0;
  }
  const flooded = Object.keys(next.waiting).find(dock => next.waiting[dock] > 0 && next.time >= COAST[dock].flood);
  const loss = flooded ? `${COAST[flooded].name}已被淹，居民还未登船。`
    : next.time >= COAST_DEADLINE && next.saved < 4 ? '撤离时间用完，仍有居民没有到达安全港。' : null;
  return { state: next, loss, finished: next.saved === 4 };
}

export function mountTide(host, api) {
  const view = setup(host, api, 'tide');
  const { markers, links } = buildNetwork(view, COAST, CHANNELS, key => step('sail', key), edge => `潮位 ${edge[2]}+`);
  const forecast = element(view.root, 'p', 'x-note');
  const registry = element(view.root, 'ul', 'strategy-dispatch-list');
  registry.setAttribute('aria-label', '登船点淹没预报');
  const actions = element(view.root, 'div', 'x-actions');
  let state = tideState();
  const board = view.button(actions, '接居民登船', () => step('board'));
  const unload = view.button(actions, '安全下船', () => step('unload'));
  view.button(actions, '等待一拍', () => step('wait'));

  function step(action, destination) {
    const next = advanceTide(state, action, destination);
    if (!next) return;
    state = next.state;
    draw();
    if (next.loss) view.end(next.loss);
    else if (next.finished) view.end(`四位居民已全部抵达安全港，撤离用了 ${state.time} 拍。`);
    else view.status(action === 'board' ? '居民已登船。最多载两位。' : action === 'unload' ? '居民已在安全港下船。'
      : action === 'sail' ? `已到${COAST[destination].name}。` : '已等待一拍，潮位预报已更新。');
  }

  function draw() {
    view.stats([`时间 ${state.time}/${COAST_DEADLINE} 拍`, `潮位 ${TIDES[state.time]}`, `船上 ${state.aboard}/2 人`, `获救 ${state.saved}/4 人`]);
    for (const [key, marker] of Object.entries(markers)) {
      const edge = CHANNELS.find(channel => opposite(channel, state.here) === key);
      const current = key === state.here;
      marker.disabled = !edge || TIDES[state.time] < edge[2];
      marker.classList.toggle('is-current', current);
      marker.setAttribute('aria-current', current ? 'location' : 'false');
      marker.textContent = `${COAST[key].name}${state.waiting[key] ? ' · ' + state.waiting[key] : ''}`;
    }
    links.forEach(({ line, edge }) => {
      line.classList.toggle('is-available', Boolean(opposite(edge, state.here)) && TIDES[state.time] >= edge[2]);
      line.classList.toggle('is-scheduled', TIDES[state.time] < edge[2]);
    });
    forecast.textContent = TIDES.slice(state.time + 1, state.time + 5)
      .map((tide, index) => `${state.time + index + 1} 拍时潮位 ${tide}`).join(' · ');
    registry.replaceChildren();
    Object.entries(state.waiting).forEach(([key, count]) => {
      const dock = COAST[key];
      element(registry, 'li', count ? '' : 'is-done', `${dock.name} · ${count ? `待登船 ${count} 人 · 第 ${dock.flood} 拍被淹` : '登船完毕'}`);
    });
    board.disabled = !state.waiting[state.here] || state.aboard >= 2;
    unload.disabled = state.here !== 'harbor' || state.aboard === 0;
  }
  draw();
  view.status('潮位满足标注的航道才可通航。点可到达的地点划船。');
}
