import { WIDTH, TAU, circle, clamp, directions, line, pill, polygon, reflect, screen, text } from './arcade-view.js';

const riverLanes = [
  { row: 1, length: 94, spacing: 155, speed: 39, color: '#d1aa77' },
  { row: 2, length: 112, spacing: 180, speed: -47, color: '#bd825d' },
  { row: 3, length: 79, spacing: 130, speed: 54, color: '#d5a87b' },
  { row: 5, length: 47, spacing: 161, speed: -65, color: '#ef947f' },
  { row: 6, length: 58, spacing: 177, speed: 78, color: '#deb26b' },
  { row: 7, length: 40, spacing: 131, speed: -57, color: '#a2b3db' },
];

export function riverSquad(host, api) {
  const cell = 40, rowHeight = 44, height = rowHeight * 9;
  const view = screen(host, api, '小队过河', height, '#688157');
  const { ctx, canvas } = view;
  const lanes = riverLanes.map(lane => ({ ...lane, offset: api.random() * lane.spacing }));
  const campColumns = [0, 2, 5, 8];
  const occupied = new Set();
  let x = 180, row = 8, time = 0, lives = 5, safeUntil = 0, nextMove = 0;
  const score = () => occupied.size * 100 + (occupied.size === campColumns.length ? 150 : 0);
  const finish = message => view.end(`${message}，${occupied.size} 位队员抵达。`, score());
  function forLaneObjects(lane, fn) {
    const origin = ((lane.offset + time * lane.speed) % lane.spacing + lane.spacing) % lane.spacing;
    for (let start = origin - lane.spacing; start < WIDTH; start += lane.spacing) fn(start, start + lane.length);
  }
  function reset() {
    x = 180;
    row = 8;
    safeUntil = time + .45;
  }
  function lose(message) {
    lives--;
    if (!lives) { finish('出发机会用尽'); return; }
    reset();
    view.say(`${message}，还可出发 ${lives} 次`);
  }
  function checkLane(delta) {
    const lane = lanes.find(lane => lane.row === row);
    if (!lane) return;
    let overlapping = false;
    forLaneObjects(lane, (start, end) => {
      if (row < 4 ? x >= start + 3 && x <= end - 3 : x >= start - 9 && x <= end + 9) overlapping = true;
    });
    if (row < 4) {
      if (!overlapping) { lose('落水了'); return; }
      x += lane.speed * delta;
      if (x < 6 || x > WIDTH - 6) lose('随浮木漂出了边线');
    } else if (overlapping) lose('撞上了车辆');
  }
  function move(dx, dy) {
    if (time < safeUntil || time < nextMove) return;
    const goalRow = clamp(row + dy, 0, 8);
    const goalX = clamp(x + dx * cell, cell / 2, WIDTH - cell / 2);
    if (goalX === x && goalRow === row) return;
    if (goalRow === 0) {
      const column = Math.floor(x / cell);
      if (!campColumns.includes(column) || occupied.has(column)) {
        view.say('该处没有空营位');
        return;
      }
      occupied.add(column);
      if (occupied.size === campColumns.length) { finish('四位队员全部到达'); return; }
      reset();
      view.say(`第 ${occupied.size} 位队员安全抵达`);
      return;
    }
    nextMove = time + .095;
    if (dx) x = goalX;
    row = goalRow;
    checkLane(0);
  }
  directions(view, move);
  view.on(canvas, 'click', event => {
    const point = view.point(event);
    const dx = Math.floor(point.x / cell) - Math.floor(x / cell), dy = Math.floor(point.y / rowHeight) - row;
    if (Math.abs(dx) + Math.abs(dy) === 1) move(dx, dy);
  });
  function update(delta) {
    time = api.elapsed();
    if (time >= 70) { finish('时间到'); return; }
    checkLane(delta);
  }
  function runner(px, py, color) {
    circle(ctx, px, py + 13, 11, '#24362946');
    pill(ctx, px - 9, py + 1, 18, 15, 6, color);
    circle(ctx, px, py - 4, 9, '#f7dcaa', '#44362a', 1.5);
    pill(ctx, px - 11, py - 11, 22, 8, 4, color);
    circle(ctx, px - 3, py - 3, 1.2, '#594633');
    circle(ctx, px + 3, py - 3, 1.2, '#594633');
  }
  function draw() {
    view.clear();
    ctx.fillStyle = '#3d7983'; ctx.fillRect(0, rowHeight, WIDTH, rowHeight * 3);
    ctx.fillStyle = '#404958'; ctx.fillRect(0, rowHeight * 5, WIDTH, rowHeight * 3);
    for (const camp of campColumns) {
      pill(ctx, camp * cell + 4, 4, cell - 8, 34, 7, occupied.has(camp) ? '#365a4a' : '#bad39b');
      if (occupied.has(camp)) runner(camp * cell + cell / 2, 20, '#e98b71');
      else polygon(ctx, [[camp * cell + 8, 30], [camp * cell + 20, 12], [camp * cell + 32, 30]], '#648659');
    }
    for (let i = 0; i < 18; i++) {
      const px = i * 23 % WIDTH, py = rowHeight + (i * 17) % 126;
      line(ctx, px, py, px + 11, py, '#78aea6', 1.5);
      if (i % 2 === 0) for (const y of [6, 7]) line(ctx, px, y * rowHeight, px + 14, y * rowHeight, '#b6b6b9', 1.5);
    }
    for (const lane of lanes) {
      const y = lane.row * rowHeight;
      forLaneObjects(lane, (start, end) => {
        if (lane.row < 4) {
          pill(ctx, start, y + 12, lane.length, 23, 10, lane.color);
          line(ctx, start + 10, y + 18, end - 12, y + 18, '#ecd1a2', 2);
          line(ctx, start + 16, y + 29, end - 10, y + 29, '#966243', 1.4);
        } else {
          pill(ctx, start, y + 11, lane.length, 24, 7, lane.color);
          pill(ctx, start + lane.length * .27, y + 14, lane.length * .44, 18, 3, '#344454');
          const front = lane.speed > 0 ? end - 4 : start + 4;
          circle(ctx, front, y + 16, 2, '#fff8c7');
          circle(ctx, front, y + 30, 2, '#fff8c7');
        }
      });
    }
    if (lives && occupied.size < campColumns.length) runner(x, row * rowHeight + 21, '#fac675');
    view.readout(`营位 ${occupied.size}/4　·　机会 ${lives}/5　·　${Math.max(0, 70 - Math.floor(time))} 秒`);
  }
  view.say('找一条避开车流和水面的路');
  view.run(update, draw);
}

