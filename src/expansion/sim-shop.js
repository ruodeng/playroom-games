import { actions, button, clamp, grid, int, note, station, stats } from './sim-ui.js';

const BREAKFAST = [
  { name: '豆浆', symbol: '豆', cost: 2, price: 5 },
  { name: '饭团', symbol: '饭', cost: 3, price: 8 },
  { name: '包子', symbol: '包', cost: 3, price: 7 },
];
const WEATHER = [
  { name: '晴天', symbol: '☀', demand: [10, 8, 7] },
  { name: '雨天', symbol: '☂', demand: [7, 5, 10] },
  { name: '阴天', symbol: '☁', demand: [8, 9, 6] },
];

export function breakfast(host, api) {
  const days = Array.from({ length: 6 }, (_, index) => {
    const weather = WEATHER[int(api.random, 0, WEATHER.length - 1)];
    const weekend = index >= 4;
    return {
      ...weather,
      demand: weather.demand.map((amount, item) => amount + (weekend ? [2, 0, 2][item] : 0)),
      variance: BREAKFAST.map(() => int(api.random, -1, 1)),
    };
  });
  const stock = BREAKFAST.map(() => 0);
  const price = BREAKFAST.map(item => item.price);
  const rent = 12;
  const capacity = 24;
  const openingCash = 80;
  let day = 0;
  let cash = openingCash;
  let reputation = 0;
  let summary = '先按预报备货，备齐后开摊。';
  const planCost = () => stock.reduce((sum, value, i) => sum + value * BREAKFAST[i].cost, 0);
  const totalStock = () => stock.reduce((sum, value) => sum + value, 0);

  function forecast(i) {
    const change = price[i] - BREAKFAST[i].price;
    return Math.max(0, days[day].demand[i] + reputation - (change > 0 ? change * 2 : change));
  }

  function view(done) {
    const today = days[Math.min(day, days.length - 1)];
    return `${stats(['营业日', `${Math.min(day + 1, days.length)} / ${days.length}`], ['现金', `${cash} 元`], ['累计净利润', `${cash - openingCash} 元`])}
      <div class="x-toolbar sim-banner"><b><span aria-hidden="true">${today.symbol}</span> ${today.name}${day >= 4 ? ' · 周末客流' : ''}</b><span>备餐 ${totalStock()} / ${capacity} 份 · 摊租 ${rent} 元 / 日</span></div>
      ${grid(3, BREAKFAST.map((item, i) => `<section class="sim-menu-item">
        <span class="sim-dish" aria-hidden="true">${item.symbol}</span><strong>${item.name}</strong>
        <small>${done ? '营业已结束' : `预计售 ${forecast(i)} 份`}</small>
        <div class="sim-stepper">
          ${button(`stock-${i}--1`, '−', { disabled: done || stock[i] === 0, title: `少备一份${item.name}` })}
          <span><b>${stock[i]}</b> 份</span>
          ${button(`stock-${i}-1`, '+', { disabled: done || totalStock() >= capacity || cash < planCost() + item.cost + rent, title: `多备一份${item.name}` })}
        </div>
        <div class="sim-stepper">
          ${button(`price-${i}--1`, '−', { disabled: done || price[i] <= item.price - 2, title: `下调${item.name}价格` })}
          <span><b>${price[i]}</b> 元</span>
          ${button(`price-${i}-1`, '+', { disabled: done || price[i] >= item.price + 3, title: `上调${item.name}价格` })}
        </div><small>成本 ${item.cost} 元 / 份</small>
      </section>`), 'sim-menu', '早餐备餐表')}
      ${actions(button('open', `营业并结算 · 食材 ${planCost()} 元`, { disabled: done, kind: 'sim-primary' }))}
      ${note(summary)}`;
  }

  function move(key) {
    if (key !== 'open') {
      const [, field, index, change] = /^(stock|price)-(\d)-(-?1)$/.exec(key);
      const values = field === 'stock' ? stock : price;
      values[Number(index)] += Number(change);
      return;
    }
    const sold = stock.map((amount, i) => Math.min(amount, Math.max(0, forecast(i) + days[day].variance[i])));
    const revenue = sold.reduce((sum, amount, i) => sum + amount * price[i], 0);
    const dropped = totalStock() - sold.reduce((sum, amount) => sum + amount, 0);
    const missed = sold.reduce((sum, amount, i) => sum + Math.max(0, forecast(i) + days[day].variance[i] - amount), 0);
    const profit = revenue - planCost() - rent;
    cash += profit;
    reputation = clamp(reputation + (missed >= 8 ? -1 : missed <= 3 ? 1 : 0), -2, 2);
    summary = `第 ${++day} 天卖出${sold.map((amount, i) => `${BREAKFAST[i].name} ${amount} 份`).join('、')}，报废 ${dropped} 份，净利润 ${profit} 元。`;
    if (day === days.length) return { end: `六天收摊，累计净利润 ${cash - openingCash} 元。`, metric: cash - openingCash };
    stock.fill(0);
    return { message: summary };
  }

  station(host, api, 'breakfast', view, move);
}

