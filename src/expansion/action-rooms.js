import { actionButton, backdrop, caption, clamp, createScene, directions, disk, duration, gem, line, path, pill, rect } from './action-scene.js';

const moveOffsets = new Map([['left', [-1, 0]], ['right', [1, 0]], ['up', [0, -1]], ['down', [0, 1]]]);
const stamp = (x, y) => `${x},${y}`;
const scanner = (map, value) => map.flatMap((row, y) => [...row].flatMap((tile, x) => tile === value ? [{ x, y }] : []));
const same = (a, b) => a.x === b.x && a.y === b.y;

function driveGrid(scene, move, interval = .14) {
  let delay = 0, queued;
  return dt => {
    delay = Math.max(0, delay - dt);
    for (const direction of moveOffsets.keys()) if (scene.press(direction)) queued = direction;
    if (delay > 0) return;
    const action = queued ?? [...moveOffsets.keys()].find(direction => scene.down(direction));
    if (action) {
      queued = undefined;
      move(...moveOffsets.get(action));
      delay = interval;
    }
  };
}

function squareGrid(scene, map, size, titleHeight = 28) {
  const { ctx, width: w, height: h } = scene;
  const left = (w - map[0].length * size) / 2;
  const top = titleHeight + (h - titleHeight - map.length * size) / 2;
  const corner = (x, y) => [left + x * size, top + y * size];
  const center = (x, y) => corner(x + .5, y + .5);
  const cells = fn => map.forEach((row, y) => Array.from(row).forEach((tile, x) => fn(tile, x, y, ...corner(x, y))));
  return { ctx, w, h, size, corner, center, cells };
}

export const drillMine = [
  '############',
  '#P1.12O2.3F#',
  '#1#2#121#11#',
  '#O12#3.1.O1#',
  '#321222##32#',
  '#2.##3F.1.1#',
  '#.1O2###121#',
  '#F2#1.O321.#',
  '#2213#211#O#',
  '#.1.1F213.E#',
  '############',
];
const hardness = { '1': 1, '2': 2, '3': 4 };

export function drill(host, api) {
  const scene = createScene(host, api, { label: '穿岩钻车矿图', controls: directions, height: 320 });
  const { ctx, w, h, size, center, cells } = squareGrid(scene, drillMine, 25);
  const [start] = scanner(drillMine, 'P');
  const oreTotal = scanner(drillMine, 'O').length;
  const dug = new Set();
  let car = { ...start }, facing = 0, fuel = 42, ores = 0, flash = 0, note = '';
  const tileAt = (x, y) => dug.has(stamp(x, y)) ? '.' : drillMine[y]?.[x] ?? '#';

  function canContinue() {
    const frontier = [{ ...car, cost: 0 }];
    const costs = new Map([[stamp(car.x, car.y), 0]]);
    while (frontier.length) {
      const { x, y, cost } = frontier.shift();
      const tile = tileAt(x, y);
      if (tile === 'F' || (ores < oreTotal ? tile === 'O' : tile === 'E')) return true;
      for (const [dx, dy] of moveOffsets.values()) {
        const nx = x + dx, ny = y + dy, next = tileAt(nx, ny);
        if (next === '#' || (next === 'E' && ores < oreTotal)) continue;
        const total = cost + (hardness[next] || 0);
        const id = stamp(nx, ny);
        if (total > fuel || total >= (costs.get(id) ?? Infinity)) continue;
        costs.set(id, total);
        frontier.push({ x: nx, y: ny, cost: total });
      }
    }
    return false;
  }
  const drive = driveGrid(scene, (dx, dy) => {
    facing = Math.atan2(dy, dx);
    const x = car.x + dx, y = car.y + dy, tile = tileAt(x, y);
    const cost = hardness[tile] || 0;
    if (tile === '#') { note = '黑岩无法钻开'; return; }
    if (tile === 'E' && ores < oreTotal) { note = '出口需要全部矿晶'; return; }
    if (fuel < cost) { note = '能量不足，可另寻通路'; return; }
    car = { x, y };
    dug.add(stamp(x, y));
    fuel -= cost;
    if (tile === 'F') fuel += 10;
    if (tile === 'O') ores++;
    flash = cost ? .11 : 0;
    note = tile === 'F' ? '能量补充 +10' : '';
    if (tile === 'E') scene.end(`矿晶全部运出，剩余 ${fuel} 点能量。`, fuel);
    else if (!canContinue()) scene.end('能量不足，钻车无法运出矿晶。');
  }, .17);

  function draw() {
    backdrop(ctx, w, h, '#22282d', '#342f2d');
    cells((_, x, y, sx, sy) => {
      const tile = tileAt(x, y);
      const colors = { '#': '#151b24', '1': '#67513e', '2': '#765d80', '3': '#465a6d' };
      rect(ctx, sx + .5, sy + .5, size - 1, size - 1, colors[tile] || '#322f30');
      if (tile === '#') {
        path(ctx, [[sx + 4, sy + 17], [sx + 11, sy + 4], [sx + 23, sy + 10], [sx + 19, sy + 19]], '#26313c');
      }
      if (hardness[tile]) {
        for (let i = 0; i < Number(tile); i++) line(ctx, sx + 3, sy + 16 + i * 2, sx + 20, sy + 9 + i * 2, '#ffe3d850');
      }
      if (tile === 'O') gem(ctx, sx + size / 2, sy + size / 2, '#ebaf52', '#ffeab0', 8);
      if (tile === 'F') {
        pill(ctx, sx + 5, sy + 7, 15, 11, 3, '#a9df80');
        rect(ctx, sx + 20, sy + 10, 2, 5, '#a9df80');
        rect(ctx, sx + 8, sy + 10, 9, 5, '#497553');
      }
      if (tile === 'E') pill(ctx, sx + 4, sy + 3, size - 8, size - 6, 4, ores === oreTotal ? '#bce590' : '#557659');
    });
    const [x, y] = center(car.x, car.y);
    ctx.save(); ctx.translate(x, y); ctx.rotate(facing);
    pill(ctx, -9, -9, 17, 18, 5, '#e2b161');
    rect(ctx, -5, -5, 9, 10, '#304d58');
    path(ctx, [[7, -7], [14, 0], [7, 7]], '#e7e2ca');
    if (flash > 0) for (let i = 0; i < 4; i++) disk(ctx, 12 + i * 2, (i % 2 ? -1 : 1) * (2 + i), 1.2, '#eec078');
    ctx.restore();
    caption(ctx, `能量 ${fuel}`, 17, 18, fuel < 9 ? '#f6aa91' : '#f9dd9d');
    caption(ctx, `矿晶 ${ores} / ${oreTotal}`, w - 16, 18, '#f9dd9d', 12, 'right');
  }
  scene.status('绕开高耗能矿层，收齐矿晶后开往出口。');
  scene.start(dt => {
    flash -= dt;
    drive(dt);
    scene.status(`能量 ${fuel}　矿晶 ${ores} / ${oreTotal}${note ? `　${note}` : ''}`);
  }, draw);
}

