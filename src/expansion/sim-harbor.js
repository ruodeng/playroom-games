import { actions, button, grid, int, note, station, stats } from './sim-ui.js';

const LOTS = [
  { fish: '鲈鱼', qty: 4, fresh: true, baseline: 36 },
  { fish: '鲭鱼', qty: 5, fresh: false, baseline: 40 },
  { fish: '黄鱼', qty: 4, fresh: true, baseline: 44 },
  { fish: '带鱼', qty: 5, fresh: false, baseline: 35 },
];
const BUYERS = [
  { name: '海湾食堂', wants: '至少 4 箱', accepts: lot => lot.qty >= 4, rate: qty => qty * 9 + 10 },
  { name: '日料小馆', wants: '只收当天鲜货', accepts: lot => lot.fresh, rate: qty => qty * 12 + 12 },
  { name: '熏鱼工坊', wants: '只收鲭鱼或带鱼', accepts: lot => ['鲭鱼', '带鱼'].includes(lot.fish), rate: qty => qty * 11 + 9 },
  { name: '鱼丸摊', wants: '收任何批次', accepts: () => true, rate: qty => qty * 8 + 10 },
];

export function auction(host, api) {
  const lots = LOTS.map(lot => {
    const center = lot.baseline + int(api.random, -2, 2);
    return { ...lot, low: center - 2, high: center + 2, opponent: center + int(api.random, -2, 2) };
  });
  const openingCash = 52;
  const soldTo = new Set();
  let round = 0;
  let cash = openingCash;
  let cargo = false;
  let offer = Math.min(cash, lots[round].low);
  let summary = '参考竞争对手的询价，也看看哪些买家还在收货。';
  const maxBid = lot => Math.min(cash, lot.high + 8);

  function view(done) {
    const lot = lots[Math.min(round, lots.length - 1)];
    return `${stats(['拍卖批次', `${Math.min(round + 1, lots.length)} / ${lots.length}`], ['可用资金', `${cash} 元`], ['成交买家 / 净利润', `${soldTo.size} / ${cash - openingCash} 元`])}
      <div class="sim-auction-lot">
        <span class="sim-fish-crate" aria-hidden="true"><i></i><i></i><i></i></span>
        <div><b>${lot.fish} · ${lot.qty} 箱</b><small>${lot.fresh ? '当天鲜货' : '普通冰鲜'}</small><span>${cargo ? '已拍得，选择买家' : `对手询价 ${lot.low}–${lot.high} 元`}</span></div>
      </div>
      <div class="sim-lot-queue" aria-label="渔港拍卖顺序">${lots.map((value, i) => `<span class="${i === round ? 'current' : ''}"><strong>${value.fish}</strong><small>${i < round ? '已过场' : i === round ? '当前批次' : `${value.qty} 箱`}</small></span>`).join('')}</div>
      ${grid(2, BUYERS.map((buyer, i) => button(`sell-${i}`,
        `<b>${buyer.name}</b><small>${buyer.wants}</small><strong>${soldTo.has(i) ? '今日已收货' : buyer.accepts(lot) ? `收货 ${buyer.rate(lot.qty)} 元` : '不收此货'}</strong>`,
        { disabled: done || !cargo || soldTo.has(i) || !buyer.accepts(lot), kind: 'sim-buyer' })), 'sim-buyers', '本地买家')}
      ${cargo
        ? actions(button('salvage', `清货底价 ${lot.qty * 5} 元`, { disabled: done }))
        : `<div class="sim-dispatch"><div class="sim-stepper">${button('less', '−', { disabled: done || !offer, title: '降低出价' })}<span>出价 <b>${offer}</b> 元</span>${button('more', '+', { disabled: done || offer >= maxBid(lot), title: '提高出价' })}</div>${button('bid', '出价竞拍', { disabled: done || !offer, kind: 'sim-primary' })}${button('pass', '放弃此批', { disabled: done })}</div>`}
      ${note(summary)}`;
  }

  function move(key) {
    const lot = lots[round];
    if (key === 'less' || key === 'more') {
      offer += key === 'more' ? 1 : -1;
      return;
    }
    if (key === 'bid') {
      if (offer > lot.opponent) {
        cash -= offer;
        cargo = true;
        summary = `对手报 ${lot.opponent} 元，你以 ${offer} 元拍得${lot.fish}。`;
        return { message: summary };
      }
      summary = `对手报 ${lot.opponent} 元，${lot.fish}由对手拍得。`;
    } else if (key === 'pass') {
      summary = `已放弃${lot.fish}批次。`;
    } else if (key === 'salvage') {
      cash += lot.qty * 5;
      summary = `${lot.fish}按底价清货，回收 ${lot.qty * 5} 元。`;
    } else {
      const buyer = Number(key.split('-')[1]);
      const value = BUYERS[buyer].rate(lot.qty);
      cash += value;
      soldTo.add(buyer);
      summary = `${BUYERS[buyer].name}收下整批${lot.fish}，入账 ${value} 元。`;
    }
    if (++round === lots.length) {
      const profit = cash - openingCash;
      const success = soldTo.size >= 2 && profit >= 28;
      return { end: `${success ? '渔港生意达标。' : '渔港交易尚未达标。'}与 ${soldTo.size} 家买家成交，净利润 ${profit} 元。` };
    }
    cargo = false;
    offer = Math.min(cash, lots[round].low);
    return { message: summary };
  }

  station(host, api, 'auction', view, move);
}

