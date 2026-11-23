import assert from 'node:assert/strict';
import test from 'node:test';
import { games } from '../src/expansion/sim-catalog.js';
import { mount } from '../src/expansion/sim.js';

// Drive each game's public click handler and reject actions unavailable in the rendered state.
function session(id, random = () => 0) {
  const controller = new AbortController();
  const ends = [];
  let surface;
  class Surface extends EventTarget {}
  const host = {
    ownerDocument: { createElement: () => new Surface(), activeElement: null },
    replaceChildren(next) { surface = next; },
  };
  mount(id, host, { random, signal: controller.signal, status() {}, end: (...args) => ends.push(args) });
  const markup = key => [...surface.innerHTML.matchAll(/<button\b[^>]*>/g)].find(([tag]) => tag.includes(`data-sim-action="${key}"`))?.[0];
  const enabled = key => !!markup(key) && !/\sdisabled\b/.test(markup(key));
  const click = (...keys) => keys.forEach(key => {
    assert.ok(enabled(key), `${id}: ${key} is unavailable`);
    const event = new Event('click');
    Object.defineProperty(event, 'target', { value: { closest: () => ({ dataset: { simAction: key } }) } });
    surface.dispatchEvent(event);
  });
  const result = (pattern, metric = null) => {
    assert.equal(ends.length, 1);
    assert.match(ends[0][0], pattern);
    assert.equal(ends[0][1], metric);
  };
  return { enabled, click, result, ends, stop: () => controller.abort(), html: () => surface.innerHTML };
}

test('only breakfast stall publishes a metric and it accepts operating losses', () => {
  assert.equal(games.length, 10);
  assert.equal(new Set(games.map(game => game.id)).size, 10);
  assert.deepEqual(games.filter(game => game.metric).map(game => game.id), ['breakfast-stall']);
  assert.equal(games[0].metric.direction, 'desc');

  const loss = session('breakfast-stall');
  for (let day = 0; day < 5; day++) {
    loss.click('open');
    assert.equal(loss.ends.length, 0);
  }
  loss.click('open');
  loss.result(/六天收摊.*-72 元/, -72);
  assert.ok(games[0].metric.min <= -72);
  assert.equal(loss.enabled('open'), false);

  const full = session('breakfast-stall');
  for (let day = 0; day < 6; day++) {
    for (let item = 0; item < 3; item++) full.click(...Array(5).fill(`stock-${item}-1`));
    full.click('open');
  }
  full.result(/六天收摊.*288 元/, 288);

  const stopped = session('breakfast-stall');
  const display = stopped.html();
  stopped.stop();
  stopped.click('open');
  assert.equal(stopped.html(), display);
});

test('greenhouse can harvest all three crops through the seasonal heat changes', () => {
  const { click, result } = session('four-season-greenhouse');
  click('bed-0', 'bed-1', 'seed-2', 'bed-2', 'bed-3', 'advance', 'advance');
  click('harvest', 'bed-0', 'bed-1', 'bed-2', 'bed-3', 'advance');
  click('seed-1', 'bed-0', 'bed-1', 'advance');
  click('water', 'bed-0', 'bed-1', 'advance', 'vent', 'advance', 'harvest', 'bed-0', 'bed-1');
  click(...Array(6).fill('advance'));
  result(/四季丰收.*生菜 2 株、番茄 2 株、萝卜 2 株/);
});

test('bookshop applies matching stock and records window recommendations across five weeks', () => {
  const { click, result } = session('corner-bookshop');
  for (const selection of [[2, 0, 3], [1, 4, 5], [0, 3, 5], [4, 5, 2], [3, 2, 0]]) {
    click(...selection.map(i => `book-${i}`), 'welcome');
  }
  result(/赢得街坊信赖.*19 人.*9 次/);
});

