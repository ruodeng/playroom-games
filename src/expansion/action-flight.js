import { actionButton, backdrop, caption, clamp, createScene, disk, gem, horizontal, line, path, pill, rect } from './action-scene.js';

const landingPad = { left: 247, right: 309, y: 249 };
function moonGround(x) {
  if (x >= landingPad.left && x <= landingPad.right) return landingPad.y;
  return 249 + Math.sin(x * .053) * 6 + Math.sin(x * .111) * 4;
}

export function lunar(host, api) {
  const scene = createScene(host, api, { label: '月球地形、着陆台与着陆器', controls: [...horizontal, actionButton('↑ 点火', ['arrowup', 'w', ' '], true)] });
  const { ctx, width: w, height: h } = scene;
  let x = 92, y = 67, vx = 19, vy = 10, angle = 0, fuel = 100, engine = false, time = 0;
  function step(dt) {
    time += dt;
    angle = clamp(angle + scene.axis('left', 'right') * 1.7 * dt, -1.23, 1.23);
    engine = scene.down('action') && fuel > 0;
    const burn = engine ? Math.min(dt, fuel / 13) : 0;
    fuel = Math.max(0, fuel - burn * 13);
    vx += Math.sin(angle) * 95 * burn;
    vy += 39 * dt - Math.cos(angle) * 95 * burn;
    x += vx * dt;
    y += vy * dt;
    if (x < 8 || x > w - 8 || y < -12) {
      scene.end('着陆器飞离了着陆区域。');
      return;
    }
    if (y + 10 >= moonGround(x)) {
      const onPad = x - 9 >= landingPad.left && x + 9 <= landingPad.right;
      const slow = Math.abs(vx) <= 27 && vy <= 55 && Math.abs(angle) <= 13 * Math.PI / 180;
      const fuelLeft = Math.floor(fuel);
      if (onPad && slow) scene.end(`安全着陆，剩余 ${fuelLeft}% 燃料。`, fuelLeft);
      else scene.end(onPad ? '接地速度或倾角超限，着陆失败。' : '着陆器撞上了着陆台外的月面。');
      return;
    }
    scene.status(`燃料 ${Math.floor(fuel)}%　横速 ${Math.round(vx)}　下落 ${Math.round(vy)}　倾角 ${Math.round(angle * 180 / Math.PI)}°`, .35);
  }
  function draw() {
    backdrop(ctx, w, h, '#15263b', '#39475f');
    for (let i = 0; i < 34; i++) disk(ctx, 9 + i * 91 % 345, 9 + i * 37 % 210, i % 7 ? .8 : 1.4, i % 7 ? '#d3ddda83' : '#f6e5c9');
    disk(ctx, 291, 76, 29, '#9cb3be');
    ctx.save(); ctx.beginPath(); ctx.arc(291, 76, 29, 0, Math.PI * 2); ctx.clip();
    for (let i = 0; i < 6; i++) path(ctx, [[249, 49 + i * 10], [325, 53 + i * 10], [324, 59 + i * 10], [247, 53 + i * 10]], i % 2 ? '#b8c9c6' : '#869db5');
    ctx.restore();
    const surface = Array.from({ length: w + 1 }, (_, px) => [px, moonGround(px)]);
    path(ctx, [...surface, [w, h], [0, h]], '#676c7c');
    path(ctx, [[0, 270], [64, 277], [122, 265], [233, 278], [305, 266], [w, 270], [w, h], [0, h]], '#505665');
    rect(ctx, landingPad.left, landingPad.y - 1, landingPad.right - landingPad.left, 4, '#8fefd7');
    for (const lamp of [landingPad.left + 3, landingPad.right - 3]) {
      disk(ctx, lamp, landingPad.y - 5, 6, '#aef1dd3e');
      disk(ctx, lamp, landingPad.y - 5, 2.6, '#b2ffec');
    }
    if (x >= landingPad.left && x <= landingPad.right) {
      ctx.setLineDash([2, 5]);
      line(ctx, x, y + 17, x, landingPad.y, '#c7efe0b3');
      ctx.setLineDash([]);
    }
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    if (engine) path(ctx, [[-5, 7], [5, 7], [0, 21 + Math.sin(time * 53) * 3]], '#ffe0a0');
    path(ctx, [[-9, 6], [-8, -5], [-3, -10], [4, -10], [9, -5], [9, 6]], '#dce5d4');
    pill(ctx, -4, -7, 8, 6, 2, '#597d91');
    line(ctx, -7, 4, -12, 11, '#c9cbd1', 2);
    line(ctx, 7, 4, 12, 11, '#c9cbd1', 2);
    line(ctx, -15, 11, -9, 11, '#e9ddbd', 2);
    line(ctx, 9, 11, 15, 11, '#e9ddbd', 2);
    ctx.restore();
    caption(ctx, `燃料 ${Math.floor(fuel)}%`, 16, 18);
    caption(ctx, `↔ ${Math.round(vx)}　↓ ${Math.round(vy)}　${Math.round(angle * 180 / Math.PI)}°`, w - 16, 18, '#d6efe5', 12, 'right');
    rect(ctx, 16, 29, w - 32, 3, '#5d7387');
    rect(ctx, 16, 29, (w - 32) * fuel / 100, 3, fuel < 20 ? '#f3a899' : '#91dacf');
  }
  scene.status('向右飞向着陆台，点火减速后保持机身直立。');
  scene.start(step, draw);
}

