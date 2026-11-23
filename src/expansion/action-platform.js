import { actionButton, backdrop, caption, clamp, createScene, disk, duration, gem, horizontal, line, path, pill, rect } from './action-scene.js';

export const ruinLayouts = [
  [[0, 158], [210, 340], [394, 540], [596, 745], [802, 930]],
  [[0, 144], [205, 333], [387, 552], [613, 741], [803, 930]],
  [[0, 184], [250, 376], [431, 552], [619, 742], [804, 930]],
  [[0, 125], [184, 305], [373, 508], [572, 706], [776, 930]],
  [[0, 156], [225, 362], [421, 547], [617, 754], [825, 954]],
  [[0, 138], [208, 342], [408, 542], [613, 746], [817, 954]],
];

function explorer(ctx, x, y, facing, tint = '#f4c758') {
  const belt = '#545046';
  pill(ctx, x - 7, y - 5, 14, 15, 4, tint);
  pill(ctx, x - 9, y - 5, 5, 12, 2, belt);
  disk(ctx, x + facing * 2, y - 9, 6, '#fbe4bf');
  rect(ctx, x - 8, y - 12, 16, 2, belt);
  rect(ctx, x - 5, y - 16, 10, 4, tint);
  disk(ctx, x + facing * 5, y - 9, 1, '#362829');
  rect(ctx, x - 7, y + 8, 5, 3, belt);
  rect(ctx, x + 2, y + 8, 5, 3, belt);
}

