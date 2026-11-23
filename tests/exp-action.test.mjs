import assert from 'node:assert/strict';
import { test } from 'node:test';
import { games } from '../src/expansion/action-catalog.js';
import { mount } from '../src/expansion/action.js';
import { gliderGates } from '../src/expansion/action-flight.js';
import { gravityBarriers, lavaPlatforms, ruinLayouts } from '../src/expansion/action-platform.js';
import { shadowRooms } from '../src/expansion/action-rooms.js';

const noop = () => {};
class Element extends EventTarget {
  children = [];
  attributes = new Map();
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(key, value) { this.attributes.set(key, value); }
  hasAttribute(key) { return this.attributes.has(key); }
  setPointerCapture() {}
  getContext() { return this.context; }
  contains(element) { return this.children.some(child => child === element || child.contains(element)); }
}

function start(id) {
  const drawn = {};
  const context = new Proxy({
    createLinearGradient: () => ({ addColorStop: noop }),
    translate(x, y) { drawn.actor = { x, y }; },
    beginPath() { this.vertices = []; this.circle = null; this.shape = null; },
    moveTo(x, y) { this.vertices.push([x, y]); },
    lineTo(x, y) { this.vertices.push([x, y]); },
    arc(x, y, radius) { this.circle = { x, y, radius }; },
    roundRect(x, y, w, h) { this.shape = w === 14 && h === 15 ? { x: x + 7, y: y + 5 } : null; },
    fill() {
      if (this.shape && this.fillStyle === '#ffc0a0') drawn.actor = this.shape;
      if (this.fillStyle === '#438d9c' && this.vertices.length > 20) drawn.river = this.vertices;
      if (this.fillStyle === '#b7e9e37a' && this.circle) (drawn.rocks ??= []).push(this.circle);
    },
    ellipse(x, y, horizontalRadius, radius) { (drawn.rings ??= []).push({ x, y, radius }); },
  }, { get: (target, key) => key in target ? target[key] : noop });
  globalThis.document = { createElement: () => Object.assign(new Element(), { context }) };
  globalThis.window = new EventTarget();
  const host = new Element();
  const controller = new AbortController();
  let elapsed = 0, result, frame, status;
  mount(id, host, {
    signal: controller.signal,
    frame(fn) { frame = fn; },
    elapsed: () => elapsed,
    status(value) { status = value; },
    end(message, metric) {
      if (metric !== null) assert.ok(Number.isSafeInteger(metric), 'ranked results use whole leaderboard units');
      result = { message, metric };
    },
  });
  assert.equal(host.children.length, 1);
  assert.equal(typeof frame, 'function');
  const keyboard = (type, key) => window.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { key }));
  return {
    drawn,
    get result() { return result; }, get status() { return status; }, get elapsed() { return elapsed; },
    tick(amount = 1 / 120) {
      for (let remaining = amount; remaining > 1e-6 && !result; remaining -= 1 / 120) {
        const dt = Math.min(remaining, 1 / 120);
        elapsed += dt;
        drawn.rings = [];
        drawn.rocks = [];
        frame(dt);
      }
    },
    down: key => keyboard('keydown', key), up: key => keyboard('keyup', key),
    tap(key) { this.down(key); this.up(key); this.tick(); },
    tapButton(index) {
      const button = host.children[0].children[1].children[index];
      button.dispatchEvent(Object.assign(new Event('pointerdown'), { pointerId: 1, button: 0 }));
      button.dispatchEvent(Object.assign(new Event('pointerup'), { pointerId: 1, button: 0 }));
      this.tick();
    },
    stop() { controller.abort(); },
  };
}

test('all ten catalog games mount with a visible starting status and accept a frame', () => {
  assert.equal(games.length, 10);
  assert.equal(new Set(games.map(game => game.id)).size, 10);
  for (const game of games) {
    const run = start(game.id);
    run.tick(.2);
    assert.ok(run.status, game.id);
    assert.equal(run.result, undefined, game.id);
    run.stop();
  }
});