const riverCenter = s => 180 + Math.sin(s / 186) * 54 + Math.sin(s / 91) * 24;
const riverWidth = s => 79 + Math.sin(s / 155 + 1.1) * 14;
const raceEnd = 1920;
const rapids = [
  [235, -.48, 13], [352, .39, 16], [466, -.66, 14], [543, .49, 16], [674, 0, 20], [779, -.6, 17],
  [897, .59, 14], [955, -.55, 15], [1070, .1, 17], [1256, .59, 15], [1367, -.41, 16],
  [1480, .27, 20], [1572, -.65, 15], [1664, .58, 14], [1790, -.18, 17],
];
const floats = [[176, .1], [305, -.34], [413, -.25], [597, .66], [717, .44], [831, .27], [1007, -.4], [1141, -.25], [1311, -.5], [1510, -.35], [1709, .43], [1846, .24]];

export function raft(host, api) {
  const scene = createScene(host, api, { label: '弯曲白水河道、岩石与木筏', controls: horizontal, height: 320 });
  const { ctx, width: w, height: h } = scene;
  const raftY = 213;
  const passed = new Set();
  const collected = new Set();
  let x = riverCenter(0), position = 0, vx = 0, damage = 0, cooldown = 0, trail = 0;
  const timeScore = () => Math.floor(position / 6) + collected.size * 45;
  function hit() {
    if (cooldown) return;
    damage++;
    cooldown = .7;
  }
  function step(dt) {
    trail += dt;
    cooldown = Math.max(0, cooldown - dt);
    const speed = 91 + Math.sin(position * .017) * 14;
    position = Math.min(raceEnd, position + speed * dt);
    const steering = scene.axis('left', 'right');
    const current = Math.sin(position / 83) * 29 + Math.cos(position / 181) * 18;
    vx += ((steering * 152 + current) - vx) * Math.min(1, dt * 4.7);
    x += vx * dt;
    const center = riverCenter(position);
    const edge = riverWidth(position) - 12;
    if (Math.abs(x - center) > edge) {
      x = clamp(x, center - edge, center + edge);
      vx *= -.37;
      hit();
    }
    for (const [index, [s, fraction, radius]] of rapids.entries()) {
      if (passed.has(index) || Math.hypot(x - (riverCenter(s) + riverWidth(s) * fraction), s - position) >= radius + 9) continue;
      passed.add(index);
      hit();
      vx += x <= riverCenter(s) + riverWidth(s) * fraction ? -34 : 34;
    }
    for (const [index, [s, fraction]] of floats.entries()) {
      if (Math.hypot(x - (riverCenter(s) + riverWidth(s) * fraction), s - position) < 19) collected.add(index);
    }
    if (damage >= 3) { scene.end(`木筏沉没，获得 ${timeScore()} 分。`, timeScore()); return; }
    if (position >= raceEnd) { scene.end(`驶过终点，获得 ${timeScore() + 250} 分。`, timeScore() + 250); return; }
    scene.status(`河程 ${Math.floor(position)} / ${raceEnd} 米　耐久 ${3 - damage}　${timeScore()} 分`, .35);
  }
  function draw() {
    backdrop(ctx, w, h, '#344351', '#456151');
    const left = [], right = [];
    for (let sy = 0; sy <= h; sy += 8) {
      const s = position + raftY - sy;
      const center = riverCenter(s), width = riverWidth(s);
      left.push([center - width, sy]);
      right.unshift([center + width, sy]);
    }
    path(ctx, [...left, ...right], '#438d9c');
    path(ctx, [...left.map(([px, py]) => [px - 4, py]), ...left.slice().reverse().map(([px, py]) => [px + 4, py])], '#bac792');
    path(ctx, [...right.map(([px, py]) => [px - 4, py]), ...right.slice().reverse().map(([px, py]) => [px + 4, py])], '#bac792');
    const start = Math.floor((position - 120) / 21);
    for (let i = start; i < start + 17; i++) {
      const s = i * 21 + trail * 10 % 21;
      const sy = raftY + position - s;
      const center = riverCenter(s), wide = riverWidth(s);
      line(ctx, center - wide + 9, sy, center - wide + 17, sy + 6, '#b7eff0b5', 2);
      line(ctx, center + wide - 13, sy + 2, center + wide - 20, sy + 8, '#b7eff0b5', 2);
      const middle = center + Math.sin(i * 2.1) * (wide - 26);
      line(ctx, middle, sy - 2, middle + 5, sy + 6, '#b7eff069');
      const bank = i % 2 ? center - wide - 18 : center + wide + 19;
      path(ctx, [[bank - 9, sy + 7], [bank, sy - 11], [bank + 8, sy + 7]], '#263e3c');
    }
    for (const [s, fraction, radius] of rapids) {
      const sy = raftY + position - s;
      if (sy < -30 || sy > h + 25) continue;
      const sx = riverCenter(s) + riverWidth(s) * fraction;
      disk(ctx, sx, sy + 4, radius + 5, '#b7e9e37a');
      path(ctx, [[sx - radius, sy + 9], [sx - radius + 2, sy - 4], [sx - 4, sy - radius], [sx + radius * .72, sy - radius * .63], [sx + radius, sy + 5], [sx + 3, sy + 12]], '#4d5363');
      path(ctx, [[sx - radius + 2, sy - 4], [sx - 4, sy - radius], [sx + radius * .72, sy - radius * .63], [sx + 4, sy]], '#777a83');
    }
    for (const [index, [s, fraction]] of floats.entries()) if (!collected.has(index)) {
      const sx = riverCenter(s) + riverWidth(s) * fraction, sy = raftY + position - s;
      disk(ctx, sx, sy, 9, '#ffdda0');
      disk(ctx, sx, sy, 4, '#438d9c');
      line(ctx, sx - 6, sy - 6, sx - 2, sy - 3, '#de9168', 2);
    }
    const finishY = raftY + position - raceEnd;
    if (finishY > 24) {
      line(ctx, riverCenter(raceEnd) - riverWidth(raceEnd), finishY, riverCenter(raceEnd) + riverWidth(raceEnd), finishY, '#e3f4b2', 4);
      caption(ctx, '终点', riverCenter(raceEnd), finishY - 12, '#e3f4b2', 12, 'center');
    }
    ctx.save(); ctx.translate(x, raftY); ctx.rotate(-vx / 190 * .5);
    if (cooldown && Math.floor(cooldown * 15) % 2) ctx.globalAlpha = .56;
    pill(ctx, -13, -16, 26, 32, 7, '#a87255');
    for (let i = -9; i < 11; i += 6) pill(ctx, i - 2, -16, 5, 32, 2, '#deb07a');
    line(ctx, -12, -9, 12, -9, '#6a5751', 2);
    line(ctx, -12, 9, 12, 9, '#6a5751', 2);
    disk(ctx, 0, 0, 6, '#f7d8a0');
    line(ctx, -18, 9, 19, -8, '#f3cf87', 2.5);
    ctx.restore();
    pill(ctx, 7, 7, w - 14, 26, 8, '#243646cf');
    caption(ctx, `${Math.floor(position)} 米　${timeScore()} 分`, 17, 20);
    caption(ctx, `耐久 ${'●'.repeat(3 - damage)}${'○'.repeat(damage)}`, w - 17, 20, '#fde0ad', 12, 'right');
  }
  scene.status('顺流漂行，调整方向避开岩石和岸边。');
  scene.start(step, draw);
}

