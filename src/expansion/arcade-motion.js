import { WIDTH, TAU, circle, clamp, line, nearestPoint, pill, polygon, screen, star, text } from './arcade-view.js';

const pinballTables = [
  { name: '星光轨道', backdrop: '#171c36', field: '#222b50', edge: '#7886c7', color: '#a2b6fb',
    bumps: [[104, 104, 22, 80], [241, 112, 22, 80], [178, 187, 26, 140], [84, 267, 18, 55], [266, 273, 18, 55]],
    bars: [[68, 167, 123, 186], [270, 178, 312, 153], [127, 313, 164, 333], [199, 333, 237, 312]] },
  { name: '潮汐码头', backdrop: '#102d31', field: '#174047', edge: '#68999a', color: '#83dec3',
    bumps: [[72, 126, 16, 65], [142, 163, 24, 125], [221, 212, 23, 125], [291, 259, 16, 65], [117, 299, 18, 80]],
    bars: [[227, 79, 300, 115], [47, 215, 89, 240], [143, 253, 172, 269], [237, 301, 299, 323]] },
  { name: '钟表工坊', backdrop: '#322331', field: '#4b3039', edge: '#b38a78', color: '#f4bc76',
    bumps: [[177, 111, 30, 160], [80, 191, 26, 100], [280, 191, 26, 100], [180, 270, 22, 80]],
    bars: [[67, 92, 107, 125], [254, 125, 297, 92], [54, 270, 105, 307], [252, 307, 299, 270], [148, 329, 215, 329]] },
];

const pinballFrame = [
  [18, 331, 18, 64], [18, 64, 57, 26], [57, 26, 303, 26],
  [303, 26, 342, 64], [342, 64, 342, 331], [18, 331, 100, 410], [342, 331, 260, 410],
];