test('all four shadow rooms open through reachable crate moves and report completion', () => {
  const run = start('shadow-mechanism');
  const moves = [[1, 0, 'ArrowRight'], [-1, 0, 'ArrowLeft'], [0, 1, 'ArrowDown'], [0, -1, 'ArrowUp']];
  function route(map) {
    const locate = marking => map.flatMap((row, y) => [...row].flatMap((tile, x) => tile === marking ? [[x, y]] : []));
    const sensors = locate('S');
    const first = [locate('P')[0], locate('X'), []];
    const queue = [first];
    const visited = new Set();
    for (let head = 0; head < queue.length; head++) {
      const [player, boxes, keys] = queue[head];
      if (map[player[1]][player[0]] === 'E') return keys;
      const id = [player.join(), boxes.map(box => box.join()).sort().join('|')].join('/');
      if (visited.has(id)) continue;
      visited.add(id);
      const opened = sensors.every(([sx, sy]) => boxes.some(([bx, by]) => by === sy && bx > 1 && bx < sx));
      const accessible = (x, y) => !'#L'.includes(map[y][x]) && (map[y][x] !== 'G' || opened);
      for (const [dx, dy, key] of moves) {
        const x = player[0] + dx, y = player[1] + dy;
        if (!accessible(x, y)) continue;
        const index = boxes.findIndex(([a, b]) => a === x && b === y);
        const next = boxes.slice();
        if (index >= 0) {
          const bx = x + dx, by = y + dy;
          if (!accessible(bx, by) || 'GS'.includes(map[by][bx]) || boxes.some(([a, b]) => a === bx && b === by)) continue;
          next[index] = [bx, by];
        }
        queue.push([[x, y], next, [...keys, key]]);
      }
    }
    assert.fail('shadow room cannot reach its exit');
  }
  for (const room of shadowRooms) for (const key of route(room)) { run.tap(key); run.tick(.14); }
  assert.match(run.result?.message ?? '', /全部解开/);
  assert.ok(run.result.metric > 0);
  run.stop();
});

test('ruin exits unlock after collecting all three gems in each of six levels', () => {
  const run = start('ruin-treasure');
  for (const [level, islands] of ruinLayouts.entries()) {
    let x = 42;
    function walkTo(target) {
      const key = target > x ? 'ArrowRight' : 'ArrowLeft';
      run.down(key);
      run.tick(Math.abs(target - x) / 150);
      run.up(key);
      x = target;
    }
    for (let island = 1; island < islands.length; island++) {
      walkTo(islands[island - 1][1] - 5);
      run.tick(.32);
      run.tap(' ');
      walkTo(islands[island][0] + 21);
      run.tick(.55);
      if (island === islands.length - 1) break;
      const [a, b] = islands[island];
      walkTo((a + b) / 2 + (level % 2 ? -10 : 12) * (island % 2 ? 1 : -1));
      run.tap(' ');
      run.tick(.97);
      assert.match(run.status, new RegExp(`晶石 ${island} / 3`));
    }
    walkTo(islands.at(-1)[1] - 60);
  }
  assert.match(run.result?.message ?? '', /六段遗迹/);
  assert.ok(run.result.metric > 0);
  run.stop();
});

test('pendulum can grab every ring and gravity can collect every trail pearl', () => {
  const tower = start('pendulum-tower');
  while (tower.elapsed < 30 && !tower.result) {
    if (tower.status.includes('距离合适')) tower.tapButton(0);
    else tower.tick();
  }
  assert.match(tower.result?.message ?? '', /登顶成功/);
  tower.stop();

  const track = start('gravity-flip');
  let down = true;
  for (const [x, lower] of gravityBarriers) {
    track.tick((x - 88 - 45) / 112 - track.elapsed);
    if (down === Boolean(lower)) { track.tap(' '); down = !down; }
  }
  track.tick(3);
  assert.equal(track.result?.metric, gravityBarriers.length * 125 + 300);
  track.stop();
});

