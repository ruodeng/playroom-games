import { box, circle, clamp, ellipse, lettering, line, stage } from './sports-core.js';

const ink = '#35472c';
const cream = '#fffbea';
const green = '#587b42';

const slalom = [156, 250, 130, 231, 265, 153, 102, 223, 260, 164, 102, 204, 266, 151, 123, 237, 269, 163, 116, 220]
  .map((x, index) => ({ x, z: 195 + index * 166, width: 90 - (index % 6) * 5, color: index % 2 ? '#557da1' : '#ad5847' }));
const slalomFinish = slalom.at(-1).z + 137;

export function skiing(host, api) {
  const ui = stage(host, api, '滑雪回转', 390, 320, [['通过', '0 / 20'], ['漏门', '0'], ['用时', '0.00 秒']]);
  const left = ui.hold('← 左转', 'ArrowLeft');
  const right = ui.hold('右转 →', 'ArrowRight');
  let target = null;
  ui.pointer(point => { target = point.x; }, () => { target = null; });
  let x = 195;
  let velocity = 0;
  let z = 0;
  let time = 0;
  let gate = 0;
  let missed = 0;
  const gateScreenY = depth => 243 + (z - depth) * .97;
  function update(dt) {
    const keyboard = Number(right()) - Number(left());
    const direction = keyboard || (target === null ? 0 : clamp((target - x) / 20, -1, 1));
    const forward = x < 64 || x > 326 ? 68 : 112;
    const before = z;
    const previousX = x;
    velocity += (direction * 216 - velocity) * (1 - Math.exp(-10 * dt));
    x = clamp(x + velocity * dt, 49, 341);
    z += forward * dt;
    time += Math.min(dt, (slalomFinish - before) / forward);
    if (gate < slalom.length && z >= slalom[gate].z) {
      const current = slalom[gate++];
      const fraction = (current.z - before) / (z - before);
      const crossing = previousX + (x - previousX) * fraction;
      const hit = Math.abs(crossing - current.x) <= current.width / 2 - 3;
      if (!hit) missed++;
      ui.status(hit ? `通过第 ${gate} 道旗门。` : `漏过第 ${gate} 道旗门，加罚 2.5 秒。`);
    }
    ui.stat(`${gate - missed} / 20`, missed, `${time.toFixed(2)} 秒`);
    if (z >= slalomFinish) {
      const result = time + missed * 2.5;
      ui.finish(`冲线，通过 ${gate - missed} 道旗门，含罚时 ${result.toFixed(2)} 秒。`, Math.round(result));
    }
  }
  function draw(ctx) {
    box(ctx, 0, 0, 390, 320, '#d6e6e2');
    box(ctx, 40, 0, 310, 320, '#f2f7ef');
    box(ctx, 40, 0, 19, 320, '#e2ece6');
    box(ctx, 331, 0, 19, 320, '#e2ece6');
    line(ctx, [[40, 0], [40, 320]], '#afbfb3', 2);
    line(ctx, [[350, 0], [350, 320]], '#afbfb3', 2);
    for (let i = 0; i < 6; i++) {
      const y = (i * 61 + z * .97) % 366 - 20;
      const shift = (i * 17) % 15;
      for (const treeX of [15 + shift, 376 - shift]) {
        line(ctx, [[treeX, y + 9], [treeX, y + 15]], '#697b5e', 2);
        ctx.beginPath();
        ctx.moveTo(treeX, y - 13);
        ctx.lineTo(treeX - 9, y + 9);
        ctx.lineTo(treeX + 9, y + 9);
        ctx.fillStyle = '#779a7b';
        ctx.fill();
      }
    }
    for (let i = Math.max(0, gate - 1); i < slalom.length; i++) {
      const g = slalom[i];
      const y = gateScreenY(g.z);
      if (y < -10) break;
      if (y > 345) continue;
      const a = g.x - g.width / 2;
      const b = g.x + g.width / 2;
      line(ctx, [[a, y], [b, y]], g.color, 1.5, [3, 4]);
      for (const [pole, offset] of [[a, -1], [b, 1]]) {
        line(ctx, [[pole, y + 2], [pole, y - 20]], g.color, 2);
        box(ctx, pole + (offset < 0 ? -13 : 0), y - 20, 13, 8, g.color, 2);
      }
    }
    const end = gateScreenY(slalomFinish);
    if (end > -12 && end < 330) {
      for (let i = 0; i < 25; i++) {
        box(ctx, 45 + i * 12, end, 12, 7, i % 2 ? '#f8f8ed' : ink);
        box(ctx, 45 + i * 12, end + 7, 12, 7, i % 2 ? ink : '#f8f8ed');
      }
    }
    ctx.save();
    ctx.translate(x, 243);
    ctx.rotate(-velocity / 455);
    ellipse(ctx, 0, 16, 13, 5, '#869e9366');
    line(ctx, [[-5, -7], [-5, 18]], '#496d6f', 3);
    line(ctx, [[5, -7], [5, 18]], '#496d6f', 3);
    line(ctx, [[-8, 0], [-14, 13]], '#7b8c7d', 1.8);
    line(ctx, [[8, 0], [14, 13]], '#7b8c7d', 1.8);
    box(ctx, -7, -8, 14, 17, '#b45f44', 4);
    circle(ctx, 0, -12, 6, '#f3d398');
    ctx.restore();
  }
  ui.status('穿过前方的旗门。靠近雪道边缘会减速。');
  ui.frame(update, draw);
}