export function ruin(host, api) {
  const scene = createScene(host, api, { label: '遗迹平台和琥珀晶石', controls: [...horizontal, actionButton('跳跃', [' ', 'arrowup', 'w'])] });
  const { ctx, width: w, height: h } = scene;
  const palettes = [
    ['#293144', '#555866', '#4c4561', '#736780', '#a88d9f'],
    ['#193a3e', '#577275', '#3b554a', '#657851', '#8fa86d'],
    ['#422839', '#79525c', '#634357', '#91666e', '#bc8b76'],
    ['#233248', '#3e5f74', '#31465e', '#617892', '#90a8b4'],
    ['#45363c', '#7d6154', '#654a53', '#92726a', '#bf9477'],
    ['#232b27', '#4c5b4e', '#3b4a38', '#627657', '#92a575'],
  ];
  const groundY = 252;
  let level = 0, finds, platforms, crystals, exit, x, y, vy, facing, grace, jumpBuffer;
  let falls = 0;

  function reset() {
    const islands = ruinLayouts[level];
    const ledges = islands.slice(1, 4).map(([a, b], index) => {
      const center = (a + b) / 2 + (level % 2 ? -10 : 12) * (index % 2 ? -1 : 1);
      return [center - 31, center + 31, 208 - ((index + level) % 3) * 7];
    });
    platforms = [...islands.map(([a, b]) => [a, b, groundY]), ...ledges];
    crystals = ledges.map(([a, b, top]) => ({ x: (a + b) / 2, y: top - 14, found: false }));
    exit = islands.at(-1)[1] - 46;
    finds = 0;
    x = 42;
    y = groundY - 11;
    vy = 0;
    facing = 1;
    grace = .09;
    jumpBuffer = 0;
  }
  function step(dt) {
    const movement = scene.axis('left', 'right');
    if (movement) facing = movement;
    x = clamp(x + movement * 150 * dt, 9, exit + 32);
    if (scene.press('action')) jumpBuffer = .13;
    if (jumpBuffer > 0 && grace > 0) {
      vy = -336;
      grace = 0;
      jumpBuffer = 0;
    }
    grace -= dt;
    jumpBuffer -= dt;
    const oldFoot = y + 11;
    vy += 735 * dt;
    y += vy * dt;
    for (const [start, end, top] of platforms) {
      if (vy >= 0 && oldFoot <= top + .01 && y + 11 >= top && x + 6 > start && x - 6 < end) {
        y = top - 11;
        vy = 0;
        grace = .09;
      }
    }
    for (const crystal of crystals) {
      if (!crystal.found && Math.hypot(x - crystal.x, y - crystal.y) < 17) {
        crystal.found = true;
        finds++;
      }
    }
    if (y > h + 22) { falls++; reset(); }
    if (finds === crystals.length && Math.abs(x - exit) < 16 && y > groundY - 48) {
      if (level + 1 === ruinLayouts.length) {
        scene.end('六段遗迹全部探索完成，晶石已带回。', duration(api));
        return;
      }
      level++;
      reset();
      return;
    }
    scene.status(`遗迹 ${level + 1} / ${ruinLayouts.length}　晶石 ${finds} / 3${falls ? `　坠落 ${falls}` : ''}${x > exit - 46 && finds < 3 ? '　石门需要全部晶石' : ''}`);
  }
  function draw() {
    const [sky, haze, stone, cap, mortar] = palettes[level];
    const camera = clamp(x - w * .39, 0, exit + 50 - w);
    backdrop(ctx, w, h, sky, haze);
    disk(ctx, 257 - camera * .07, 94, 37, '#f8c87842');
    for (let ruin = 0; ruin < 13; ruin++) {
      const px = ruin * 91 - camera * .37;
      const top = 88 + (ruin * 41) % 87;
      rect(ctx, px, top, 13, 156, '#23273573');
      rect(ctx, px + 38, top, 13, 156, '#23273573');
      path(ctx, [[px - 8, top], [px + 25, top - 22], [px + 61, top], [px + 61, top + 6], [px - 8, top + 6]], '#2427359c');
    }
    rect(ctx, 0, 280, w, 20, '#21242dbd');
    for (const [a, b, top] of platforms) {
      const px = a - camera;
      rect(ctx, px, top, b - a, top === groundY ? 60 : 12, stone);
      rect(ctx, px, top, b - a, 4, cap);
      for (let i = a + 12; i < b - 5; i += 29) line(ctx, i - camera, top + 5, i - camera + 3, top + 25, mortar + '63');
    }
    const arch = exit - camera;
    pill(ctx, arch - 18, groundY - 57, 36, 63, 15, mortar);
    pill(ctx, arch - 12, groundY - 48, 24, 51, 11, finds === 3 ? '#ffe1a0' : '#372f42');
    if (finds !== 3) for (const shift of [-6, 0, 6]) line(ctx, arch + shift, groundY - 44, arch + shift, groundY, mortar);
    for (const crystal of crystals) if (!crystal.found) {
      disk(ctx, crystal.x - camera, crystal.y, 12, '#f7b46d33');
      gem(ctx, crystal.x - camera, crystal.y, '#fa9665', '#ffe0a0', 9);
    }
    explorer(ctx, x - camera, y, facing);
    caption(ctx, `遗迹 ${level + 1} / ${ruinLayouts.length}`, 16, 19);
    caption(ctx, `晶石 ${finds} / 3`, w - 16, 19, '#ffdd8d', 12, 'right');
  }
  reset();
  scene.status('越过断桥，取走三枚晶石，再穿过石门。');
  scene.start(step, draw);
}

export const towerRings = [[160, 255], [210, 205], [165, 154], [111, 108], [143, 46], [199, 2], [217, -64], [160, -108], [104, -152], [156, -198]];