const BOOKS = [
  { title: '潮间带来信', tags: ['自然', '故事'], color: 'sea' },
  { title: '月台手记', tags: ['旅行', '故事'], color: 'ochre' },
  { title: '窗前观鸟', tags: ['自然', '图鉴'], color: 'leaf' },
  { title: '口袋山路图', tags: ['旅行', '图鉴'], color: 'brick' },
  { title: '屋顶有菜园', tags: ['自然', '手作'], color: 'moss' },
  { title: '旅途剪贴簿', tags: ['旅行', '手作'], color: 'plum' },
];
const BOOK_WEEKS = [
  [0, 2, 3, 2], [1, 4, 5, 1], [0, 1, 3, 5], [4, 5, 2, 4], [3, 2, 0, 3],
];
const READERS = ['顾老师', '何同学', '陆阿姨', '罗师傅', '林先生', '李同学'];

export function books(host, api) {
  const weeks = BOOK_WEEKS.map(readers => {
    const offset = int(api.random, 0, readers.length - 1);
    return readers.slice(offset).concat(readers.slice(0, offset));
  });
  const shelf = [];
  let week = 0;
  let served = 0;
  let leads = 0;
  let summary = '选中的第一本书会进入橱窗。';

  function view(done) {
    const current = Math.min(week, weeks.length - 1);
    const wishes = weeks[current];
    return `${stats(['营业周', `${current + 1} / ${weeks.length}`], ['找到书的读者', `${served} / 16`], ['橱窗推荐', `${leads} / 3`])}
      <div class="sim-reader-list" aria-label="按到店顺序排列的书单">
        ${wishes.map((i, position) => `<div><b>${READERS[(position + current) % READERS.length]}</b><span>${BOOKS[i].tags.join(' · ')}</span></div>`).join('')}
      </div>
      ${grid(3, BOOKS.map((book, i) => button(`book-${i}`, `<span class="sim-book-spine ${book.color}"></span><strong>${book.title}</strong><small>${book.tags.join(' · ')}</small><small>${shelf[0] === i ? '橱窗推荐' : shelf.includes(i) ? '货架上' : '2 册可上架'}</small>`,
        { pressed: shelf.includes(i), disabled: done || (shelf.length === 3 && !shelf.includes(i)), kind: 'sim-book' })), 'sim-bookcase', '上架选书')}
      ${actions(button('welcome', '迎客开门', { disabled: done || shelf.length !== 3, kind: 'sim-primary' }))}
      ${note(summary)}`;
  }

  function move(key) {
    if (key !== 'welcome') {
      const i = Number(key.split('-')[1]);
      const space = shelf.indexOf(i);
      if (space >= 0) shelf.splice(space, 1);
      else shelf.push(i);
      return;
    }
    const copies = new Map(shelf.map(i => [i, 2]));
    let count = 0;
    let recommendations = 0;
    for (const wish of weeks[week]) {
      if (!(copies.get(wish) > 0)) continue;
      copies.set(wish, copies.get(wish) - 1);
      count++;
      if (wish === shelf[0]) recommendations++;
    }
    served += count;
    leads += recommendations;
    summary = `第 ${++week} 周服务 ${count} 位读者，橱窗获得 ${recommendations} 次推荐。`;
    if (week === weeks.length) {
      const success = served >= 16 && leads >= 3;
      return { end: `${success ? '街角书店赢得街坊信赖。' : '书店尚未完成经营目标。'}五周服务 ${served} 人，获得 ${leads} 次推荐。` };
    }
    shelf.length = 0;
    return { message: summary };
  }

  station(host, api, 'books', view, move);
}

const PRODUCE = [
  { name: '草莓', mark: '莓', life: 1, color: 'brick' },
  { name: '青菜', mark: '菜', life: 2, color: 'leaf' },
  { name: '鲜菇', mark: '菇', life: 2, color: 'ochre' },
];
const MARKET_ORDERS = [
  { buyer: '果汁铺', need: [2, 0, 0], value: 15 },
  { buyer: '馄饨店', need: [0, 2, 1], value: 18 },
  { buyer: '小餐桌', need: [1, 1, 0], value: 13 },
  { buyer: '食堂备菜', need: [0, 3, 0], value: 14 },
  { buyer: '菌菇铺', need: [0, 0, 2], value: 16 },
  { buyer: '社团拼单', need: [1, 0, 2], value: 21 },
];
const MARKET_NIGHTS = [
  { delivery: [3, 3, 2], orders: [0, 1, 2] },
  { delivery: [2, 2, 3], orders: [0, 3, 4] },
  { delivery: [2, 3, 1], orders: [1, 4, 5] },
  { delivery: [3, 2, 2], orders: [0, 2, 5] },
  { delivery: [2, 3, 2], orders: [2, 3, 4] },
];

