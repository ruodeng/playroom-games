import assert from 'node:assert/strict';
import { setMaxListeners } from 'node:events';
import test from 'node:test';
import { games } from '../src/expansion/sports-catalog.js';
import { scoreBowling } from '../src/expansion/sports-shots.js';
import { scoreHouse } from '../src/expansion/sports-table.js';
import { mount } from '../src/expansion/sports.js';

const noop = () => {};

class FakeNode extends EventTarget {
  constructor(tag, doc) {
    super();
    this.tag = tag;
    this.ownerDocument = doc;
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
  }
  append(node) { this.children.push(node); }
  replaceChildren() { this.children.length = 0; }
  getContext() { return new Proxy({}, { get: () => noop }); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: this.width / 2, height: this.height / 2 }; }
}

function game(id) {
  const doc = new EventTarget();
  doc.defaultView = new EventTarget();
  doc.createElement = tag => new FakeNode(tag, doc);
  const host = new FakeNode('main', doc);
  const controller = new AbortController();
  setMaxListeners(0, controller.signal);
  let update;
  let result = null;
  let status;
  let now = 0;
  mount(id, host, {
    signal: controller.signal, random: () => .5, elapsed: () => now,
    frame: fn => { update = fn; }, status: text => { status = text; },
    end: (text, metric) => {
      assert.equal(result, null);
      assert.ok(Number.isSafeInteger(metric), `${id} must submit a safe integer`);
      result = { text, metric };
      controller.abort();
    },
  });
  const root = host.children[0];
  const [stats, canvas, instruments, controls] = root.children;
  const event = (target, name, extra) => target.dispatchEvent(Object.assign(new Event(name, { cancelable: true }), extra));
  function tick(dt = .02) {
    now += dt;
    update(dt);
  }
  function until(condition, limit = 10) {
    const max = now + limit;
    while (!condition() && now < max) tick();
    assert.ok(condition(), `${id} exceeded ${limit}s: ${status}`);
  }
  return {
    tick, until,
    get result() { return result; },
    get stats() { return stats.children.map(wrap => String(wrap.children[1].textContent)); },
    get time() { return now; },
    get status() { return status; },
    get meter() { return instruments.children[0]; },
    click(text) {
      const button = controls.children.find(node => node.textContent === text);
      assert.ok(button && !button.disabled, `${id}: ${text} unavailable; ${status}`);
      event(button, 'click', { detail: 0 });
    },
    canClick(text) { return !controls.children.find(node => node.textContent === text)?.disabled; },
    key(key, release = true) {
      event(doc, 'keydown', { key });
      if (release) event(doc, 'keyup', { key });
    },
    aim(x, y, hold = false) {
      const pointer = { clientX: x, clientY: y, button: 0, pointerId: 1 };
      event(canvas, 'pointerdown', pointer);
      if (!hold) event(canvas, 'pointerup', pointer);
    },
    slide(label, value) {
      const input = controls.children.flatMap(node => node.children).find(node => node.getAttribute('aria-label') === label);
      assert.ok(input);
      input.value = value;
      event(input, 'input');
    },
  };
}

test('九洞可逐一进洞，第九洞提交总杆数', () => {
  const golf = game(games[0].id);
  const routes = [
    [[195, 260], [195, 65]],
    [[76, 248], [100, 75], [308, 62]],
    [[85, 248], [95, 84], [308, 73]],
    [[91, 254], [185, 211], [185, 95], [315, 74]],
    [[83, 261], [309, 238], [306, 147], [88, 145], [88, 57], [317, 58]],
    [[316, 261], [322, 50], [71, 60]],
    [[210, 268], [136, 226], [134, 132], [86, 132], [84, 74], [114, 64]],
    [[69, 265], [84, 83], [233, 45], [349, 44], [350, 264], [329, 264]],
    [[193, 268], [133, 220], [148, 144], [146, 85], [196, 57]],
  ];
  for (let i = 0; i < routes.length; i++) {
    assert.equal(golf.stats[0], `${i + 1} / 9`);
    const route = routes[i];
    for (let stroke = 1; stroke < route.length; stroke++) {
      const [x, y] = route[stroke];
      const [previousX, previousY] = route[stroke - 1];
      const length = Math.hypot(x - previousX, y - previousY);
      golf.aim(x, y);
      golf.slide('力度', Math.round((length * 1.35 + 5 - 24) / 5.4));
      golf.click('推杆');
      golf.until(() => golf.result || golf.canClick('推杆'));
    }
  }
  assert.match(golf.result.text, /打完九洞/);
  assert.equal(golf.result.metric, routes.reduce((sum, route) => sum + route.length - 1, 0));
});