export function pendulum(host, api) {
  const scene = createScene(host, api, { label: '尖塔铜环与摆索', controls: [actionButton('抓住铜环')] });
  const { ctx, width: w, height: h } = scene;
  const radius = 68;
  let index = 0, angle = -1.2, misses = 0, flash = 0;
  const bob = () => [towerRings[index][0] + Math.sin(angle) * radius, towerRings[index][1] + Math.cos(angle) * radius];
  function canGrab() {
    const next = towerRings[index + 1];
    if (!next) return false;
    const [x, y] = bob();
    return Math.hypot(next[0] - x, next[1] - y) < 22;
  }
  function step(dt) {
    angle += dt * (2.58 + .46 * Math.cos(angle));
    flash = Math.max(0, flash - dt);
    if (scene.press('action')) {
      if (canGrab()) {
        const old = towerRings[index++];
        if (index + 1 === towerRings.length) {
          scene.end(`登顶成功，${misses} 次抓空。`, duration(api));
          return;
        }
        const next = towerRings[index];
        angle = Math.atan2(old[0] - next[0], old[1] - next[1]);
      } else {
        misses++;
        flash = .5;
      }
    }
    scene.status(`铜环 ${index + 1} / ${towerRings.length}　${canGrab() ? '距离合适，可以抓环' : flash ? '抓空了，等下一圈' : '接近下一环时抓住它'}`);
  }
  function draw() {
    const [px, py] = towerRings[index];
    const [x, y] = bob();
    const camera = py - 194;
    const ready = canGrab();
    backdrop(ctx, w, h, '#181e35', '#4c3b60');
    disk(ctx, 291, 63, 35, '#ddc596');
    disk(ctx, 305, 55, 33, '#24243c');
    for (let i = 0; i < 24; i++) disk(ctx, 12 + i * 73 % 340, 16 + (i * 31) % 231, i % 5 ? .8 : 1.3, '#ead9bb99');
    path(ctx, [[65, h], [82, 66], [128, 66], [179, -15], [230, 66], [272, 66], [299, h]], '#2a293f');
    rect(ctx, 82, 193, 209, 7, '#9875752d');
    for (let i = 0; i < 9; i++) {
      const sy = ((i * 42 - camera) % 360 + 360) % 360 - 28;
      line(ctx, 81, sy, 278, sy, '#9b7c903b');
      line(ctx, 99 + i % 2 * 27, sy, 99 + i % 2 * 27, sy + 41, '#9b7c903b');
    }
    ctx.beginPath();
    ctx.arc(px, py - camera, radius, 0, Math.PI * 2);
    ctx.setLineDash([3, 6]);
    ctx.strokeStyle = '#beaa9669'; ctx.lineWidth = 1; ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < towerRings.length; i++) {
      const [rx, ry] = towerRings[i];
      const sy = ry - camera;
      if (i === index + 1) disk(ctx, rx, sy, 22, ready ? '#cfef9e4d' : '#f7cc6e31');
      disk(ctx, rx, sy, 10, i > index + 1 ? '#817284' : ready && i === index + 1 ? '#d5fa9f' : '#ffc276');
      disk(ctx, rx, sy, 5, '#382e48');
    }
    line(ctx, px, py - camera, x, y - camera, ready ? '#dbf6b2' : '#e5c483', 2);
    explorer(ctx, x, y - camera, Math.cos(angle) < 0 ? -1 : 1, flash ? '#ed9f9c' : '#efbb7b');
    caption(ctx, `铜环 ${index + 1} / ${towerRings.length}`, 17, 20);
    caption(ctx, ready ? '现在抓环' : '尖塔', w - 17, 20, ready ? '#d5fa9f' : '#ffd99b', 12, 'right');
  }
  scene.status('接近下一道铜环时，按空格或抓住铜环。');
  scene.start(step, draw);
}

export const gravityBarriers = [[270, 1], [430, 0], [600, 1], [758, 1], [907, 0], [1049, 1], [1217, 0], [1368, 0], [1542, 1], [1709, 0], [1850, 1]];