const beatDuration = 1.36;
const goodBeat = .65;
const rowingGoal = 500;
const raceLimit = 80;

export function rowing(host, api) {
  const ui = stage(host, api, '节奏赛艇', 390, 281, [['已划', '0 / 500 米'], ['艇速', '0.0 米/秒'], ['准时拉桨', '0 次']]);
  const meter = ui.meter('拉桨节拍');
  let time = 0;
  let water = 0;
  let cruise = 0;
  let lastBeat = -1;
  let lastStroke = -1;
  let accurate = 0;
  ui.button('拉桨', stroke, true);
  ui.key(' ', stroke);
  function stroke() {
    const beat = Math.floor(time / beatDuration);
    if (lastBeat === beat) return;
    lastBeat = beat;
    lastStroke = time;
    const phase = time / beatDuration - beat;
    const error = Math.abs(phase - goodBeat);
    if (error <= .13) {
      accurate++;
      cruise = Math.min(12.4, cruise + 3.5 - 5 * error);
      ui.status(error < .045 ? '完美拉桨！' : '准时，艇速提高。');
    } else {
      cruise = Math.max(0, cruise - .7) + .65;
      ui.status(phase < goodBeat ? '拉桨偏早，等下一拍。' : '拉桨偏晚，等下一拍。');
    }
  }
  function update(dt) {
    const previous = water;
    const timeStep = Math.min(dt, raceLimit - time);
    cruise *= Math.exp(-.235 * timeStep);
    water = Math.min(rowingGoal, water + cruise * timeStep);
    time += timeStep;
    ui.stat(`${Math.floor(water)} / 500 米`, `${cruise.toFixed(1)} 米/秒`, `${accurate} 次`);
    const phase = (time / beatDuration) % 1;
    meter(phase, [goodBeat - .13, goodBeat + .13], Math.abs(phase - goodBeat) <= .13 ? '拉桨时机' : '等待节拍');
    if (water === rowingGoal || time >= raceLimit) {
      if (water === rowingGoal && cruise > 0) time -= timeStep - (water - previous) / cruise;
      const result = time + Math.ceil((rowingGoal - water) / 5);
      ui.finish(water === rowingGoal ? `完成 500 米，用时 ${result.toFixed(2)} 秒。` : `已划 ${Math.floor(water)} 米，含罚时 ${result.toFixed(2)} 秒。`, Math.round(result));
    }
  }
  function draw(ctx) {
    box(ctx, 0, 0, 390, 281, '#d5e4da');
    box(ctx, 44, 0, 302, 281, '#8fb9b5');
    box(ctx, 51, 0, 144, 281, '#97c0b8');
    box(ctx, 198, 0, 141, 281, '#a2c7bf');
    for (let i = 0; i < 9; i++) {
      const y = (i * 37 + water * 5) % 333 - 20;
      line(ctx, [[65 + (i * 19) % 45, y], [93 + (i * 19) % 45, y]], '#c0d6cb');
      line(ctx, [[243 + (i * 19) % 46, y + 9], [273 + (i * 19) % 46, y + 9]], '#cde1d4');
      circle(ctx, 197, y, 2.7, '#ecf0d3');
    }
    if (rowingGoal - water < 45) {
      const y = 179 - (rowingGoal - water) * 4.7;
      line(ctx, [[47, y], [345, y]], cream, 3, [6, 6]);
    }
    drawBoat(126, 179, '#ad654c', clamp(1 - (time - lastStroke) * 2.7, 0, 1));
    const ghost = Math.min(rowingGoal, time * 9);
    const rivalY = clamp(179 + (water - ghost) * 3, 30, 251);
    drawBoat(264, rivalY, '#566f67', (Math.sin(time * 4.7) + 1) / 2);
    function drawBoat(x, y, color, power) {
      line(ctx, [[x - 4, y + 27], [x - 8, y + 43]], '#d6ece179', 2);
      line(ctx, [[x + 4, y + 27], [x + 8, y + 43]], '#d6ece179', 2);
      ellipse(ctx, x, y, 8, 27, color);
      ellipse(ctx, x, y - 2, 5, 10, cream);
      circle(ctx, x, y, 4, ink);
      for (const direction of [-1, 1]) {
        const bladeX = x + 26 * direction;
        const bladeY = y - 15 + power * 27;
        line(ctx, [[x + 3 * direction, y], [bladeX, bladeY]], '#784f37', 1.8);
        line(ctx, [[bladeX, bladeY], [bladeX + direction * 6, bladeY + 1]], cream, 4);
      }
    }
  }
  ui.status('游标经过绿色区中央时拉桨。');
  ui.frame(update, draw);
}