export function pinball(host, api) {
  const view = screen(host, api, '街机弹球', 457, pinballTables[0].backdrop);
  const { ctx, canvas } = view;
  let table = pinballTables[0], balls = 3, score = 0, ball, started = false, activeTime = 0, servedAt = 0, stuckFor = 0;
  const flash = new Map();
  const left = view.hold('左挡板', ['arrowleft', 'a']);
  const right = view.hold('右挡板', ['arrowright', 'd']);
  const serve = () => {
    if (ball || !balls) return;
    started = true;
    for (const button of tableButtons) button.disabled = true;
    ball = { x: 326, y: 327, vx: -72 + (3 - balls) * 12, vy: -550 };
    servedAt = activeTime;
    view.say('球已发出');
  };
  view.button('发球', serve);
  view.keys([' '], serve);
  const tableButtons = pinballTables.map((entry, index) => {
    const button = view.button(entry.name, () => {
      if (started || table === entry) return;
      table = entry;
      if (index !== 0) api.unrank();
      for (const [i, control] of tableButtons.entries()) control.setAttribute('aria-pressed', String(i === index));
      view.say(index === 0 ? '星光轨道已就绪' : `${table.name}练习已就绪`);
    });
    button.setAttribute('aria-pressed', String(index === 0));
    return button;
  });
  view.on(canvas, 'pointerdown', event => { if (event.button === 0) serve(); });
  let leftAngle = .35, rightAngle = .35;
  const flippers = () => [
    [100, 393, 100 + Math.cos(leftAngle) * 65, 393 + Math.sin(leftAngle) * 65, left()],
    [260, 393, 260 - Math.cos(rightAngle) * 65, 393 + Math.sin(rightAngle) * 65, right()],
  ];
  function impact(x, y, separation, kick = 0) {
    const dx = ball.x - x, dy = ball.y - y;
    const distance = Math.hypot(dx, dy);
    if (distance >= separation) return false;
    const nx = distance ? dx / distance : 0, ny = distance ? dy / distance : -1;
    ball.x = x + nx * (separation + .04);
    ball.y = y + ny * (separation + .04);
    const toward = ball.vx * nx + ball.vy * ny;
    if (toward >= 0) return false;
    ball.vx -= 1.78 * toward * nx;
    ball.vy -= 1.78 * toward * ny;
    ball.vx += nx * kick;
    ball.vy += ny * kick;
    return true;
  }
  function update(delta) {
    activeTime += delta;
    if (!ball) return;
    const steps = Math.ceil(delta * 240), dt = delta / steps;
    const expired = activeTime - servedAt >= 40;
    for (let i = 0; i < steps; i++) {
      leftAngle += ((left() ? -.52 : .35) - leftAngle) * Math.min(1, dt * 35);
      rightAngle += ((right() ? -.52 : .35) - rightAngle) * Math.min(1, dt * 35);
      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed > 780) { ball.vx *= 780 / speed; ball.vy *= 780 / speed; }
      ball.vy += 395 * dt;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      for (const [ax, ay, bx, by] of [...pinballFrame, ...table.bars]) {
        const point = nearestPoint(ball.x, ball.y, ax, ay, bx, by);
        impact(point.x, point.y, 10);
      }
      for (const [ax, ay, bx, by, held] of flippers()) {
        const point = nearestPoint(ball.x, ball.y, ax, ay, bx, by);
        if (impact(point.x, point.y, 13) && held && ball.y <= point.y) {
          ball.vy = Math.min(ball.vy - 180, -390);
          ball.vx += ax < WIDTH / 2 ? 105 : -105;
        }
      }
      for (const [index, [x, y, radius, value]] of table.bumps.entries()) {
        const available = (flash.get(index) ?? 0) <= activeTime;
        if (impact(x, y, radius + 7, available ? 115 : 0) && available) {
          score += value;
          flash.set(index, activeTime + .18);
        }
      }
      if (Math.hypot(ball.vx, ball.vy) < 32) {
        stuckFor += dt;
        // A nearly stationary ball can rest on a flat rail instead of draining.
        if (stuckFor > 1.2) { ball.vx = ball.x < WIDTH / 2 ? -96 : 96; stuckFor = 0; }
      } else stuckFor = 0;
      if (expired || ball.y > 455 || ball.x < -14 || ball.x > 374) {
        ball = null;
        stuckFor = 0;
        balls--;
        if (!balls) view.end('三颗钢球已用完。', score);
        else view.say(`${expired ? '本球时间到' : '漏球'}，还剩 ${balls} 颗，发球继续`);
        return;
      }
    }
  }
  function draw() {
    view.clear(table.backdrop);
    polygon(ctx, [[18, 331], [18, 64], [57, 26], [303, 26], [342, 64], [342, 331], [260, 410], [100, 410]], table.field);
    for (let i = 0; i < 40; i++) {
      const x = 29 + (53 * i) % 302, y = 53 + (37 * i) % 275;
      if (table === pinballTables[0]) star(ctx, x, y, 3 + i % 3, 1.5, '#6276af70');
      else if (table === pinballTables[1]) line(ctx, x, y, x + 9, y, '#49878a77', 1.5);
      else circle(ctx, x, y, 3 + i % 3, '', '#b8886877');
    }
    for (const [ax, ay, bx, by] of pinballFrame) line(ctx, ax, ay, bx, by, table.edge, 5);
    for (const [ax, ay, bx, by] of table.bars) line(ctx, ax, ay, bx, by, table.color, 6);
    for (const [index, [x, y, radius, value]] of table.bumps.entries()) {
      circle(ctx, x, y, radius + 4, '#ffffff20');
      circle(ctx, x, y, radius, (flash.get(index) ?? 0) > activeTime ? '#fff9ea' : table.color, '#fff9ea', 2);
      circle(ctx, x, y, radius - 5, '', table.backdrop, 1);
      text(ctx, value, x, y, 11, table.backdrop);
    }
    for (const [ax, ay, bx, by, held] of flippers()) line(ctx, ax, ay, bx, by, held ? '#fff9ea' : '#ef987e', 12);
    if (balls) {
      const { x, y } = ball ?? { x: 326, y: 327 };
      circle(ctx, x, y, 7, '#dfe8f5', '#72849f');
      circle(ctx, x - 2, y - 2, 2.2, '#fff');
    }
    text(ctx, table.name, WIDTH / 2, 18, 12, table.color);
    view.readout(`得分 ${score}　·　钢球 ${balls}/3${ball ? `　·　${Math.max(0, 40 - Math.floor(activeTime - servedAt))} 秒` : ''}`);
  }
  view.say('选择台面，发球开始');
  view.run(update, draw);
}