export function gravity(host, api) {
  const scene = createScene(host, api, { label: '双轨重力管道', controls: [actionButton('翻转重力', [' ', 'arrowup', 'arrowdown'])] });
  const { ctx, width: w, height: h } = scene;
  const top = 61, bottom = 252, thickness = 34;
  const finish = 2010;
  const pearls = gravityBarriers.map(([x, lower]) => ({ x: x + 21, y: lower ? top + 12 : bottom - 12, taken: false }));
  let x = 45, y = bottom - 11, vy = 0, gravitySign = 1, gates = 0, crystals = 0, time = 0;
  const points = () => gates * 100 + crystals * 25;
  function step(dt) {
    time += dt;
    if (scene.press('action')) { gravitySign *= -1; vy = 0; }
    x += 112 * dt;
    vy += gravitySign * 950 * dt;
    y = clamp(y + vy * dt, top + 11, bottom - 11);
    if (y <= top + 11 || y >= bottom - 11) vy = 0;
    for (const [bx, lower] of gravityBarriers) {
      if (x + 9 < bx || x - 9 > bx + thickness) continue;
      if (lower ? y + 9 > bottom - 71 : y - 9 < top + 71) {
        scene.end(`撞上闸板，获得 ${points()} 分。`, points());
        return;
      }
    }
    for (const pearl of pearls) if (!pearl.taken && Math.hypot(x - pearl.x, y - pearl.y) < 16) {
      pearl.taken = true;
      crystals++;
    }
    gates = gravityBarriers.filter(([bx]) => x - 9 > bx + thickness).length;
    if (x >= finish) {
      scene.end(`穿过管道出口，获得 ${points() + 300} 分。`, points() + 300);
      return;
    }
    scene.status(`闸板 ${gates} / ${gravityBarriers.length}　${points()} 分　重力${gravitySign > 0 ? '向下' : '向上'}`);
  }
  function draw() {
    const camera = Math.max(0, x - 108);
    backdrop(ctx, w, h, '#102735', '#1c424e');
    for (let i = 0; i < 9; i++) {
      const sx = i * 53 - camera % 53;
      line(ctx, sx, top, sx, bottom, '#8ebdc430');
      rect(ctx, sx - 1, top - 8, 3, 5, '#91d3d4');
      rect(ctx, sx - 1, bottom + 3, 3, 5, '#91d3d4');
    }
    line(ctx, 0, top, w, top, '#96ced3', 3);
    line(ctx, 0, bottom, w, bottom, '#96ced3', 3);
    for (const [bx, lower] of gravityBarriers) {
      const sx = bx - camera;
      if (sx < -40 || sx > w) continue;
      const sy = lower ? bottom - 71 : top;
      rect(ctx, sx, sy, thickness, 71, '#a33951');
      rect(ctx, sx, sy, 3, 71, '#f2a096');
      for (let i = 0; i < 4; i++) path(ctx, [[sx + 5, sy + 13 + i * 15], [sx + 28, sy + 5 + i * 15], [sx + 28, sy + 9 + i * 15], [sx + 5, sy + 17 + i * 15]], '#ef918c');
    }
    for (const pearl of pearls) if (!pearl.taken) {
      disk(ctx, pearl.x - camera, pearl.y, 9, '#86f0dc44');
      gem(ctx, pearl.x - camera, pearl.y, '#54d9cd', '#befff1', 6);
    }
    rect(ctx, finish - camera, top, 12, bottom - top, '#99efa978');
    const sx = x - camera;
    disk(ctx, sx, y, 11, '#ffe29d');
    disk(ctx, sx, y, 7, '#2e4c5c');
    line(ctx, sx - Math.cos(time * 12) * 6, y - Math.sin(time * 12) * 6, sx + Math.cos(time * 12) * 6, y + Math.sin(time * 12) * 6, '#ffe29d', 3);
    caption(ctx, `${points()} 分`, 16, 20);
    caption(ctx, `重力 ${gravitySign > 0 ? '↓' : '↑'}`, w - 17, 20, '#acf5e3', 12, 'right');
  }
  scene.status('观察前方闸板，翻转到空旷的一侧。');
  scene.start(step, draw);
}

export const lavaPlatforms = Array.from({ length: 29 }, (_, index) => ({
  x: [175, 216, 264, 214, 130, 78, 131, 213][index % 8],
  y: 264 - index * 57,
  width: index === 0 || index === 28 ? 94 : 61 - Math.floor(index / 7) * 4,
  fire: index > 0 && index % 4 === 2,
}));