const crackPatterns = [
  [3, 5, 9, 15, 18, 27, 33, 38, 44],
  [2, 11, 14, 20, 25, 29, 34, 38, 45],
  [1, 11, 17, 22, 24, 30, 35, 38, 46],
];
const patrolPath = [12, 13, 21, 20, 19, 11];

export function bouncePaint(host, api) {
  const cols = 8, rows = 7, cell = 43, x0 = 8, y0 = 11, height = 323;
  const home = (rows - 1) * cols;
  const view = screen(host, api, '弹跳涂色', height, '#253b45');
  const { ctx, canvas } = view;
  const cracked = new Set(crackPatterns[Math.floor(api.random() * crackPatterns.length)].filter(index => !patrolPath.includes(index)));
  const painted = new Set([home]);
  const target = cols * rows - cracked.size;
  let position = home, time = 0, misses = 0, hop, safeUntil = 0;
  const patrolAt = () => patrolPath[Math.floor(time / .72) % patrolPath.length];
  const center = index => ({ x: x0 + ((index % cols) + .5) * cell, y: y0 + (Math.floor(index / cols) + .5) * cell });
  const score = () => (painted.size - 1) * 10 + (painted.size === target ? 100 : 0);
  const finish = message => view.end(`${message}，已涂 ${painted.size}/${target} 格。`, score());
  function fault(message) {
    misses++;
    if (misses >= 3) { finish('失误次数用尽'); return; }
    position = home;
    safeUntil = time + .35;
    view.say(`${message}，返回起点`);
  }
  function jump(dx, dy) {
    if (hop || time < safeUntil) return;
    const col = position % cols + dx, row = Math.floor(position / cols) + dy;
    if (col < 0 || col >= cols || row < 0 || row >= rows) return;
    hop = { from: position, to: row * cols + col, start: time, end: time + .18 };
  }
  directions(view, jump);
  view.on(canvas, 'click', event => {
    const point = view.point(event);
    const dx = Math.floor((point.x - x0) / cell) - position % cols;
    const dy = Math.floor((point.y - y0) / cell) - Math.floor(position / cols);
    if (Math.abs(dx) + Math.abs(dy) === 1) jump(dx, dy);
  });
  function update() {
    time = api.elapsed();
    if (time >= 50) { finish('时间到'); return; }
    if (hop && time >= hop.end) {
      position = hop.to;
      hop = undefined;
      if (cracked.has(position)) { fault('落到了裂格'); return; }
      if (position === patrolAt()) { fault('遇上了清洁车'); return; }
      if (!painted.has(position)) {
        painted.add(position);
        if (painted.size === target) { finish('所有方格都涂满了'); return; }
      }
    }
    if (!hop && position === patrolAt()) fault('遇上了清洁车');
  }
  function draw() {
    view.clear();
    for (let i = 0; i < cols * rows; i++) {
      const { x, y } = center(i);
      const color = cracked.has(i) ? '#15242c' : painted.has(i) ? '#73ba9b' : '#516371';
      pill(ctx, x - 20, y - 20, 40, 40, 7, color);
      if (cracked.has(i)) {
        line(ctx, x - 9, y - 10, x + 2, y, '#81909c', 2);
        line(ctx, x + 2, y, x - 4, y + 6, '#81909c', 2);
        line(ctx, x - 4, y + 6, x + 8, y + 13, '#81909c', 2);
      } else if (painted.has(i)) circle(ctx, x, y, 2.2, '#cceabd');
    }
    const car = center(patrolAt());
    const next = center(patrolPath[(Math.floor(time / .72) + 1) % patrolPath.length]);
    circle(ctx, next.x, next.y, 11, '', '#efb76d', 1.5);
    pill(ctx, car.x - 13, car.y - 10, 26, 20, 6, '#efb76d');
    pill(ctx, car.x - 7, car.y - 5, 14, 6, 2, '#5d574c');
    circle(ctx, car.x - 7, car.y + 10, 3, '#1b2b34');
    circle(ctx, car.x + 7, car.y + 10, 3, '#1b2b34');
    let { x, y } = center(position);
    let lift = 0;
    if (hop) {
      const start = center(hop.from), end = center(hop.to);
      const t = clamp((time - hop.start) / .18, 0, 1);
      x = start.x + (end.x - start.x) * t;
      y = start.y + (end.y - start.y) * t;
      lift = Math.sin(t * Math.PI) * 19;
    }
    pill(ctx, x - 10, y + 8, 20, 8, 4, '#122c3480');
    circle(ctx, x, y - lift, 12, '#f5db85', '#392f37', 1.5);
    circle(ctx, x - 4, y - lift - 3, 2, '#392f37');
    circle(ctx, x + 4, y - lift - 3, 2, '#392f37');
    view.readout(`已涂 ${painted.size}/${target}　·　失误 ${misses}/3　·　${Math.max(0, 50 - Math.floor(time))} 秒`);
  }
  view.say('从左下角出发，跳向相邻方格');
  view.run(update, draw);
}