test('十二次投篮、十次点球和十格保龄球均按正式成绩结算', () => {
  const basketball = game('spot-basketball');
  for (let i = 0; i < 12; i++) {
    basketball.until(() => {
      const [band, , marker] = basketball.meter.children;
      const start = parseFloat(band.style.left);
      const width = parseFloat(band.style.width);
      return Math.abs(parseFloat(marker.style.left) - start - width / 2) < width * .3;
    });
    basketball.key(' ');
    basketball.until(() => basketball.result || basketball.canClick('投篮'));
  }
  assert.equal(basketball.result.metric, 12);

  const penalty = game('penalty-kicks');
  penalty.aim(318, 52);
  penalty.click('射门');
  penalty.until(() => penalty.canClick('射门'));
  assert.equal(penalty.stats[1], '1 球');
  for (let i = 1; i < 10; i++) {
    penalty.aim(i % 2 ? 341 : 72, 55);
    penalty.click('射门');
    penalty.until(() => penalty.result || penalty.canClick('射门'));
  }
  assert.ok(penalty.result.metric > 0 && penalty.result.metric < 10);

  const bowling = game('curve-bowling');
  bowling.slide('站位', 52);
  bowling.slide('旋转', -45);
  for (let i = 0; i < 12; i++) {
    bowling.click('滚球');
    bowling.until(() => bowling.result || bowling.canClick('滚球'));
  }
  assert.equal(bowling.result.metric, 300);
  assert.equal(scoreBowling([...Array.from({ length: 9 }, () => [7, 3]), [7, 3, 7]]), 170);
});

test('冰壶按圆心占位计分，台球支持入袋和完整机会结算', () => {
  assert.deepEqual(scoreHouse([
    { x: 192, y: 85, team: 'player' }, { x: 195, y: 94, team: 'player' },
    { x: 212, y: 85, team: 'rival' }, { x: 222, y: 85, team: 'player' },
  ]), { player: 2, rival: 0 });
  const curling = game('curling-house');
  for (let i = 0; i < 12; i++) {
    curling.click('投壶');
    curling.until(() => curling.result || curling.canClick('投壶'), 14);
  }
  assert.match(curling.result.text, /四局结束/);
  assert.ok(curling.result.metric > 0);

  const pool = game('pocket-pool');
  pool.aim(291.9, 114.5);
  pool.slide('力度', 100);
  pool.click('击球');
  pool.until(() => pool.canClick('击球'));
  assert.match(pool.stats[0], /^[1-6] /);
  for (let i = 0; !pool.result && i < 11; i++) {
    pool.click('击球');
    pool.until(() => pool.result || pool.canClick('击球'));
  }
  assert.ok(pool.result.metric >= 10);
});

test('竞速四项结算时间为整秒，投入操作能改善成绩', () => {
  const ski = game('ski-slalom');
  ski.aim(156, 245, true);
  ski.until(() => Number(ski.stats[0].split(' ')[0]) >= 1);
  ski.until(() => ski.result, 60);
  assert.ok(ski.result.metric > 30);

  const rowing = game('rowing-rhythm');
  for (let i = 0; !rowing.result && i < 65; i++) {
    rowing.until(() => rowing.result || rowing.time >= (i + .65) * 1.36);
    if (!rowing.result) rowing.click('拉桨');
  }
  assert.ok(rowing.result.metric < 80);
  assert.match(rowing.result.text, /完成 500 米/);

  const cycling = game('track-cycling');
  cycling.click('外移 →');
  cycling.key(' ', false);
  cycling.until(() => cycling.result, 90);
  assert.ok(cycling.result.metric < 65);

  const relay = game('sprint-relay');
  let foot = 'ArrowLeft';
  let nextStep = 0;
  while (!relay.result && relay.time < 65) {
    if (relay.time >= nextStep) {
      relay.key(foot);
      foot = foot === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
      nextStep += .23;
    }
    const legProgress = Number(relay.stats[1].split(' ')[0]) % 100;
    if (legProgress >= 95 && relay.canClick('交棒')) relay.click('交棒');
    relay.tick();
  }
  assert.equal(relay.stats[2], '0 秒');
  assert.ok(relay.result.metric < 48);
});