const straightLength = 168;
const radius = 60;
const turnLength = Math.PI * radius;
const lapLength = (straightLength + turnLength) * 2;
const laneRadii = [53, 66, 79];
const laneNames = ['内道', '中道', '外道'];

function trackPart(progress) {
  const along = ((progress % 1) + 1) % 1 * lapLength;
  if (along < straightLength) return [0, along / straightLength];
  if (along < straightLength + turnLength) return [1, (along - straightLength) / turnLength];
  if (along < straightLength * 2 + turnLength) return [2, (along - straightLength - turnLength) / straightLength];
  return [3, (along - straightLength * 2 - turnLength) / turnLength];
}

function trackPoint(progress, offset) {
  const [part, fraction] = trackPart(progress);
  const a = (fraction - .5 + (part === 3 ? 1 : 0)) * Math.PI;
  if (part === 0) return [111 + straightLength * fraction, 130 - offset];
  if (part === 1) return [279 + Math.cos(a) * offset, 130 + Math.sin(a) * offset];
  if (part === 2) return [279 - straightLength * fraction, 130 + offset];
  return [111 + Math.cos(a) * offset, 130 + Math.sin(a) * offset];
}

export function cycling(host, api) {
  const ui = stage(host, api, '场地自行车', 390, 260, [['圈', '1 / 5'], ['车速', '32 千米/时'], ['车道', '中道']]);
  const pedal = ui.hold('踩踏', ' ', true);
  const brake = ui.hold('刹车', 'ArrowDown');
  let lane = 1;
  let displayLane = laneRadii[lane];
  let velocity = 9;
  let progress = 0;
  let ghost = 0;
  let time = 0;
  let slipping = 0;
  let onTurn = false;
  const length = 160;
  const pace = ui.meter('车速与过弯限制');
  function moveLane(amount) {
    lane = clamp(lane + amount, 0, 2);
    ui.stat(undefined, undefined, laneNames[lane]);
  }
  ui.button('← 内移', () => moveLane(-1));
  ui.button('外移 →', () => moveLane(1));
  ui.key('ArrowLeft', () => moveLane(-1));
  ui.key('ArrowRight', () => moveLane(1));
  function update(dt) {
    const turn = trackPart(progress)[0] % 2 === 1;
    const limit = [14.7, 18.2, 21.1][lane];
    if (turn !== onTurn) {
      onTurn = turn;
      ui.status(turn ? `进入弯道，${laneNames[lane]}建议低于 ${Math.round(limit * 3.6)} 千米/时。` : '进入直道，可以加速。');
    }
    displayLane += (laneRadii[lane] - displayLane) * (1 - Math.exp(-11 * dt));
    slipping = Math.max(0, slipping - dt);
    const effort = brake() ? -14 : slipping ? -7 : pedal() ? 7.3 - velocity * .22 : -.6 - velocity * .09;
    velocity = clamp(velocity + effort * dt, 6.5, 24);
    if (turn && velocity > limit + .3 && !slipping) {
      velocity *= .76;
      slipping = .85;
      ui.status('入弯打滑，已损失车速。');
    }
    const laneCost = turn ? displayLane / laneRadii[1] : 1;
    const rate = velocity / (length * laneCost);
    time += Math.min(dt, (5 - progress) / rate);
    progress = Math.min(5, progress + dt * rate);
    ghost = Math.min(5, ghost + dt * 15.8 / length);
    ui.stat(`${Math.min(5, Math.floor(progress) + 1)} / 5`, `${Math.round(velocity * 3.6)} 千米/时`, laneNames[lane]);
    pace(velocity / 24, [0, (turn ? limit : 24) / 24], slipping ? '打滑' : turn ? '弯道控速' : '直道加速');
    if (progress === 5) {
      ui.finish(`完成五圈，用时 ${time.toFixed(2)} 秒。`, Math.round(time));
    }
  }
  function draw(ctx) {
    box(ctx, 0, 0, 390, 260, '#e9ead8');
    box(ctx, 24, 43, 342, 174, '#596f59', 87);
    box(ctx, 68, 87, 254, 86, '#b5c6a3', 43);
    for (const r of [60, 73]) {
      const path = Array.from({ length: 113 }, (_, i) => trackPoint(i / 112, r));
      line(ctx, path, '#aebb9d', 1, [3, 5]);
    }
    for (let i = 0; i < 6; i++) {
      box(ctx, 109 + i % 2 * 5, 46 + i * 7, 5, 7, cream);
      box(ctx, 109 + (i % 2 ? 0 : 5), 46 + i * 7, 5, 7, '#384b3e');
    }
    const [gx, gy] = trackPoint(ghost, laneRadii[2]);
    circle(ctx, gx, gy, 5, cream);
    const [x, y] = trackPoint(progress, displayLane);
    const [nx, ny] = trackPoint(progress + .005, displayLane);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(ny - y, nx - x));
    line(ctx, [[-9, 0], [9, 0]], '#283a31', 4);
    ellipse(ctx, -1, 0, 8, 4.5, slipping ? '#d2905e' : '#d8ef9d');
    circle(ctx, 4, 0, 3.8, slipping ? '#a55741' : '#385345');
    ctx.restore();
    lettering(ctx, `${time.toFixed(2)} 秒`, 195, 126, ink, 20);
    lettering(ctx, onTurn ? '弯道' : '直道', 195, 149, '#51674b', 11);
  }
  pace(velocity / 24, [0, 1], '直道加速');
  ui.status('按住踩踏加速，入弯前可松开或刹车。');
  ui.frame(update, draw);
}