const fruits = [
  { color: '#f37763', flesh: '#ffc0a5', leaf: '#62915b', symbol: '桃' },
  { color: '#ffb53f', flesh: '#ffd981', leaf: '#718452', symbol: '橙' },
  { color: '#91b45b', flesh: '#d3e992', leaf: '#557a46', symbol: '梨' },
  { color: '#b77acf', flesh: '#e7b8e8', leaf: '#68935f', symbol: '李' },
];

export function fruitSlice(host, api) {
  const view = screen(host, api, '切水果', 390, '#31283c');
  const { ctx, canvas } = view;
  const objects = [], effects = [], trail = [];
  let score = 0, missed = 0, time = 0, spawnAt = .5, wave = 0, drag;
  const finish = reason => view.end(`${reason}。`, score);
  function cut(from, to, lane) {
    const hits = objects.filter(item => {
      if (item.cut || item.y < 22 || item.y > 375) return false;
      if (lane !== undefined) return Math.floor(item.x / 90) === lane;
      const point = nearestPoint(item.x, item.y, from.x, from.y, to.x, to.y);
      return Math.hypot(item.x - point.x, item.y - point.y) <= item.radius;
    });
    if (lane !== undefined) {
      hits.sort((a, b) => Math.abs(a.y - 195) - Math.abs(b.y - 195));
      hits.splice(1);
    }
    if (hits.some(item => item.bomb)) { finish('切到炸弹'); return; }
    for (const item of hits) {
      item.cut = true;
      effects.push({ x: item.x, y: item.y, fruit: item.fruit, start: time });
    }
    if (hits.length) {
      score += hits.length * 10 + (hits.length - 1) * 5;
      view.say(hits.length > 1 ? `${hits.length} 连切` : '切中了');
    }
  }
  view.on(canvas, 'pointerdown', event => {
    if (event.button !== 0 || drag) return;
    const point = view.point(event);
    canvas.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, point };
    trail.splice(0);
    trail.push({ ...point, time });
    cut(point, point);
  });
  view.on(canvas, 'pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    const point = view.point(event);
    cut(drag.point, point);
    drag.point = point;
    trail.push({ ...point, time });
    if (trail.length > 24) trail.shift();
  });
  view.on(canvas, 'pointerup', event => {
    if (drag?.id === event.pointerId) cut(drag.point, view.point(event));
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(event, input => { if (drag?.id === input.pointerId) drag = undefined; }, { signal: api.signal });
  }
  for (let lane = 0; lane < 4; lane++) {
    const action = () => cut(null, null, lane);
    const button = view.button(`${lane + 1} 列`, action);
    button.style.borderBottom = `4px solid ${fruits[lane].color}`;
    view.keys([String(lane + 1)], action);
  }
  function update(delta) {
    time = api.elapsed();
    if (time >= 45) { finish('时间到'); return; }
    if (time >= spawnAt) {
      const count = wave % 3 === 1 ? 3 : 2;
      const lane = Math.floor(api.random() * 4);
      const bomb = wave > 2 && wave % 3 === 2;
      for (let i = 0; i < count; i++) {
        const column = (lane + i) % 4;
        const x = column * 90 + 28 + api.random() * 34;
        const fruit = fruits[Math.floor(api.random() * fruits.length)];
        objects.push({ x, y: 414, vx: (180 - x) * .22 + (api.random() - .5) * 20,
          vy: -353 - api.random() * 62, radius: 21, fruit, bomb: bomb && i === count - 1 });
      }
      wave++;
      spawnAt = time + Math.max(.85, 1.65 - time * .014);
    }
    for (let i = objects.length - 1; i >= 0; i--) {
      const item = objects[i];
      item.vy += 302 * delta;
      item.x += item.vx * delta;
      item.y += item.vy * delta;
      if (!item.cut && !(item.vy > 0 && item.y > 417)) continue;
      objects.splice(i, 1);
      if (!item.cut && !item.bomb) {
        missed++;
        view.say(`漏切 ${missed} 个`);
        if (missed >= 6) { finish('漏切次数用尽'); return; }
      }
    }
    while (effects.length && time - effects[0].start > .35) effects.shift();
    while (trail.length && time - trail[0].time > .15) trail.shift();
  }
  function drawFruit(item) {
    const { x, y, radius, fruit, bomb } = item;
    if (bomb) {
      circle(ctx, x, y, radius, '#221e25', '#ff9779', 2);
      line(ctx, x + 8, y - 17, x + 16, y - 27, '#ffc266', 4);
      star(ctx, x + 18, y - 29, 6, 2, '#ffd99d');
      text(ctx, '!', x, y, 20, '#ffae93');
      return;
    }
    circle(ctx, x, y, radius, fruit.color, fruit.flesh, 2);
    circle(ctx, x - 7, y - 8, 4, fruit.flesh);
    ctx.beginPath();
    ctx.ellipse(x + 6, y - 21, 10, 4, -.5, 0, TAU);
    ctx.fillStyle = fruit.leaf;
    ctx.fill();
    text(ctx, fruit.symbol, x, y + 2, 13, '#402332');
  }
  function draw() {
    view.clear();
    for (let i = 0; i < 4; i++) {
      pill(ctx, i * 90 + 3, 4, 84, 382, 10, i % 2 ? '#443146' : '#3b2c43');
      text(ctx, i + 1, i * 90 + 45, 33, 20, '#a98caa');
    }
    for (const item of objects) if (!item.cut) drawFruit(item);
    for (const dot of effects) {
      const age = time - dot.start;
      ctx.globalAlpha = Math.max(0, 1 - age / .35);
      for (let i = 0; i < 7; i++) {
        const direction = TAU * i / 7;
        circle(ctx, dot.x + Math.cos(direction) * age * 104, dot.y + Math.sin(direction) * age * 104, 4 - i % 3, dot.fruit.flesh);
      }
      ctx.globalAlpha = 1;
    }
    for (let i = 1; i < trail.length; i++) line(ctx, trail[i - 1].x, trail[i - 1].y, trail[i].x, trail[i].y, '#fff2caaa', 2 + i / trail.length * 4);
    view.readout(`得分 ${score}　·　漏切 ${missed}/6　·　${Math.max(0, 45 - Math.floor(time))} 秒`);
  }
  view.say('准备切开第一批果子');
  view.run(update, draw);
}