export const shadowRooms = [
  [
    '############', '#......#...#', '#..X...#...#', '#L....SG..E#', '#..P...#...#',
    '#......#...#', '#......#...#', '#......#...#', '############',
  ],
  [
    '############', '#......#...#', '#L....S#...#', '#..X...#...#', '#..P...G..E#',
    '#L....S#...#', '#..X...#...#', '#......#...#', '############',
  ],
  [
    '############', '#P.#...#...#', '#.X#...#...#', '#L....S#...#', '#...#..G...#',
    '#..X...#..E#', '#L....S#...#', '#..#...#...#', '############',
  ],
  [
    '############', '#..P...#...#', '#L....S#...#', '#..#.X.#...#', '#..X...G...#',
    '#.#..#.#..E#', '#L....S#...#', '#.....##...#', '############',
  ],
];

export function shadow(host, api) {
  const scene = createScene(host, api, { label: '灯光、感应器与木箱机关', controls: [...directions, actionButton('重置房间', ['r'])] });
  let room = 0, map, player, boxes, sensors;
  function load() {
    map = shadowRooms[room];
    [player] = scanner(map, 'P');
    boxes = scanner(map, 'X');
    sensors = scanner(map, 'S').map(sensor => ({ ...sensor, source: map[sensor.y].indexOf('L') }));
  }
  const shade = sensor => boxes.filter(box => box.y === sensor.y && box.x > sensor.source && box.x < sensor.x).sort((a, b) => a.x - b.x)[0];
  const tile = (x, y) => map[y]?.[x] ?? '#';
  const block = (x, y) => '#L'.includes(tile(x, y)) || (tile(x, y) === 'G' && !sensors.every(shade));
  const drive = driveGrid(scene, (dx, dy) => {
    const target = { x: player.x + dx, y: player.y + dy };
    if (block(target.x, target.y)) return;
    const box = boxes.find(item => same(item, target));
    if (box) {
      const next = { x: box.x + dx, y: box.y + dy };
      if (block(next.x, next.y) || 'GS'.includes(tile(next.x, next.y)) || boxes.some(item => same(item, next))) return;
      Object.assign(box, next);
    }
    player = target;
    if (tile(player.x, player.y) === 'E') {
      if (room + 1 === shadowRooms.length) scene.end('四间密室的机关全部解开。', duration(api));
      else { room++; load(); }
    }
  });
  function draw() {
    const { ctx, w, h, size, center, cells } = squareGrid(scene, map, 26);
    backdrop(ctx, w, h, '#262431', '#393044');
    cells((kind, x, y, sx, sy) => {
      rect(ctx, sx + .5, sy + .5, size - 1, size - 1, kind === '#' ? '#5e4d63' : (x + y) % 2 ? '#393241' : '#3d3546');
      if (kind === '#') line(ctx, sx + 2, sy + 2, sx + size - 3, sy + 2, '#97809566');
      if (kind === 'G') pill(ctx, sx + 3, sy + 2, size - 6, size - 4, 5, sensors.every(shade) ? '#5f9378' : '#9c708b');
      if (kind === 'E') {
        pill(ctx, sx + 5, sy + 3, size - 10, size - 6, 6, '#95c999');
        pill(ctx, sx + 8, sy + 6, size - 16, size - 12, 3, '#36535c');
      }
    });
    for (const sensor of sensors) {
      const [a, y] = center(sensor.source, sensor.y);
      const [b] = center(sensor.x, sensor.y);
      const shadeBox = shade(sensor);
      const edge = shadeBox ? center(shadeBox.x, shadeBox.y)[0] : b;
      if (shadeBox) path(ctx, [[edge, y - 9], [b, y - 12], [b, y + 12], [edge, y + 9]], '#241d2ded');
      path(ctx, [[a, y - 3], [edge, y - 11], [edge, y + 11], [a, y + 3]], '#ffd37552');
      line(ctx, a, y, edge, y, '#ffe4a1c9', 1.5);
      disk(ctx, a, y, 9, '#ad7859'); disk(ctx, a, y, 5, '#ffe1a0');
      disk(ctx, b, y, 9, shadeBox ? '#8dcc89' : '#d89c68');
      disk(ctx, b, y, 4, shadeBox ? '#294f50' : '#ffe1a4');
    }
    for (const box of boxes) {
      const [x, y] = center(box.x, box.y);
      pill(ctx, x - 10, y - 10, 20, 20, 3, '#bd895f');
      rect(ctx, x - 7, y - 7, 14, 14, '#745055');
      line(ctx, x - 7, y - 7, x + 7, y + 7, '#d8a671', 3);
    }
    const [x, y] = center(player.x, player.y);
    pill(ctx, x - 7, y - 4, 14, 13, 4, '#a6c6a4');
    disk(ctx, x, y - 5, 6, '#f2d6b7');
    rect(ctx, x - 6, y - 9, 12, 3, '#5c4866');
    caption(ctx, `密室 ${room + 1} / ${shadowRooms.length}`, 16, 20);
    caption(ctx, `感应器 ${sensors.filter(shade).length} / ${sensors.length}`, w - 16, 20, '#f2d89e', 12, 'right');
  }
  load();
  scene.status('把木箱推入光束，感应器进入阴影后门会打开。');
  scene.start(dt => {
    if (scene.press('action')) load();
    drive(dt);
    const count = sensors.filter(shade).length;
    scene.status(`密室 ${room + 1} / ${shadowRooms.length}　感应器 ${count} / ${sensors.length}${count === sensors.length ? '　机关门已开启' : ''}`);
  }, draw);
}