export function market(host, api) {
  const nights = MARKET_NIGHTS.map(({ delivery, orders }) => {
    const bonus = int(api.random, 0, PRODUCE.length - 1);
    return { delivery: delivery.map((n, i) => n + (i === bonus ? 1 : 0)), orders: orders.map(id => MARKET_ORDERS[id]) };
  });
  const bins = PRODUCE.map(() => []);
  const accepted = new Set();
  let night = 0;
  let sales = 0;
  let cash = 0;
  let waste = 0;
  let chilled = -1;
  let summary = '点订单配货。当天到期的货可用冰保留。';

  function deliver() {
    nights[night].delivery.forEach((n, i) => {
      bins[i].push(...Array(n).fill(PRODUCE[i].life));
      cash -= n;
    });
  }
  const available = order => order.need.every((amount, i) => amount <= bins[i].length);
  const describe = order => order.need.flatMap((n, i) => n ? [`${PRODUCE[i].name} ×${n}`] : []).join(' · ');
  deliver();

  function view(done) {
    const current = nights[Math.min(night, nights.length - 1)];
    return `${stats(['夜市', `${Math.min(night + 1, nights.length)} / ${nights.length}`], ['净收入', `${cash} 元`], ['接单 / 报废', `${sales} / ${waste}`])}
      ${grid(3, PRODUCE.map((item, i) => `<section class="sim-crate ${item.color}">
        <b>${item.name} × ${bins[i].length}</b>
        <div class="sim-crate-load" aria-label="${bins[i].filter(life => life === 1).length} 箱今日到期">${bins[i].slice().sort().map(life => `<i aria-hidden="true" class="${life === 1 ? 'sim-ripening' : ''}">${item.mark}</i>`).join('')}</div>
        <small>今晚到期 ${bins[i].filter(life => life === 1).length} 箱</small>
        ${button(`ice-${i}`, chilled === i ? '已安排补冰' : '补冰 · 3 元', { pressed: chilled === i, disabled: done || !bins[i].length })}
      </section>`), 'sim-produce', '鲜货库存')}
      <div class="sim-tickets" aria-label="顾客订单">${current.orders.map((order, i) => button(`order-${i}`,
        `<span><b>${order.buyer}</b><small>${describe(order)}</small></span><strong>${accepted.has(i) ? '已成交' : available(order) ? `${order.value} 元` : '缺货'}</strong>`,
        { disabled: done || accepted.has(i) || !available(order), kind: 'sim-ticket' })).join('')}</div>
      ${actions(button('close', '收市盘点', { disabled: done, kind: 'sim-primary' }))}
      ${note(summary)}`;
  }

  function move(key) {
    const [what, item] = key.split('-');
    const i = Number(item);
    if (what === 'order') {
      const order = nights[night].orders[i];
      order.need.forEach((n, index) => { bins[index].sort((a, b) => a - b).splice(0, n); });
      accepted.add(i);
      sales++;
      cash += order.value;
      summary = `${order.buyer}取货，入账 ${order.value} 元。`;
      return { message: summary };
    }
    if (what === 'ice') {
      chilled = chilled === i ? -1 : i;
      summary = chilled < 0 ? '取消补冰。' : `收市时给${PRODUCE[chilled].name}最早到期的两箱补冰。`;
      return;
    }
    let spoiled = 0;
    bins.forEach((bin, index) => {
      bin.sort((a, b) => a - b);
      bins[index] = bin.map((life, position) => index === chilled && position < 2 ? life : life - 1).filter(life => {
        if (life > 0) return true;
        spoiled++;
        return false;
      });
    });
    if (chilled >= 0 && bins[chilled].length) cash -= 3;
    waste += spoiled;
    summary = `第 ${++night} 晚接 ${accepted.size} 单，报废 ${spoiled} 箱。`;
    if (night === nights.length) {
      const success = sales >= 8 && cash >= 105 && waste <= 8;
      return { end: `${success ? '夜市经营达标。' : '夜市经营尚未达标。'}成交 ${sales} 单，净赚 ${cash} 元，报废 ${waste} 箱。` };
    }
    accepted.clear();
    chilled = -1;
    deliver();
    return { message: summary };
  }

  station(host, api, 'market', view, move);
}