const zoneStart = 90;
const goodExchange = [94, 99];

export function relay(host, api) {
  const ui = stage(host, api, '短跑接力', 390, 260, [['当前棒', '1 / 4'], ['总距离', '0 / 400 米'], ['罚时', '0 秒']]);
  const passButton = ui.button('交棒', pass, true);
  const left = ui.button('左脚', () => strike(-1));
  const right = ui.button('右脚', () => strike(1));
  const pace = ui.meter('跑步速度');
  let leg = 0;
  let distance = 0;
  let velocity = 5.8;
  let time = 0;
  let penalty = 0;
  let lastStep = -1;
  let lastFoot = 0;
  let handoff = 0;
  passButton.disabled = true;
  ui.key('ArrowLeft', () => strike(-1));
  ui.key('ArrowRight', () => strike(1));
  ui.key(' ', pass);
  function strike(foot) {
    const gap = time - lastStep;
    const good = foot !== lastFoot && gap >= .115;
    if (good) {
      velocity = Math.min(11.75, velocity + (gap <= .4 ? 1.28 : .82));
      (foot === -1 ? left : right).setAttribute('aria-pressed', 'true');
      (foot === -1 ? right : left).setAttribute('aria-pressed', 'false');
    } else {
      velocity = Math.max(5.6, velocity - .85);
    }
    lastFoot = foot;
    lastStep = time;
  }
  function pass() {
    if (leg >= 3 || distance < zoneStart || handoff) return;
    handoff = distance >= goodExchange[0] && distance <= goodExchange[1] ? .98 : .77;
    passButton.disabled = true;
    ui.status(handoff > .9 ? '交棒顺畅，下一棒保持速度。' : '交棒成功，下一棒会稍微减速。');
  }
  function update(dt) {
    const previous = distance;
    velocity = Math.max(5.6, velocity - 1.4 * dt);
    distance += velocity * dt;
    time += leg === 3 && distance >= 100 ? (100 - previous) / velocity : dt;
    if (leg < 3 && !handoff && previous < zoneStart && distance >= zoneStart) {
      passButton.disabled = false;
      ui.status('已进入接力区，绿色区内交棒可保持速度。');
    }
    if (distance >= 100) {
      if (leg === 3) {
        const result = time + penalty;
        distance = 100;
        ui.stat('4 / 4', '400 / 400 米', `${penalty} 秒`);
        ui.finish(`四棒完成，含罚时 ${result.toFixed(2)} 秒。`, Math.round(result));
        return;
      }
      if (!handoff) {
        penalty += 2;
        ui.status('错过接力区，补交接力棒并加罚 2 秒。');
      } else {
        ui.status(`第 ${leg + 2} 棒，继续交替迈步。`);
      }
      velocity = Math.max(5.6, velocity * (handoff || .59));
      distance -= 100;
      leg++;
      handoff = 0;
      lastFoot = 0;
      passButton.disabled = true;
    }
    ui.stat(`${leg + 1} / 4`, `${Math.floor(leg * 100 + distance)} / 400 米`, `${penalty} 秒`);
    pace(velocity / 11.75);
  }
  const laneX = value => 38 + value * 3.14;
  function draw(ctx) {
    box(ctx, 0, 0, 390, 260, '#e9eddd');
    box(ctx, 16, 70, 358, 142, '#b87760', 10);
    for (const y of [77, 120, 164, 205]) line(ctx, [[21, y], [369, y]], '#e9c6a8', 2);
    box(ctx, laneX(zoneStart), 121, laneX(100) - laneX(zoneStart), 42, '#e7c294');
    box(ctx, laneX(goodExchange[0]), 121, laneX(goodExchange[1]) - laneX(goodExchange[0]), 42, handoff ? '#6c9055' : '#bad193');
    for (let x = 0; x <= 100; x += 20) {
      const point = laneX(x);
      line(ctx, [[point, 205], [point, 216]], '#79896a', 1);
      lettering(ctx, `${x} 米`, point, 229, '#54644c', 10);
    }
    line(ctx, [[laneX(100), 70], [laneX(100), 206]], cream, 2);
    if (leg < 3) drawRunner(laneX(101), 143, '#675d56', .17, handoff && distance >= zoneStart);
    const cadence = Math.sin((time - lastStep) * 14) * (lastFoot || 1);
    drawRunner(laneX(distance), 143, green, cadence, !handoff);
    lettering(ctx, `第 ${leg + 1} 棒`, 65, 30, ink, 13);
    lettering(ctx, `${time.toFixed(2)} 秒`, 318, 30, ink, 13);
    function drawRunner(x, y, color, stride, baton) {
      ellipse(ctx, x, y + 16, 12, 3, '#584b3a55');
      line(ctx, [[x - 4, y + 5], [x - 6 + stride * 6, y + 10], [x - 11 + stride * 10, y + 15]], '#3d4840', 3);
      line(ctx, [[x - 4, y + 5], [x + 4 - stride * 5, y + 9], [x + 9 - stride * 8, y + 15]], '#3d4840', 3);
      line(ctx, [[x - 4, y + 4], [x + 3, y - 7]], color, 7);
      line(ctx, [[x + 2, y - 5], [x + 7, y], [x + 10, y - 4]], color, 2);
      circle(ctx, x + 7, y - 11, 4.6, '#f5d4a6');
      if (baton) line(ctx, [[x + 8, y - 6], [x + 15, y - 8]], '#fff5c6', 2.5);
    }
  }
  pace(velocity / 11.75);
  ui.status('左右脚交替加速，跑进绿色接力区后交棒。');
  ui.frame(update, draw);
}
