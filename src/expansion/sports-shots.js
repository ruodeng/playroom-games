import {
  box, circle, clamp, collideDisks, disk, ellipse, lettering, line, moveDisk, radians, speed, stage, substeps,
} from './sports-core.js';

const ink = '#35472c';
const cream = '#fff9e5';
const basket = { x: 322, y: 102 };
const positions = [{ x: 190, y: 188 }, { x: 132, y: 211 }, { x: 73, y: 229 }];
const gravity = 380;
const minSpeed = 174;
const speedRange = 285;

function hoopSpeed(place, angle, x) {
  const dx = x - place.x;
  const height = place.y - basket.y;
  const sideSpeed = Math.sqrt(gravity * dx * dx / (2 * (dx * Math.tan(angle) - height)));
  return sideSpeed / Math.cos(angle);
}

export function basketball(host, api) {
  const ui = stage(host, api, '定点投篮', 390, 286, [['投篮位', '1 / 3'], ['本位投篮', '0 / 4'], ['命中', '0 球']]);
  let angle;
  let degrees;
  let attempt = 0;
  let points = 0;
  let clock = 0;
  let phase = 0;
  let shot = null;
  let place = positions[0];
  const setAngle = ui.slider('出手角度', 57, 72, 63, next => { degrees = next; angle = radians(next); });
  const shootButton = ui.button('投篮', shoot, true);
  const meter = ui.meter('投篮力度');
  ui.key(' ', shoot);
  ui.key('ArrowLeft', () => setAngle(degrees - 1));
  ui.key('ArrowRight', () => setAngle(degrees + 1));
  function shoot() {
    if (shot || attempt >= 12) return;
    const v = minSpeed + phase * speedRange;
    const vx = v * Math.cos(angle);
    const vy = v * Math.sin(angle);
    const discriminant = vy * vy - 2 * gravity * (place.y - basket.y);
    const crossingTime = discriminant >= 0 ? (vy + Math.sqrt(discriminant)) / gravity : Infinity;
    shot = { vx, vy, crossingTime, time: 0, made: false, resolved: false };
    shootButton.disabled = true;
    ui.status('篮球出手。');
  }
  function updateMeter() {
    phase = 1 - Math.abs(clock - 1);
    const target = [basket.x - 10, basket.x + 10].map(x => (hoopSpeed(place, angle, x) - minSpeed) / speedRange);
    meter(phase, target, phase >= target[0] && phase <= target[1] ? '力度合适' : '等待合适力度');
  }
  function update(dt) {
    const factor = [1.04, 1.17, 1.29][Math.floor(Math.min(attempt, 11) / 4)];
    if (!shot) {
      clock = (clock + dt * factor) % 2;
      updateMeter();
      return;
    }
    shot.time += dt;
    if (shot.time >= shot.crossingTime && !shot.resolved) {
      shot.resolved = true;
      shot.made = Math.abs(place.x + shot.vx * shot.crossingTime - basket.x) <= 10;
      if (shot.made) {
        points++;
        ui.stat(undefined, undefined, `${points} 球`);
        ui.status('命中。');
      }
    }
    const x = place.x + shot.vx * shot.time;
    const y = place.y - shot.vy * shot.time + gravity * shot.time ** 2 / 2;
    if ((shot.made && shot.time >= shot.crossingTime + .3) || x >= 400 || y >= 263) {
      const made = shot.made;
      shot = null;
      attempt++;
      const station = Math.min(2, Math.floor(attempt / 4));
      ui.stat(`${station + 1} / 3`, `${attempt - station * 4} / 4`, `${points} 球`);
      if (attempt === 12) {
        ui.finish(`十二次投篮，命中 ${points} 球。`, points);
      } else {
        const moved = place !== positions[station];
        place = positions[station];
        clock = attempt * .41 % 2;
        updateMeter();
        shootButton.disabled = false;
        ui.status(`${made ? '命中' : '未命中'}。${moved ? '已换到下一投篮位。' : '准备下一球。'}`);
      }
    }
  }
  function draw(ctx) {
    box(ctx, 0, 0, 390, 286, '#e9ecdf');
    for (let y = 22; y < 237; y += 28) line(ctx, [[0, y], [390, y]], '#dde4d3');
    box(ctx, 0, 244, 390, 42, '#ccad7d');
    for (let x = 0; x < 390; x += 30) line(ctx, [[x, 245], [x + 6, 286]], '#dcc296');
    line(ctx, [[0, 245], [390, 245]], '#fbebc5', 2);
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      const selected = p === place;
      ellipse(ctx, p.x, 253, 14, 5, selected ? '#547444' : '#ebd8ae');
      lettering(ctx, String(i + 1), p.x, 271, selected ? '#35472c' : '#6b553c', 10);
    }
    box(ctx, 361, 71, 7, 174, '#6a7c5f', 3);
    box(ctx, 341, 58, 12, 58, '#748367', 3);
    box(ctx, 342, 63, 6, 47, '#f7f5df', 2);
    for (let offset = -13; offset <= 13; offset += 6) {
      line(ctx, [[basket.x + offset, basket.y + 1], [basket.x + offset * .65, basket.y + 24]], '#f8f6e7', 1.8);
    }
    line(ctx, [[309, 103], [313, 126], [331, 126], [335, 103]], '#fff9e5', 1.5);
    line(ctx, [[306, 102], [340, 102]], '#a64b34', 3);
    const t = shot?.time || 0;
    const x = shot ? place.x + shot.vx * t : place.x;
    const y = shot ? place.y - shot.vy * t + gravity * t * t / 2 : place.y;
    if (!shot) {
      line(ctx, [[place.x, place.y], [place.x + 39 * Math.cos(angle), place.y - 39 * Math.sin(angle)]], '#58704b', 2, [3, 4]);
      line(ctx, [[place.x - 2, 242], [place.x - 4, place.y + 19]], '#668456', 5);
      circle(ctx, place.x - 9, place.y + 9, 7, '#668456');
    }
    circle(ctx, x, y, 8, '#af5d3c');
    line(ctx, [[x - 7, y], [x + 7, y]], '#713d31');
    line(ctx, [[x, y - 7], [x - 2, y], [x, y + 7]], '#713d31');
  }
  updateMeter();
  ui.status('力度游标进入绿色区时投篮。');
  ui.frame(update, draw);
}