export const stealthMap = [
  '############',
  '#P...#....E#',
  '#.#..#.##..#',
  '#.#s...s...#',
  '#...##..#..#',
  '##.s....#..#',
  '#..###..s..#',
  '#.s...#.#..#',
  '#..#..#..K.#',
  '#..........#',
  '############',
];
const patrols = [
  [{ x: 3, y: 3 }, { x: 10, y: 3 }],
  [{ x: 9, y: 4 }, { x: 9, y: 8 }],
  [{ x: 2, y: 9 }, { x: 8, y: 9 }],
];

export function stealth(host, api) {
  const scene = createScene(host, api, { label: '巡逻员、掩体、钥匙和撤离门', controls: directions, height: 320 });
  const { ctx, w, h, size, center, cells } = squareGrid(scene, stealthMap, 25);
  let [player] = scanner(stealthMap, 'P');
  const [key] = scanner(stealthMap, 'K');
  const [exit] = scanner(stealthMap, 'E');
  let time = 0, alert = 0, hasKey = false, visible = false;
  const floor = (x, y) => (stealthMap[Math.round(y)]?.[Math.round(x)] ?? '#') !== '#';
  const guards = () => patrols.map(([from, to], index) => {
    const d = Math.hypot(to.x - from.x, to.y - from.y);
    const t = (time * (1.29 + index * .11) + index * 2.36) % (d * 2);
    const offset = (t < d ? t : d * 2 - t) / d;
    const sign = t < d ? 1 : -1;
    return { x: from.x + (to.x - from.x) * offset, y: from.y + (to.y - from.y) * offset, angle: Math.atan2((to.y - from.y) * sign, (to.x - from.x) * sign) };
  });
  const drive = driveGrid(scene, (dx, dy) => {
    const target = { x: player.x + dx, y: player.y + dy };
    if (!floor(target.x, target.y)) return;
    player = target;
    if (same(player, key)) hasKey = true;
  }, .145);
  function ray(guard, angle, max) {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    for (let d = .12; d <= max; d += .12) if (!floor(guard.x + dx * d, guard.y + dy * d)) return d - .12;
    return max;
  }
  function step(dt) {
    time += dt;
    drive(dt);
    visible = false;
    for (const guard of guards()) {
      const dx = player.x - guard.x, dy = player.y - guard.y;
      const distance = Math.hypot(dx, dy);
      if (distance < .5) { scene.end('撞上巡逻员，撤离失败。'); return; }
      const angle = Math.atan2(dy, dx);
      if (stealthMap[player.y][player.x] === 's' || distance > 3.45 || Math.cos(angle - guard.angle) < Math.cos(.49)) continue;
      if (ray(guard, angle, distance) >= distance) visible = true;
    }
    alert = clamp(alert + (visible ? 1.19 : -.58) * dt, 0, 1);
    if (alert >= 1) { scene.end('警报响起，巡逻员发现了你。'); return; }
    if (hasKey && same(player, exit)) { scene.end('成功拿到钥匙并撤离。', duration(api)); return; }
    scene.status(`${hasKey ? '钥匙已到手，前往撤离门' : '寻找钥匙'}　${visible ? '暴露' : '警觉'} ${Math.round(alert * 10) * 10}%`);
  }
  function draw() {
    backdrop(ctx, w, h, '#182235', '#273747');
    cells((tile, x, y, sx, sy) => {
      rect(ctx, sx + .5, sy + .5, size - 1, size - 1, tile === '#' ? '#4d5d6e' : tile === 's' ? '#234f70' : (x + y) % 2 ? '#202a3f' : '#222e42');
      if (tile === '#') line(ctx, sx + 2, sy + 2, sx + size - 2, sy + 2, '#8c9ba16e', 2);
      if (tile === 's') for (let i = 0; i < 3; i++) line(ctx, sx + 5, sy + 8 + i * 5, sx + 20, sy + 8 + i * 5, '#5e87ab');
      if (tile === 'E') pill(ctx, sx + 4, sy + 3, size - 8, size - 6, 5, hasKey ? '#a5d58b' : '#658173');
    });
    for (const guard of guards()) {
      const [x, y] = center(guard.x, guard.y);
      const points = [[x, y]];
      for (let i = -6; i <= 6; i++) {
        const angle = guard.angle + i * .49 / 6;
        const reach = ray(guard, angle, 3.45);
        points.push(center(guard.x + Math.cos(angle) * reach, guard.y + Math.sin(angle) * reach));
      }
      path(ctx, points, visible ? '#f998775e' : '#f5cc7f4c');
      disk(ctx, x, y, 7, '#dfaa7e');
      disk(ctx, x + Math.cos(guard.angle) * 4.5, y + Math.sin(guard.angle) * 4.5, 3, '#464055');
    }
    if (!hasKey) {
      const [x, y] = center(key.x, key.y);
      disk(ctx, x - 4, y - 3, 5, '#ffdc7b'); disk(ctx, x - 4, y - 3, 2.3, '#233246');
      line(ctx, x - 1, y, x + 7, y + 6, '#ffdc7b', 3);
      line(ctx, x + 5, y + 4, x + 8, y, '#ffdc7b', 2);
    }
    const [x, y] = center(player.x, player.y);
    pill(ctx, x - 6, y - 3, 12, 12, 4, '#a1cbea');
    disk(ctx, x, y - 4, 6, '#d5e9f5');
    line(ctx, x - 4, y - 4, x + 4, y - 4, '#34465c', 2);
    caption(ctx, hasKey ? '撤离门已解锁' : '寻找钥匙', 17, 18, '#d7edf8');
    caption(ctx, '警觉', w - 104, 18, '#d7edf8');
    pill(ctx, w - 73, 13, 56, 10, 4, '#425469');
    if (alert > 0) pill(ctx, w - 73, 13, 56 * alert, 10, 3, alert > .7 ? '#f99a91' : '#eac27e');
  }
  scene.status('在蓝色掩体里观察巡逻，经过走廊时避开视野。');
  scene.start(step, draw);
}