export function lava(host, api) {
  const scene = createScene(host, api, { label: '火山井与弹跳浮石', controls: horizontal });
  const { ctx, width: w, height: h } = scene;
  const first = lavaPlatforms[0];
  let x = first.x, y = first.y - 11, lavaY = 342, vy = -367, vx = 0, best = 0, facing = 1, tick = 0;
  const flames = new Set();
  const score = () => Math.floor(best / 10) + flames.size * 40;
  function step(dt) {
    tick += dt;
    const steer = scene.axis('left', 'right');
    if (steer) facing = steer;
    vx += (steer * 181 - vx) * Math.min(1, dt * 13);
    x = clamp(x + vx * dt, 10, w - 10);
    const oldY = y;
    vy += 815 * dt;
    y += vy * dt;
    lavaY -= (53 + Math.min(tick, 30) * .48) * dt;
    best = Math.max(best, first.y - 11 - y);
    for (const [index, platform] of lavaPlatforms.entries()) {
      if (platform.fire && Math.hypot(x - platform.x, y - (platform.y - 27)) < 19) flames.add(index);
      if (vy < 0 || y + 11 < platform.y || oldY + 11 > platform.y || Math.abs(x - platform.x) > platform.width / 2 + 4) continue;
      y = platform.y - 11;
      if (index === lavaPlatforms.length - 1) {
        scene.end(`冲出火山，获得 ${score() + 500} 分。`, score() + 500);
        return;
      }
      vy = -367;
    }
    if (y + 9 >= lavaY) {
      scene.end(`熔岩追上来了，获得 ${score()} 分。`, score());
      return;
    }
    scene.status(`高度 ${Math.floor(best)} 米　火种 ${flames.size}　${score()} 分`, .35);
  }
  function draw() {
    const camera = Math.min(0, y - 163);
    backdrop(ctx, w, h, '#2c2340', '#742f46');
    for (let i = 0; i < 16; i++) {
      const sy = ((i * 39 - camera * .7) % 330 + 330) % 330 - 25;
      const dx = i % 2 ? 18 : w - 18;
      path(ctx, [[dx - 40, sy - 5], [dx + 14, sy], [dx + 25, sy + 30], [dx - 30, sy + 23]], i % 2 ? '#50304b' : '#5d354d');
    }
    for (const [index, platform] of lavaPlatforms.entries()) {
      const sy = platform.y - camera;
      if (sy < -38 || sy > h + 20) continue;
      const half = platform.width / 2;
      path(ctx, [[platform.x - half, sy], [platform.x + half, sy], [platform.x + half - 9, sy + 13], [platform.x - half + 11, sy + 16]], '#8b596f');
      line(ctx, platform.x - half, sy, platform.x + half, sy, index === lavaPlatforms.length - 1 ? '#e8fdac' : '#e9a497', 3);
      if (platform.fire && !flames.has(index)) {
        disk(ctx, platform.x, sy - 27, 11, '#ff966947');
        gem(ctx, platform.x, sy - 27, '#fa8567', '#ffe49a', 8);
      }
    }
    const lavaScreen = lavaY - camera;
    if (lavaScreen < h) {
      const ripples = Array.from({ length: 25 }, (_, i) => [i * 15, lavaScreen + Math.sin(i * .83 + tick * 8) * 4]);
      path(ctx, [...ripples, [w, h + 12], [0, h + 12]], '#f27852');
      path(ctx, [...ripples.map(([px, py]) => [px, py + 10]), [w, h + 12], [0, h + 12]], '#d9574c');
      for (let i = 0; i < 10; i++) disk(ctx, i * 39 + 10, lavaScreen + 15 + ((i * 19 + tick * 9) % 37), 2 + i % 4, '#ffac68');
    }
    explorer(ctx, x, y - camera, facing, '#ffc0a0');
    caption(ctx, `${Math.floor(best)} 米`, 17, 20);
    caption(ctx, `火种 ${flames.size}　${score()} 分`, w - 17, 20, '#ffd591', 12, 'right');
  }
  scene.status('落在浮石上自动弹跳。空中移动，避开上涨的熔岩。');
  scene.start(step, draw);
}