export const gliderGates = [
  [252, 146, 43], [421, 102, 40], [580, 132, 39], [743, 193, 37], [908, 207, 34],
  [1064, 150, 38], [1240, 96, 37], [1419, 111, 34], [1556, 171, 34], [1732, 207, 34],
  [1894, 151, 33], [2064, 90, 34], [2243, 123, 33], [2394, 181, 32],
];
const gliderFinish = 2516;
const gliderCeiling = x => 53 + Math.sin(x / 145) * 14 + Math.sin(x / 51) * 5;
const gliderFloor = x => 263 + Math.sin(x / 127 + .8) * 16 + Math.cos(x / 73) * 8;

export function glider(host, api) {
  const controls = [
    ['up', '↑ 拉升', ['arrowup', 'w'], true],
    ['down', '↓ 俯冲', ['arrowdown', 's'], true],
  ];
  const scene = createScene(host, api, { label: '山谷风门与滑翔机', controls });
  const { ctx, width: w, height: h } = scene;
  let x = 38, y = 150, speed = 132, vy = 0, pitch = 0, score = 0, gates = 0, processed = 0;
  const results = [];
  function step(dt) {
    const steer = scene.axis('up', 'down');
    pitch += (steer * .67 - pitch) * Math.min(1, dt * 4.2);
    speed += (132 + pitch * 64 - speed) * dt * 1.7;
    vy += (pitch * 146 + 4 - vy) * Math.min(1, dt * 4.9);
    x += speed * dt;
    y += vy * dt;
    if (y < gliderCeiling(x) + 6 || y > gliderFloor(x) - 6) {
      scene.end(`擦到山壁，获得 ${score} 分。`, score);
      return;
    }
    if (processed < gliderGates.length && x >= gliderGates[processed][0]) {
      const [, center, radius] = gliderGates[processed];
      const error = Math.abs(y - center);
      const passed = error <= radius;
      results.push(passed);
      processed++;
      if (passed) { gates++; score += 100 + Math.floor(50 * (1 - error / radius)); }
    }
    if (x >= gliderFinish) { scene.end(`穿过 ${gates} 道风门，获得 ${score + 250} 分。`, score + 250); return; }
    scene.status(`风门 ${gates} / ${gliderGates.length}　${score} 分　速度 ${Math.round(speed)}`, .35);
  }
  function draw() {
    const camera = Math.max(0, x - 93);
    backdrop(ctx, w, h, '#295267', '#9cbca3');
    disk(ctx, 278, 88, 32, '#d7e6b37f');
    for (let i = 0; i < 11; i++) {
      const at = i * 56 - (camera * .32) % 56;
      const high = 157 + Math.sin((i + Math.floor(camera * .32 / 56)) * 2.1) * 29;
      path(ctx, [[at - 31, h], [at + 28, high], [at + 84, h]], '#527e7ca9');
    }
    const top = [], bottom = [];
    for (let sx = 0; sx <= w; sx += 4) {
      top.push([sx, gliderCeiling(camera + sx)]);
      bottom.push([sx, gliderFloor(camera + sx)]);
    }
    path(ctx, [[0, 0], ...top, [w, 0]], '#314752');
    path(ctx, [[0, h], ...bottom, [w, h]], '#41584f');
    for (let i = 2; i < top.length; i += 4) {
      line(ctx, top[i - 2][0], top[i - 2][1], top[i][0], top[i][1], '#88a79e', 1.3);
      line(ctx, bottom[i - 2][0], bottom[i - 2][1], bottom[i][0], bottom[i][1], '#bfd0a1', 1.3);
    }
    for (let i = 0; i < 12; i++) {
      const sx = (i * 97 + 15 - camera * .8) % (w + 40);
      const sy = 65 + i * 59 % 172;
      line(ctx, (sx + w + 40) % (w + 40), sy, (sx + w + 40) % (w + 40) - 16, sy + 1, '#f4f3c956');
    }
    for (const [index, [gx, gy, gr]] of gliderGates.entries()) {
      const sx = gx - camera;
      if (sx < -15 || sx > w + 15) continue;
      const color = results[index] === false ? '#6f676e' : results[index] ? '#b4e59f' : '#fae293';
      ctx.beginPath(); ctx.ellipse(sx, gy, 11, gr, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#fce9a526'; ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
      gem(ctx, sx, gy - gr, color, '#fff2c1', 5);
      gem(ctx, sx, gy + gr, color, '#fff2c1', 5);
      line(ctx, sx - 7, gy, sx + 7, gy, color, 1);
    }
    const finishX = gliderFinish - camera;
    if (finishX < w + 15) line(ctx, finishX, gliderCeiling(gliderFinish), finishX, gliderFloor(gliderFinish), '#e9f5af', 3);
    const sx = x - camera;
    ctx.save(); ctx.translate(sx, y); ctx.rotate(pitch * .7);
    path(ctx, [[-19, 5], [-10, -2], [1, -4], [6, -13], [19, -5], [18, 0], [7, 2], [3, 7]], '#f0ba79');
    path(ctx, [[-14, 3], [2, -1], [18, -5], [7, 1], [3, 6]], '#f9e1a9');
    line(ctx, -18, 6, 3, 7, '#644b55', 2);
    ctx.restore();
    caption(ctx, `${gates} / ${gliderGates.length} 道风门`, 17, 21);
    caption(ctx, `${score} 分　${Math.round(speed)} 速`, w - 17, 21, '#fcf0be', 12, 'right');
  }
  scene.status('拉升或俯冲，让滑翔机对准前方风门。');
  scene.start(step, draw);
}