export function towerStack(host, api) {
  const height = 356, layerHeight = 17;
  const view = screen(host, api, '堆塔高手', height, '#d9dad5');
  const { ctx, canvas } = view;
  const colors = ['#78a286', '#759eb0', '#b3809c', '#c57f69', '#d8a963'];
  const layers = [{ x: 112, w: 136 }];
  const falloffs = [];
  let time = 0, spawnTime = 0, score = 0, spawnRight = false;
  const finish = reason => view.end(`${reason}，塔高 ${layers.length - 1} 层。`, score);
  function moving() {
    const top = layers.at(-1);
    const high = WIDTH - 10 - top.w;
    const speed = 121 + Math.min(180, layers.length * 8);
    const x = reflect((spawnRight ? high : 10) + (time - spawnTime) * speed, 10, high);
    return { x, w: top.w };
  }
  function drop() {
    const top = layers.at(-1), block = moving();
    const perfect = Math.abs(top.x - block.x) <= 3;
    const left = Math.max(top.x, block.x), right = Math.min(top.x + top.w, block.x + block.w);
    if (right - left < 3 && !perfect) { finish('方块没有落稳'); return; }
    if (perfect) {
      layers.push({ ...top });
      score += 15;
      view.say('完美对齐，奖励 15 分');
    } else {
      const excess = block.w - (right - left);
      falloffs.push({ x: block.x < top.x ? block.x : right, w: excess, y: yAt(layers.length), time, direction: block.x < top.x ? -1 : 1 });
      layers.push({ x: left, w: right - left });
      score += 10;
      view.say('成功落块');
    }
    if (layers.length === 31) { finish('三十层塔完工'); return; }
    spawnTime = time;
    spawnRight = !spawnRight;
  }
  function yAt(index) {
    return height - 33 - index * layerHeight + Math.max(0, layers.length - 13) * layerHeight;
  }
  function drawBlock(block, y, index) {
    pill(ctx, block.x, y, block.w, layerHeight - 2, Math.min(3, block.w / 2), colors[index % colors.length]);
    if (block.w > 8) line(ctx, block.x + 4, y + 3, block.x + block.w - 4, y + 3, '#ffffff65', 1.3);
  }
  function update() {
    time = api.elapsed();
    while (falloffs.length && time - falloffs[0].time > .8) falloffs.shift();
    if (time >= 30) finish('时间到');
  }
  function draw() {
    view.clear();
    circle(ctx, 272, 80, 46, '#efd5a1');
    polygon(ctx, [[0, 272], [69, 186], [110, 226], [149, 170], [229, 264], [273, 203], [360, 272], [360, 356], [0, 356]], '#bec9bb');
    polygon(ctx, [[0, 294], [54, 257], [122, 286], [189, 233], [249, 283], [313, 242], [360, 276], [360, 356], [0, 356]], '#9eaf9e');
    const top = layers.at(-1), ghostY = yAt(layers.length);
    ctx.setLineDash([5, 5]);
    line(ctx, top.x, ghostY - 13, top.x, ghostY + layerHeight, '#456859', 1.5);
    line(ctx, top.x + top.w, ghostY - 13, top.x + top.w, ghostY + layerHeight, '#456859', 1.5);
    ctx.setLineDash([]);
    for (let i = Math.max(0, layers.length - 19); i < layers.length; i++) drawBlock(layers[i], yAt(i), i);
    for (const part of falloffs) {
      const age = time - part.time;
      ctx.globalAlpha = clamp(1 - age / .65, 0, 1);
      drawBlock({ x: part.x + age * 36 * part.direction, w: part.w }, part.y + age ** 2 * 320, layers.length - 1);
    }
    ctx.globalAlpha = 1;
    drawBlock(moving(), ghostY, layers.length);
    view.readout(`塔高 ${layers.length - 1} 层　·　得分 ${score}　·　${Math.max(0, 30 - Math.floor(time))} 秒`);
  }
  view.button('落块', drop);
  view.keys([' '], drop);
  view.on(canvas, 'click', drop);
  view.say('让移动方块对齐塔顶');
  view.run(update, draw);
}