test('drill can return with six crystals, and the stealth room has a timed escape route', () => {
  const keys = { D: 'ArrowDown', U: 'ArrowUp', L: 'ArrowLeft', R: 'ArrowRight' };
  const mine = start('rock-drill');
  for (const direction of 'DDRRUURRRRRRRDDLRDDDDDULLLLLLULRDRRRRRRDD') {
    mine.tap(keys[direction]);
    mine.tick(.18);
  }
  assert.match(mine.result?.message ?? '', /矿晶全部运出/, mine.status);
  assert.ok(mine.result.metric > 0);
  mine.stop();

  const guards = start('stealth-key');
  for (const direction of 'RRDDDDRRRRDDDRRRUUUUUUU') {
    guards.tap(keys[direction]);
    guards.tick(.15);
  }
  assert.match(guards.result?.message ?? '', /成功拿到钥匙/, guards.status);
  guards.stop();
});

test('a valid lunar landing records fuel and an uncontrolled descent fails', () => {
  const crash = start('lunar-landing');
  crash.tick(8);
  assert.match(crash.result?.message ?? '', /撞上/);
  assert.equal(crash.result.metric, null);
  crash.stop();

  const flight = start('lunar-landing');
  function hold(key, seconds) {
    flight.down(key);
    flight.tick(seconds);
    flight.up(key);
  }
  hold('ArrowRight', .43);
  hold(' ', .8);
  hold('ArrowLeft', .86);
  hold(' ', .8);
  hold('ArrowRight', .43);
  flight.tick(1.25);
  hold(' ', .7);
  flight.tick(5);
  assert.match(flight.result?.message ?? '', /安全着陆/, flight.status);
  assert.ok(flight.result.metric > 0 && flight.result.metric < 100);
  flight.stop();
});

test('the rising lava allows an uninterrupted ascent to the final platform', () => {
  const run = start('lava-escape');
  let steer = 0, previous = run.drawn.actor.x;
  for (const next of lavaPlatforms.slice(1)) {
    for (let frame = 0; frame < 83 && !run.result; frame++) {
      const position = run.drawn.actor.x;
      const error = next.x - position - (position - previous) * 9;
      const desired = Math.abs(error) > 2 ? Math.sign(error) : 0;
      if (desired !== steer) {
        if (steer) run.up(steer > 0 ? 'ArrowRight' : 'ArrowLeft');
        if (desired) run.down(desired > 0 ? 'ArrowRight' : 'ArrowLeft');
        steer = desired;
      }
      previous = position;
      run.tick();
    }
  }
  assert.match(run.result?.message ?? '', /冲出火山/, run.status);
  assert.ok(run.result.metric >= 500);
  run.stop();
});

test('raft can steer through the river and glider can fly through every gate', () => {
  function pilot(run, negative, positive, target, coordinate, margin, limit) {
    let held, previous = coordinate(run.drawn.actor);
    while (!run.result && run.elapsed < limit) {
      const position = coordinate(run.drawn.actor);
      const error = target(run.drawn) - position - margin * (position - previous);
      const key = Math.abs(error) < 2.5 ? undefined : error > 0 ? positive : negative;
      if (key !== held) {
        if (held) run.up(held);
        if (key) run.down(key);
        held = key;
      }
      previous = position;
      run.tick();
    }
  }
  const raft = start('river-raft');
  pilot(raft, 'ArrowLeft', 'ArrowRight', ({ actor, river, rocks }) => {
    const middle = y => {
      const row = Math.round(y / 8);
      return (river[row][0] + river.at(-1 - row)[0]) / 2;
    };
    const upcoming = rocks.find(rock => rock.y >= actor.y - 61 && rock.y <= actor.y + 25);
    if (!upcoming) return middle(actor.y - 38);
    const center = middle(upcoming.y);
    if (Math.abs(upcoming.x - center) > upcoming.radius + 17) return middle(actor.y - 38);
    return upcoming.x + (upcoming.x > center ? -1 : 1) * (upcoming.radius + 22);
  }, actor => actor.x, 18, 30);
  assert.match(raft.result?.message ?? '', /驶过终点/, raft.status);
  raft.stop();

  const glider = start('glider-gates');
  pilot(glider, 'ArrowUp', 'ArrowDown', ({ actor, rings }) => {
    const next = rings.filter(ring => ring.x >= actor.x).sort((a, b) => a.x - b.x)[0];
    return next?.y ?? 151;
  }, actor => actor.y, 30, 32);
  assert.match(glider.result?.message ?? '', new RegExp(`穿过 ${gliderGates.length} 道风门`), glider.status);
  glider.stop();
});