function wrap(value, size) { return (value % size + size) % size; }

function spaceDistance(a, b, height) {
  const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
  return Math.hypot(Math.min(dx, WIDTH - dx), Math.min(dy, height - dy));
}

export function asteroidDrift(host, api) {
  const height = 386;
  const view = screen(host, api, '小行星漂移', height, '#141e36');
  const { ctx } = view;
  const left = view.hold('左转', ['arrowleft', 'a']);
  const right = view.hold('右转', ['arrowright', 'd']);
  const thrust = view.hold('推进', ['arrowup', 'w', ' ']);
  const ship = { x: 180, y: 193, vx: 0, vy: 0, angle: -Math.PI / 2 };
  const debris = [];
  const beacon = {};
  let time = 0, shields = 3, invulnerable = 0, rescues = 0, nextRock = 9;
  function placeBeacon() {
    const candidates = Array.from({ length: 10 }, () => ({ x: 20 + api.random() * 320, y: 28 + api.random() * 330 }));
    const distance = point => Math.min(spaceDistance(point, ship, height), ...debris.map(rock => spaceDistance(point, rock, height) - rock.radius));
    candidates.sort((a, b) => distance(b) - distance(a));
    Object.assign(beacon, candidates[0]);
  }
  function addRock() {
    const angle = api.random() * TAU;
    const speed = 34 + api.random() * 35 + time * .6;
    const radius = 12 + api.random() * 13;
    const x = wrap(ship.x + 125 * Math.cos(angle), WIDTH);
    const y = wrap(ship.y + 125 * Math.sin(angle), height);
    debris.push({ x, y, vx: Math.cos(angle + 1.33) * speed, vy: Math.sin(angle + 1.33) * speed, radius,
      spin: api.random() - .5, edges: Array.from({ length: 8 }, () => .72 + api.random() * .28) });
  }
  for (let i = 0; i < 5; i++) addRock();
  placeBeacon();
  const score = () => Math.min(60, Math.floor(time)) * 2 + rescues * 50;
  function update(delta) {
    time = api.elapsed();
    if (time >= 60) { view.end(`完成巡航，回收了 ${rescues} 枚信标。`, score()); return; }
    if (time >= nextRock) { addRock(); nextRock += 9; }
    ship.angle += (Number(right()) - Number(left())) * delta * 3.7;
    if (thrust()) {
      ship.vx += Math.cos(ship.angle) * 155 * delta;
      ship.vy += Math.sin(ship.angle) * 155 * delta;
    }
    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed > 205) { ship.vx *= 205 / speed; ship.vy *= 205 / speed; }
    ship.vx *= Math.exp(-delta * .32);
    ship.vy *= Math.exp(-delta * .32);
    ship.x = wrap(ship.x + ship.vx * delta, WIDTH);
    ship.y = wrap(ship.y + ship.vy * delta, height);
    for (const rock of debris) {
      rock.x = wrap(rock.x + rock.vx * delta, WIDTH);
      rock.y = wrap(rock.y + rock.vy * delta, height);
      if (time < invulnerable || spaceDistance(rock, ship, height) >= rock.radius * .85 + 9) continue;
      shields--;
      invulnerable = time + 1.7;
      ship.vx = -ship.vx * .3;
      ship.vy = -ship.vy * .3;
      if (!shields) { view.end(`护盾耗尽，坚持了 ${Math.floor(time)} 秒。`, score()); return; }
      view.say(`撞上小行星，剩余 ${shields} 格护盾`);
    }
    if (spaceDistance(ship, beacon, height) < 18) {
      rescues++;
      placeBeacon();
      view.say(`已回收 ${rescues} 枚信标`);
    }
  }
  function drawWrapped(item, radius, draw) {
    const xs = [item.x];
    const ys = [item.y];
    if (item.x < radius) xs.push(item.x + WIDTH);
    if (item.x > WIDTH - radius) xs.push(item.x - WIDTH);
    if (item.y < radius) ys.push(item.y + height);
    if (item.y > height - radius) ys.push(item.y - height);
    for (const x of xs) for (const y of ys) draw(x, y);
  }
  function draw() {
    view.clear();
    for (let i = 0; i < 64; i++) circle(ctx, (i * 53 + 13) % WIDTH, (i * 79 + 17) % height, .6 + i % 3 * .45, i % 4 ? '#63779b' : '#6ba0ad');
    drawWrapped(beacon, 19, (x, y) => {
      circle(ctx, x, y, 14 + Math.sin(time * 6) * 2, '#59bcaa20', '#62c7b5');
      star(ctx, x, y, 10, 5, '#89eacd');
    });
    for (const rock of debris) drawWrapped(rock, rock.radius, (x, y) => {
      const points = rock.edges.map((edge, i) => {
        const angle = TAU * i / rock.edges.length + time * rock.spin;
        return [x + Math.cos(angle) * rock.radius * edge, y + Math.sin(angle) * rock.radius * edge];
      });
      polygon(ctx, points, '#73728d', '#adabc2');
      circle(ctx, x - 3, y + 3, rock.radius / 3, '#4f506f');
    });
    drawWrapped(ship, 22, (x, y) => {
      if (time < invulnerable && Math.floor(time * 11) % 2) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ship.angle);
      if (thrust()) polygon(ctx, [[-8, -4], [-21 - 3 * Math.sin(time * 29), 0], [-8, 4]], '#f9a96d');
      polygon(ctx, [[15, 0], [-10, -9], [-5, 0], [-10, 9]], '#e2f3f4', '#91c8d2');
      circle(ctx, 4, 0, 3, '#3a7c90');
      ctx.restore();
    });
    view.readout(`得分 ${score()}　·　护盾 ${shields}/3　·　${Math.max(0, 60 - Math.floor(time))} 秒`);
  }
  view.say('转向后推进，回收发光信标');
  view.run(update, draw);
}
