import assert from 'node:assert/strict';
import test from 'node:test';
import { games } from '../src/expansion/arcade-catalog.js';
import { mount } from '../src/expansion/arcade.js';

class Element {
  constructor(ownerDocument) {
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.listeners = [];
    this.style = {};
    this.attributes = new Map();
  }
  addEventListener(type, callback, { signal } = {}) { this.listeners.push({ type, callback, signal }); }
  append(...elements) { this.children.push(...elements); }
  replaceChildren(...elements) { this.children = elements; }
  querySelector() { return null; }
  querySelectorAll() { return this.children; }
  setAttribute(key, value) { this.attributes.set(key, value); }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.width / 2, height: this.height / 2 }; }
  setPointerCapture() {}
  focus() {}
  emit(type, properties) {
    if (this.disabled) return;
    const event = { target: this, button: 0, preventDefault() {}, ...properties };
    for (const listener of this.listeners) {
      if (listener.type === type && !listener.signal?.aborted) listener.callback(event);
    }
  }
}

function game(id, random = .5) {
  const doc = new Element();
  const screenText = [];
  const ctx = new Proxy({
    fillRect() { screenText.length = 0; },
    fillText(...args) { screenText.push(args); },
  }, { get: (target, key) => target[key] ?? (() => {}) });
  doc.createElement = () => {
    const element = new Element(doc);
    element.getContext = () => ctx;
    return element;
  };
  const host = new Element(doc);
  const controller = new AbortController();
  let elapsed = 0, frame, practice = false, result, status;
  mount(id, host, {
    signal: controller.signal,
    end(message, metric) { result = { message, metric }; controller.abort(); },
    elapsed: () => elapsed,
    random: () => random,
    frame(fn) { frame = fn; },
    status(value) { status = value; },
    unrank() { practice = true; },
  });
  const [stats, canvas, controls] = host.children[0].children;
  return {
    get practice() { return practice; },
    get result() { return result; },
    get stats() { return stats.textContent; },
    get status() { return status; },
    get time() { return elapsed; },
    button(name) {
      const button = controls.children.find(button => button.textContent === name);
      assert.ok(button, `missing control: ${name}`);
      return button;
    },
    click(name) { this.button(name).emit('click'); },
    tap(x, y) {
      const point = { pointerId: 1, clientX: x, clientY: y };
      canvas.emit('pointerdown', point);
      canvas.emit('pointerup', point);
      canvas.emit('click', point);
    },
    key(key) { doc.emit('keydown', { key }); },
    release(key) { doc.emit('keyup', { key }); },
    step(seconds) {
      const steps = Math.ceil(seconds * 60);
      for (let i = 0; i < steps && !result; i++) {
        elapsed += seconds / steps;
        frame(seconds / steps);
      }
    },
    screenText,
    abort: () => controller.abort(),
  };
}

test('the ten arcade entries mount in order and offer numeric score records', () => {
  assert.deepEqual(games.map(item => item.name), [
    '街机弹球', '小队过河', '切水果', '堆塔高手', '抓娃娃',
    '矿井抓金', '弹跳涂色', '节拍落键', '街头套圈', '小行星漂移',
  ]);
  assert.equal(new Set(games.map(item => item.id)).size, 10);
  for (const item of games) {
    assert.equal(item.metric.direction, 'desc');
    const round = game(item.id);
    assert.ok(round.stats);
    assert.equal(round.practice, false);
    round.abort();
  }
});

test('pinball physically dispatches and settles three balls on each table, with alternate tables in practice', () => {
  for (const [index, table] of ['星光轨道', '潮汐码头', '钟表工坊'].entries()) {
    const round = game('pinball');
    round.click(table);
    for (let attempt = 0; attempt < 3; attempt++) {
      round.click('发球');
      assert.ok(round.button('星光轨道').disabled);
      for (let t = 0; t < 84 && round.status === '球已发出'; t++) round.step(.5);
      assert.match(round.stats, new RegExp(`钢球 ${2 - attempt}/3`), table);
    }
    assert.equal(round.practice, index > 0);
    assert.ok(Number.isSafeInteger(round.result.metric));
    assert.ok(round.result.metric > 0);
  }
});