const SIZE = 5;
const MAP = [
  'w...w',
  '....w',
  'f....',
  '.....',
  'w...w',
].join('').split('');
const BUILDINGS = {
  road: { name: '道路', mark: '路', cost: 2, keep: 1 },
  home: { name: '住宅', mark: '住', cost: 5, keep: 1 },
  work: { name: '工坊', mark: '工', cost: 7, keep: 2 },
  park: { name: '公园', mark: '园', cost: 4, keep: 1 },
};
const LANDMARKS = { w: { name: '海水', mark: '≈' }, f: { name: '渡口', mark: '渡' }, '.': { name: '空地', mark: '' } };

function neighbors(map, index) {
  const candidates = [
    index % SIZE !== 0 ? index - 1 : -1,
    index % SIZE !== SIZE - 1 ? index + 1 : -1,
    index - SIZE,
    index + SIZE,
  ];
  return candidates.filter(candidate => candidate >= 0 && candidate < map.length).map(candidate => map[candidate]);
}

function accounts(map) {
  let population = 0;
  let jobs = 0;
  let parks = 0;
  let upkeep = 0;
  map.forEach((value, index) => {
    upkeep += BUILDINGS[value]?.keep ?? 0;
    if (value === 'work') jobs += 3;
    if (value === 'park') parks++;
    if (value === 'home') {
      const nearby = neighbors(map, index);
      population += 2 + Number(nearby.includes('park')) - Number(nearby.includes('work'));
    }
  });
  return { population, jobs, parks, upkeep, taxes: population * 3 + Math.min(population, jobs) * 2 };
}

export function island(host, api) {
  const map = MAP.slice();
  let cash = 28;
  let year = 0;
  let permits = 3;
  let tool = 'road';
  let summary = '选建设工具，再点贴着渡口或道路的空地。';

  function canBuild(index) {
    if (map[index] !== '.' || !permits || cash < BUILDINGS[tool].cost) return false;
    return neighbors(map, index).some(place => place === 'f' || place === 'road');
  }

  function view(done) {
    const budget = accounts(map);
    return `${stats(['建设年', `${Math.min(year + 1, 6)} / 6`], ['财政', `${cash} 元`], ['居民 / 岗位 / 公园', `${budget.population} / ${budget.jobs} / ${budget.parks}`])}
      ${grid(SIZE, map.map((key, index) => {
        const place = LANDMARKS[key] ?? BUILDINGS[key];
        const valid = !done && canBuild(index);
        return button(`tile-${index}`, `<b aria-hidden="true">${place.mark}</b>`, { disabled: !valid, kind: `sim-land sim-land-${key === '.' ? 'open' : key}${valid ? ' buildable' : ''}`,
          title: `第 ${Math.floor(index / SIZE) + 1} 行第 ${index % SIZE + 1} 列，${place.name}${valid ? `，可建${BUILDINGS[tool].name}` : ''}` });
      }), 'sim-island-map', '岛屿地块')}
      <div class="x-toolbar sim-banner"><b>年度许可证 ${permits} / 3</b><span>年税收 ${budget.taxes} 元 · 维护 ${budget.upkeep} 元</span></div>
      ${actions(...Object.entries(BUILDINGS).map(([key, building]) => button(`set-${key}`, `${building.name} · ${building.cost} 元`, { pressed: tool === key, disabled: done })),
        button('year', year >= 5 ? '结算六年规划' : '进入下一年', { disabled: done, kind: 'sim-primary' }))}
      ${note(summary)}`;
  }

  function move(key) {
    const [action, value] = key.split('-');
    if (action === 'set') {
      tool = value;
      summary = `选择了${BUILDINGS[tool].name}，可建地块会突出显示。`;
      return;
    }
    if (action === 'tile') {
      map[Number(value)] = tool;
      cash -= BUILDINGS[tool].cost;
      permits--;
      summary = `已建成${BUILDINGS[tool].name}。`;
      return { message: summary };
    }
    const budget = accounts(map);
    const income = budget.taxes - budget.upkeep;
    cash += income;
    summary = `第 ${++year} 年结算，财政变动 ${income} 元。`;
    if (year === 6) {
      const success = budget.population >= 8 && budget.jobs >= 6 && budget.parks >= 3 && cash >= 25;
      return { end: `${success ? '岛上小镇建设达标。' : '六年规划结束，部分目标尚未达成。'}人口 ${budget.population} 户，岗位 ${budget.jobs} 个，公园 ${budget.parks} 处，余额 ${cash} 元。` };
    }
    permits = 3;
    return { message: summary };
  }

  station(host, api, 'island', view, move);
}