const goal = { left: 65, right: 325, top: 44, bottom: 155 };
const penaltyMark = { x: 195, y: 259 };
const flightTime = .51;

export function penalty(host, api) {
  const ui = stage(host, api, '足球点球', 390, 291, [['已射门', '0 / 10'], ['进球', '0 球'], ['瞄准区域', '中路']]);
  let target = { x: 195, y: 99 };
  let clock = 0;
  let attempts = 0;
  let goals = 0;
  let ball = null;
  const shootButton = ui.button('射门', shoot, true);
  const targetLabel = () => target.y < 77 ? '上角' : target.y > 123 ? '下角' : '中区';
  function aim(next) {
    if (ball || attempts === 10) return;
    target = { x: clamp(next.x, 48, 342), y: clamp(next.y, 33, 168) };
    ui.stat(undefined, undefined, `${target.x < 153 ? '左' : target.x > 237 ? '右' : '中'}${targetLabel()}`);
  }
  ui.pointer(aim);
  ui.key('ArrowLeft', () => aim({ ...target, x: target.x - 12 }));
  ui.key('ArrowRight', () => aim({ ...target, x: target.x + 12 }));
  ui.key('ArrowUp', () => aim({ ...target, y: target.y - 8 }));
  ui.key('ArrowDown', () => aim({ ...target, y: target.y + 8 }));
  ui.key(' ', shoot);
  const keeperX = () => 195 + 84 * Math.sin(clock * (2.7 + attempts * .12) + attempts * 1.47);
  function shoot() {
    if (ball || attempts === 10) return;
    const x = keeperX();
    const jumpX = clamp(target.x - x, -63, 63);
    const jumpY = clamp(target.y - 107, -30, 20);
    ball = { time: 0, startX: x, jumpX, jumpY, result: '' };
    shootButton.disabled = true;
    ui.status('球飞向球门。');
  }
  function keeper() {
    if (!ball) return { x: keeperX(), y: 107, dive: 0 };
    const fraction = clamp((ball.time - .13) / (flightTime - .13), 0, 1);
    return { x: ball.startX + ball.jumpX * fraction, y: 107 + ball.jumpY * fraction, dive: ball.jumpX * fraction / 63 };
  }
  function update(dt) {
    if (!ball) {
      clock += dt;
      return;
    }
    ball.time += dt;
    if (ball.time >= flightTime && !ball.result) {
      const k = keeper();
      const onTarget = target.x >= goal.left + 5 && target.x <= goal.right - 5 &&
        target.y >= goal.top + 5 && target.y <= goal.bottom - 5;
      const covered = ((target.x - k.x) / (23 + Math.abs(k.dive) * 12)) ** 2 + ((target.y - k.y) / 28) ** 2 <= 1;
      ball.result = !onTarget ? '偏出球门' : covered ? '门将扑出' : '进球';
      attempts++;
      if (ball.result === '进球') goals++;
      ui.stat(`${attempts} / 10`, `${goals} 球`);
      ui.status(`${ball.result}。`);
    }
    if (ball.time >= flightTime + .55) {
      ball = null;
      if (attempts === 10) {
        ui.finish(`十轮点球，打进 ${goals} 球。`, goals);
      } else {
        shootButton.disabled = false;
      }
    }
  }
  function draw(ctx) {
    box(ctx, 0, 0, 390, 291, '#83a56e');
    for (let y = 0; y < 291; y += 52) box(ctx, 0, y, 390, 25, '#91ae78');
    box(ctx, goal.left, goal.top, goal.right - goal.left, goal.bottom - goal.top, '#586d55');
    for (let x = goal.left + 12; x < goal.right; x += 15) line(ctx, [[x, goal.top + 5], [x, goal.bottom]], '#a5b497');
    for (let y = goal.top + 10; y < goal.bottom; y += 12) line(ctx, [[goal.left, y], [goal.right, y]], '#a5b497');
    line(ctx, [[goal.left, goal.bottom], [goal.left, goal.top], [goal.right, goal.top], [goal.right, goal.bottom]], cream, 5);
    line(ctx, [[49, 155], [14, 218], [376, 218], [341, 155]], '#e6efce', 2);
    line(ctx, [[117, 155], [93, 180], [297, 180], [273, 155]], '#e6efce', 2);
    line(ctx, [[0, 155], [390, 155]], '#e6efce', 2);
    const k = keeper();
    ellipse(ctx, k.x, 151, 21, 4, '#3d514a66');
    ctx.save();
    ctx.translate(k.x, k.y);
    ctx.rotate(k.dive * -1.04);
    line(ctx, [[-20, -4], [0, 3], [20, -4]], '#d7ad61', 8);
    box(ctx, -9, -6, 18, 24, '#ba853a', 5);
    circle(ctx, 0, -16, 7, '#ead1ac');
    line(ctx, [[-5, 13], [-10, 31]], '#324334', 6);
    line(ctx, [[5, 13], [10, 31]], '#324334', 6);
    circle(ctx, -21, -4, 4, cream);
    circle(ctx, 21, -4, 4, cream);
    ctx.restore();
    if (!ball) {
      circle(ctx, target.x, target.y, 8, '#3a533a');
      circle(ctx, target.x, target.y, 6, cream);
      line(ctx, [[target.x - 10, target.y], [target.x + 10, target.y]], '#3a533a');
      line(ctx, [[target.x, target.y - 10], [target.x, target.y + 10]], '#3a533a');
    }
    let t = ball ? clamp(ball.time / flightTime, 0, 1) : 0;
    let x = penaltyMark.x + (target.x - penaltyMark.x) * t;
    let y = penaltyMark.y + (target.y - penaltyMark.y) * t - Math.sin(t * Math.PI) * 13;
    if (ball?.result === '门将扑出') {
      t = clamp((ball.time - flightTime) / .55, 0, 1);
      x += (target.x < k.x ? -1 : 1) * t * 42;
      y += t * 51;
    }
    ellipse(ctx, x + 2, y + 8, 10, 3, '#35473066');
    circle(ctx, x, y, 9, cream);
    circle(ctx, x + 1, y - 1, 3, '#485444');
    circle(ctx, x - 5, y + 3, 1.6, '#485444');
    circle(ctx, x + 5, y + 4, 1.6, '#485444');
  }
  ui.status('点击球门或用方向键瞄准，避开门将后射门。');
  ui.frame(update, draw);
}