test('river traffic consumes limited chances and still settles an unfinished crossing', () => {
  const round = game('river-squad', 0);
  round.key('ArrowUp');
  round.step(.5);
  assert.match(round.stats, /机会 4\/5/);
  round.step(70);
  assert.equal(round.result.metric, 0);
});

test('fruit tapping cuts a visible fruit and repeated misses finish the round', () => {
  const round = game('fruit-slice');
  round.step(.8);
  const fruit = round.screenText.find(([symbol]) => ['桃', '橙', '梨', '李'].includes(symbol));
  assert.ok(fruit);
  round.tap(fruit[1], fruit[2]);
  round.step(12);
  assert.equal(round.result.metric, 10);
  assert.match(round.result.message, /漏切/);
});

test('tower rewards exact overlap and cuts excess before a subsequent miss', () => {
  const round = game('tower-stack');
  round.step(.79);
  round.key(' ');
  round.click('落块');
  round.click('落块');
  assert.equal(round.result.metric, 25);
  assert.match(round.result.message, /2 层/);
});

test('the claw rewards a timed catch and six tokens finish the conveyor', () => {
  const round = game('toy-claw', .25);
  round.tap(210, 66);
  for (let i = 0; i < 6; i++) {
    round.click('下爪');
    round.step(2.4);
    if (i === 0) assert.match(round.stats, /得分 110/);
  }
  assert.ok(Number.isSafeInteger(round.result.metric));
});

test('mining awards a selected ore only when the hook returns', () => {
  const round = game('gold-mine');
  round.step(Math.asin(Math.atan2(78, 76) / 1.24) / 1.9);
  round.key(' ');
  round.step(.1);
  assert.match(round.stats, /得分 0/);
  round.step(1.5);
  assert.match(round.stats, /得分 45/);
  round.step(60);
  assert.equal(round.result.metric, 45);
});

test('paint is added by landing and abort clears input before restart', () => {
  const round = game('bounce-paint');
  round.key('ArrowRight');
  round.step(.2);
  assert.match(round.stats, /已涂 2\//);
  round.step(50);
  assert.equal(round.result.metric, 10);
  const restarted = game('bounce-paint');
  restarted.abort();
  restarted.key('ArrowRight');
  restarted.step(.3);
  assert.match(restarted.stats, /已涂 1\//);
});

test('rhythm awards accurate notes and breaks a combo when a note is missed', () => {
  const round = game('beat-keys');
  round.step(2);
  round.key('d');
  round.step(.48);
  round.click('F');
  round.step(.2);
  assert.match(round.stats, /得分 205.*连击 2/);
  round.step(.7);
  assert.match(round.stats, /连击 0/);
  round.step(25);
  assert.equal(round.result.metric, 205);
});

test('ring toss rewards a successful shot once and consumes all eight rings', () => {
  const round = game('street-rings');
  const powerTime = Math.acos(1 - 2 * (107 - 77) / 202) / 3.4;
  round.step(powerTime);
  round.key(' ');
  round.step(.8);
  assert.match(round.stats, /得分 40/);
  round.step(2 * Math.PI / 3.4 - .8);
  round.click('投圈');
  round.step(.8);
  assert.match(round.stats, /得分 40/);
  for (let i = 0; i < 6; i++) { round.click('投圈'); round.step(.75); }
  assert.ok(round.result.metric >= 40);
});

test('drift supports sustained thrust, completes a run and reports a survival score', () => {
  const round = game('asteroid-drift');
  round.key(' ');
  round.step(2);
  round.release(' ');
  round.step(60);
  assert.ok(Number.isSafeInteger(round.result.metric));
  assert.ok(round.result.metric > 0);
});