test('inn carries multi-night bookings, cleans after checkout and honors confirmed arrivals', () => {
  const { click, enabled, result } = session('mountain-inn');
  click('book-0', 'room-0', 'book-1', 'room-2', 'sleep');
  click('book-0');
  assert.equal(enabled('room-0'), false);
  click('room-2', 'room-2', 'book-1', 'room-1', 'sleep');
  click('book-0', 'room-3', 'room-0', 'book-1', 'room-0', 'sleep');
  click('room-2', 'book-0', 'room-2', 'room-1', 'book-1', 'room-1', 'sleep');
  click('room-3', 'book-0', 'room-3', 'room-2', 'book-1', 'room-2', 'sleep');
  click('room-0', 'book-0', 'room-0', 'room-3', 'book-1', 'room-3', 'sleep');
  result(/旅店经营达标.*1262 元.*错过 0 张/);
});

test('night market can fill mixed orders without running out of stock or exceeding spoilage', () => {
  const { click, enabled, result } = session('night-market-produce');
  click('order-0', 'order-1', 'order-2', 'ice-0', 'close');
  assert.equal(enabled('order-1'), false);
  click('order-0', 'order-2', 'close');
  click('order-0', 'order-2', 'ice-0', 'close');
  click('order-0', 'order-1', 'order-2', 'close');
  click('order-0', 'order-1', 'order-2', 'close');
  result(/夜市经营达标.*成交 13 单/);
});

test('power grid can preserve clinic service and balance residential coverage against purchase costs', () => {
  const { click, result } = session('community-grid', () => 0.5);
  click('switch', 'buy-more', 'buy-more', 'switch', 'buy-more', 'switch', 'store', 'switch', 'switch');
  click('home', 'output', 'switch', 'switch', 'home', 'buy-more', 'buy-more', 'switch');
  result(/社区调度达标.*医院停电 0 班，居民通电 6 班，购电 9 元/);
});

test('recycling station supports contaminated material, full bins, and truck transitions', () => {
  const { click, enabled, result } = session('city-recycling');
  click('bin-0', 'bin-1', 'wash', 'bin-1', 'bin-2', 'wash', 'bin-0', 'bin-3', 'bin-2', 'truck');
  click('bin-0', 'wash', 'bin-1', 'bin-2');
  assert.equal(enabled('bin-0'), false);
  click('haul', 'bin-0', 'bin-0', 'haul', 'bin-1', 'bin-1', 'bin-3', 'bin-3', 'truck');
  click('bin-0', 'wash', 'bin-1', 'haul', 'bin-2', 'bin-2', 'bin-0', 'bin-1', 'bin-3', 'wash', 'bin-2', 'truck');
  result(/分类完成，回收达标.*正确回收 17 件，误投 0 件/);
});

test('theater reserves every slot of a show and enforces changeover gaps', () => {
  const { click, enabled, result } = session('little-theater');
  click('select-0', 'slot-0-0', 'select-2');
  assert.equal(enabled('slot-0-2'), false);
  click('slot-0-1');
  assert.equal(enabled('slot-0-2'), true);
  click('slot-1-2', 'select-0', 'slot-0-0', 'select-3', 'slot-2-3', 'select-4', 'slot-2-0', 'finalize');
  result(/排期成功.*305 人/);
});

test('auction collects real bid and sale proceeds and accepts skipped lots', () => {
  const { click, enabled, result } = session('fishing-port-auction', () => 0.5);
  assert.equal(enabled('sell-1'), false);
  const raise = Array(5).fill('more');
  click(...raise, 'bid', 'sell-1', ...raise, 'bid', 'sell-2', 'pass', 'pass');
  result(/渔港生意达标.*2 家买家成交，净利润 42 元/);
});

test('island combines road access, neighborhood effects and an annual operating budget', () => {
  const { click, enabled, result } = session('island-town');
  assert.equal(enabled('tile-7'), false);
  click('tile-11', 'set-home', 'tile-6', 'tile-5', 'year');
  click('set-road', 'tile-12', 'set-park', 'tile-7', 'set-home', 'tile-15', 'year');
  click('set-road', 'tile-17', 'set-park', 'tile-16', 'tile-18', 'year');
  click('set-work', 'tile-13', 'tile-22', 'year', 'year', 'year');
  result(/小镇建设达标.*人口 8 户，岗位 6 个，公园 3 处，余额 89 元/);
});