export function scoreBowling(frames) {
  let total = 0;
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    if (i === 9) {
      total += frame.reduce((sum, roll) => sum + roll, 0);
      break;
    }
    if (!frame.length) break;
    const next = frames.slice(i + 1).flat();
    if (frame[0] === 10) {
      if (next.length < 2) break;
      total += 10 + next[0] + next[1];
    } else if (frame.length === 2 && frame[0] + frame[1] === 10) {
      if (!next.length) break;
      total += 10 + next[0];
    } else if (frame.length === 2) {
      total += frame[0] + frame[1];
    }
  }
  return total;
}

function pinRack() {
  const pins = [];
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i <= row; i++) {
      const x = 195 + (i - row / 2) * 21;
      const y = 116 - row * 15;
      pins.push({ ...disk(x, y, 7), homeX: x, homeY: y, standing: true });
    }
  }
  return pins;
}

export function bowling(host, api) {
  const ui = stage(host, api, '弧线保龄球', 390, 308, [['格', '1 / 10'], ['当前倒瓶', '0 / 10'], ['已计分', '0 分']]);
  const frames = [[]];
  let index = 0;
  let pins = pinRack();
  let offset;
  let hook;
  let ball = null;
  const setX = ui.slider('站位', -76, 76, 0, next => { offset = next; });
  const setHook = ui.slider('旋转', -100, 100, 25, next => { hook = next; });
  const rollButton = ui.button('滚球', launch, true);
  ui.key(' ', launch);
  ui.key('ArrowLeft', () => setX(offset - 4));
  ui.key('ArrowRight', () => setX(offset + 4));
  ui.key('ArrowUp', () => setHook(hook + 5));
  ui.key('ArrowDown', () => setHook(hook - 5));
  function launch() {
    if (ball || index >= 10) return;
    ball = { ...disk(195 + offset, 277, 10), from: 195 + offset, hook: hook * .95, time: 0, struck: false, gutter: false, active: true };
    rollButton.disabled = true;
    ui.status('球向瓶阵滚动。');
  }
  function landed() {
    const fallen = pins.filter(pin => !pin.standing && !pin.removed).length;
    const gutter = ball.gutter;
    const rolls = frames[index];
    rolls.push(fallen);
    ball = null;
    let reset = false;
    let completed = false;
    let result = fallen === 10 ? '全倒' : gutter ? '球落入边沟' : `击倒 ${fallen} 瓶`;
    if (index < 9) {
      completed = rolls[0] === 10 || rolls.length === 2;
      reset = completed;
    } else {
      const [first, second] = rolls;
      completed = rolls.length === 3 || (rolls.length === 2 && first !== 10 && first + second < 10);
      reset = !completed && (fallen === 10 || (rolls.length === 2 && first + second === 10));
    }
    if (rolls.length === 2 && rolls[0] !== 10 && rolls[0] + rolls[1] === 10) result = '补中';
    const score = scoreBowling(frames);
    ui.stat(undefined, `${fallen} / 10`, `${score} 分`);
    if (index === 9 && completed) {
      index++;
      ui.finish(`十格结束，总分 ${score} 分。`, score);
      return;
    }
    if (completed) {
      index++;
      frames.push([]);
      ui.stat(`${index + 1} / 10`);
    }
    if (reset) pins = pinRack();
    else for (const pin of pins) {
      if (!pin.standing) pin.removed = true;
      else Object.assign(pin, { x: pin.homeX, y: pin.homeY, vx: 0, vy: 0 });
    }
    rollButton.disabled = false;
    ui.status(`${result}。${completed ? '进入下一格。' : '准备下一球。'}`);
  }
  function update(dt) {
    if (!ball) return;
    substeps(dt, step => {
      ball.time += step;
      if (!ball.struck && !ball.gutter) {
        const t = ball.time / .66;
        ball.x = ball.from + ball.hook * t * t;
        ball.y = 277 - ball.time * 244;
        ball.vx = 2 * ball.hook * t / .66;
        ball.vy = -244;
        if (ball.x < 111 || ball.x > 279) {
          ball.gutter = true;
          ball.x = ball.x < 111 ? 104 : 286;
        }
      } else if (ball.gutter) {
        ball.y -= step * 228;
      } else if (ball.active) {
        moveDisk(ball, step, 1.05);
      }
      if (ball.y < 52 || ball.x < 97 || ball.x > 293) ball.active = false;
      if (ball.active && !ball.gutter) for (const pin of pins) {
        if (pin.removed || Math.hypot(ball.x - pin.x, ball.y - pin.y) >= ball.radius + pin.radius) continue;
        ball.struck = true;
        collideDisks(ball, pin, .52);
      }
      for (const pin of pins) {
        if (pin.removed) continue;
        if (pin.standing && (speed(pin) > 18 || pin.x < 121 || pin.x > 269 || pin.y < 53)) {
          pin.standing = false;
          pin.radius = 10;
        }
        moveDisk(pin, step, pin.standing ? 2.1 : 1.55);
      }
      for (let i = 0; i < pins.length; i++) for (let j = i + 1; j < pins.length; j++) {
        if (!pins[i].removed && !pins[j].removed) collideDisks(pins[i], pins[j], .78);
      }
      if (ball.time > 2.15 || (!ball.active && pins.every(pin => pin.removed || speed(pin) < 12))) {
        landed();
        return false;
      }
    });
  }
  function symbols(rolls) {
    return rolls.map((roll, i) => {
      const spare = (i === 1 && rolls[0] !== 10 && rolls[0] + roll === 10) ||
        (i === 2 && rolls[0] === 10 && rolls[1] !== 10 && rolls[1] + roll === 10);
      return spare ? '/' : roll === 10 ? 'X' : roll === 0 ? '–' : String(roll);
    }).join(' ');
  }
  function draw(ctx) {
    box(ctx, 0, 0, 390, 308, '#e8e8d8');
    for (let i = 0; i < 10; i++) {
      const x = 10 + i * 37;
      box(ctx, x, 8, 34, 35, i === index ? '#c2d59e' : '#f6f5e7', 4);
      lettering(ctx, String(i + 1), x + 17, 17, '#627154', 9);
      lettering(ctx, symbols(frames[i] || []), x + 17, 32, ink, 10);
    }
    box(ctx, 96, 48, 198, 252, '#667158', 5);
    box(ctx, 110, 48, 170, 251, '#d5b484');
    for (let x = 118; x < 280; x += 12) line(ctx, [[x, 50], [x, 299]], '#ddc098');
    line(ctx, [[110, 255], [280, 255]], '#a77252', 2);
    for (let x = 135; x < 280; x += 20) {
      circle(ctx, x, 217, 2, '#a27851');
      if (!ball) circle(ctx, x, 271, 1.6, '#a27851');
    }
    for (const pin of pins) {
      if (pin.removed) continue;
      ellipse(ctx, pin.x + 2, pin.y + 4, 7, 4, '#86674266');
      if (pin.standing) circle(ctx, pin.x, pin.y, pin.radius, '#fcf7e2');
      else ellipse(ctx, pin.x, pin.y, pin.radius, 4, '#c19069');
      line(ctx, [[pin.x - 5, pin.y - 2], [pin.x + 5, pin.y - 2]], '#a44935', 2);
    }
    if (!ball) {
      const points = Array.from({ length: 11 }, (_, i) => {
        const t = i / 10;
        return [195 + offset + hook * .95 * t * t, 277 - 159 * t];
      }).filter(([x]) => x >= 111 && x <= 279);
      if (points.length > 1) line(ctx, points, '#745e46', 2, [4, 5]);
    }
    if (!ball || ball.active) {
      const x = ball?.x ?? (195 + offset);
      const y = ball?.y ?? 277;
      circle(ctx, x, y, 10, '#526746');
      circle(ctx, x - 2, y - 3, 1.4, '#e0e5c8');
      circle(ctx, x + 3, y - 2, 1.4, '#e0e5c8');
      circle(ctx, x, y + 2, 1.4, '#e0e5c8');
    }
  }
  ui.status('调节站位和旋转，用弧线击中球瓶。');
  ui.frame(update, draw);
}
