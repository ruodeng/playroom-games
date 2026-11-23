import {
  aimControls, box, circle, collideDisks, containDisk, disk, distance, ellipse, guide, hitWall, inside,
  lettering, line, moveDisk, position, speed, stage, substeps, throwDisk,
} from './sports-core.js';

const paper = '#fffdf2';
const ink = '#35472c';
const golfBounds = [22, 20, 368, 300];
const golfHoles = [
  { name: '开球道', par: 2, tee: [195, 260], cup: [195, 65] },
  { name: '左侧绕行', par: 3, tee: [76, 248], cup: [308, 62], walls: [[143, 112, 39, 188]] },
  { name: '沙坑坡', par: 3, tee: [85, 248], cup: [308, 73], sand: [[119, 113, 153, 110]] },
  { name: '溪流窄桥', par: 3, tee: [91, 254], cup: [315, 74], water: [[22, 133, 119, 50], [236, 133, 132, 50]] },
  { name: '双挡板', par: 4, tee: [83, 261], cup: [317, 58], walls: [[22, 173, 236, 17], [133, 97, 235, 17]] },
  { name: '右岸浅滩', par: 3, tee: [316, 261], cup: [71, 60], water: [[169, 68, 71, 143]], sand: [[37, 114, 79, 59]], walls: [[278, 125, 28, 93]] },
  { name: '沙洲夹道', par: 4, tee: [210, 268], cup: [114, 64], walls: [[99, 103, 74, 15], [239, 93, 17, 114]], sand: [[174, 124, 62, 79]], water: [[22, 144, 86, 75]] },
  { name: '湖畔大弯', par: 4, tee: [69, 265], cup: [329, 264], water: [[121, 107, 146, 149]], walls: [[155, 256, 76, 44]], sand: [[252, 53, 84, 40]] },
  { name: '终场岛洞', par: 4, tee: [193, 268], cup: [196, 57], walls: [[22, 161, 108, 22], [261, 161, 107, 22], [173, 112, 45, 15]], water: [[22, 82, 106, 47], [262, 82, 106, 47]], sand: [[146, 185, 98, 31]] },
];

export function golf(host, api) {
  const ui = stage(host, api, '迷你高尔夫', 390, 320, [['球洞', '1 / 9'], ['本洞', '0 杆'], ['总计', '0 杆']]);
  let index = 0;
  let strokes = 0;
  let total = 0;
  let hole = golfHoles[index];
  let ball = disk(...hole.tee, 6);
  let cup = position(hole.cup);
  let moving = false;
  let betweenHoles = 0;
  let previousLie = position(hole.tee);
  const aim = aimControls(ui, () => ball, () => !moving && !betweenHoles, (angle, power) => {
    strokes++;
    previousLie = { x: ball.x, y: ball.y };
    moving = true;
    aim.fireButton.disabled = true;
    throwDisk(ball, angle, 5.4 * power + 24);
    updateStats();
    ui.status('球在滚动。');
  }, 49, '推杆');
  function updateStats() {
    ui.stat(`${index + 1} / 9`, `${strokes} 杆`, `${total + (betweenHoles ? 0 : strokes)} 杆`);
  }
  function nextHole(result) {
    moving = false;
    total += strokes;
    betweenHoles = .8;
    const delta = strokes - hole.par;
    const parText = !delta ? '平标准杆' : `${delta > 0 ? '高' : '低'}于标准杆 ${Math.abs(delta)} 杆`;
    updateStats();
    ui.status(`${hole.name} · ${result}，${strokes} 杆（${parText}）。`);
  }
  function finishStroke(message) {
    moving = false;
    ball.vx = ball.vy = 0;
    if (strokes >= 12) nextHole('达到本洞计分上限');
    else {
      aim.fireButton.disabled = false;
      updateStats();
      ui.status(message);
    }
  }
  function update(dt) {
    if (betweenHoles) {
      betweenHoles = Math.max(0, betweenHoles - dt);
      if (betweenHoles) return;
      if (index === golfHoles.length - 1) {
        betweenHoles = 1;
        ui.finish(`打完九洞，总计 ${total} 杆。`, total);
        return;
      }
      hole = golfHoles[++index];
      cup = position(hole.cup);
      ball = disk(...hole.tee, 6);
      const direction = Math.round(Math.atan2(cup.y - ball.y, cup.x - ball.x) * 180 / Math.PI);
      aim.setAngle(direction);
      strokes = 0;
      aim.fireButton.disabled = false;
      updateStats();
      ui.status(`${hole.name} · 标准 ${hole.par} 杆。`);
    }
    if (!moving) return;
    substeps(dt, step => {
      const inSand = hole.sand?.some(zone => inside(ball, zone));
      moveDisk(ball, step, inSand ? 4 : 1.35);
      containDisk(ball, golfBounds, .76);
      for (const wall of hole.walls || []) hitWall(ball, wall, .76);
      if (hole.water?.some(zone => inside(ball, zone))) {
        strokes = Math.min(12, strokes + 1);
        Object.assign(ball, previousLie);
        finishStroke('落水罚一杆，球已放回原位。');
        return false;
      }
      if (distance(ball, cup) <= 10 && speed(ball) < 132) {
        Object.assign(ball, cup);
        nextHole('进洞');
        return false;
      }
      if (speed(ball) < 5) {
        finishStroke('球已停稳，可以继续推杆。');
        return false;
      }
    });
  }
  function draw(ctx) {
    box(ctx, 0, 0, 390, 320, '#e7edda');
    box(ctx, 19, 17, 352, 286, '#657d50', 5);
    box(ctx, 22, 20, 346, 280, '#99ba76', 3);
    for (let x = 22; x < 368; x += 48) box(ctx, x, 20, Math.min(24, 368 - x), 280, '#a6c484');
    for (const area of hole.sand || []) {
      box(ctx, ...area, '#dfc79a', 5);
      for (let x = area[0] + 9; x < area[0] + area[2] - 6; x += 13) {
        for (let y = area[1] + 9; y < area[1] + area[3] - 6; y += 13) circle(ctx, x, y, 1, '#b99b6d');
      }
    }
    for (const area of hole.water || []) {
      box(ctx, ...area, '#679ea0', 4);
      for (let y = area[1] + 10; y < area[1] + area[3] - 4; y += 10) {
        line(ctx, [[area[0] + 5, y], [area[0] + area[2] - 6, y]], '#a4cac3', 1, [8, 8]);
      }
    }
    for (const wall of hole.walls || []) {
      box(ctx, ...wall, '#536747', 3);
      line(ctx, [[wall[0] + 2, wall[1] + 2], [wall[0] + wall[2] - 2, wall[1] + 2]], '#b8c59a');
    }
    ellipse(ctx, cup.x, cup.y, 25, 19, '#aed08b');
    circle(ctx, cup.x, cup.y, 10, ink);
    line(ctx, [[cup.x, cup.y], [cup.x, cup.y - 28]], '#f6f5d8', 2);
    box(ctx, cup.x + 1, cup.y - 28, 14, 9, '#ae4d36', 2);
    if (!moving && !betweenHoles) guide(ctx, ball, aim.angle, 13 + aim.power * .73);
    if (!betweenHoles || distance(ball, cup) > 10) {
      ellipse(ctx, ball.x + 2, ball.y + 4, 7, 5, '#43563e55');
      circle(ctx, ball.x, ball.y, ball.radius, paper);
    }
    lettering(ctx, `${hole.name} · 标准 ${hole.par} 杆`, 195, 311, ink, 10);
  }
  ui.status(`${hole.name} · 标准 ${hole.par} 杆。`);
  ui.frame(update, draw);
}

const house = { x: 195, y: 85 };
const hack = { x: 195, y: 306 };
const houseRadius = 60;

export function scoreHouse(stones, center = house, radius = houseRadius) {
  const ranked = stones
    .map(stone => ({ team: stone.team, gap: distance(stone, center), radius: stone.radius ?? 0 }))
    .filter(stone => stone.gap <= radius + stone.radius)
    .sort((a, b) => a.gap - b.gap);
  if (!ranked.length) return { player: 0, rival: 0 };
  const closest = ranked[0].team;
  const other = ranked.find(stone => stone.team !== closest);
  const points = ranked.filter(stone => stone.team === closest && (!other || stone.gap < other.gap)).length;
  return { player: closest === 'player' ? points : 0, rival: closest === 'rival' ? points : 0 };
}

export function curling(host, api) {
  const ui = stage(host, api, '冰壶占位', 390, 344, [['局', '1 / 4'], ['本局投壶', '0 / 3'], ['比分', '0 : 0']]);
  let end = 0;
  let thrown = 0;
  let stones = [];
  let moving = null;
  let phase = 'player';
  let pause = 0;
  let player = 0;
  let rival = 0;
  let sweeping = false;
  const colors = { player: '#51753c', rival: '#ae513c' };
  const aim = aimControls(ui, () => hack, () => phase === 'player', (angle, power) => {
    thrown++;
    start('player', angle, 84 + power * 3.7);
    stats();
    ui.status('己方冰壶滑行中。可以擦冰，让它滑得更远。');
  }, 48, '投壶');
  const sweep = ui.button('擦冰', toggleSweep);
  sweep.disabled = true;
  sweep.setAttribute('aria-pressed', 'false');
  ui.key('s', toggleSweep);
  ui.key('S', toggleSweep);
  function stats() {
    ui.stat(`${end + 1} / 4`, `${thrown} / 3`, `${player} : ${rival}`);
  }
  function toggleSweep() {
    if (moving?.team !== 'player' || moving.out) return;
    sweeping = !sweeping;
    sweep.setAttribute('aria-pressed', String(sweeping));
  }
  function start(team, angle, velocity) {
    const stone = { ...disk(hack.x, hack.y, 9), team, out: false };
    throwDisk(stone, angle, velocity);
    stones.push(stone);
    moving = stone;
    phase = 'moving';
    aim.fireButton.disabled = true;
    sweep.disabled = team !== 'player';
  }
  function rivalThrow() {
    const close = stones.filter(stone => stone.team === 'player')
      .reduce((nearest, stone) => distance(stone, house) < distance(nearest, house) ? stone : nearest, hack);
    const knock = distance(close, house) < 35 && thrown !== 1;
    const target = knock ? close : house;
    const lateral = [-20, 29, -27, 14][end] + [8, -7, 3][thrown - 1];
    const x = target.x + (knock ? lateral * .22 : lateral);
    const y = target.y + (knock ? -45 : [15, -3, 13][thrown - 1]);
    const angle = Math.atan2(y - hack.y, x - hack.x);
    start('rival', angle, Math.hypot(x - hack.x, y - hack.y) * 1.2 + 6);
    ui.status('对手投壶中。');
  }
  function endTurn() {
    const team = moving.team;
    moving = null;
    stones = stones.filter(stone => !stone.out && stone.y < 196);
    sweeping = false;
    sweep.disabled = true;
    sweep.setAttribute('aria-pressed', 'false');
    if (team === 'player') {
      phase = 'rival-next';
      pause = .45;
      ui.status('轮到对手。');
    } else if (thrown < 3) {
      phase = 'player';
      aim.fireButton.disabled = false;
      ui.status('轮到你投壶。冰壶需停在圆环内才能参与计分。');
    } else {
      const points = scoreHouse(stones);
      player += points.player;
      rival += points.rival;
      stats();
      phase = 'end';
      pause = .9;
      ui.status(`本局得分，你 ${points.player}，对手 ${points.rival}。`);
    }
  }
  function update(dt) {
    if (pause > 0) {
      pause -= dt;
      if (pause > 0) return;
      if (phase === 'rival-next') rivalThrow();
      else if (end === 3) {
        const result = player === rival ? '平局' : player > rival ? '获胜' : '对手获胜';
        ui.finish(`四局结束，${player} 比 ${rival}，${result}。`, player);
      } else {
        end++;
        thrown = 0;
        stones = [];
        phase = 'player';
        aim.fireButton.disabled = false;
        stats();
        ui.status(`第 ${end + 1} 局开始，轮到你投壶。`);
      }
    }
    if (!moving) return;
    substeps(dt, step => {
      const live = stones.filter(stone => !stone.out);
      for (const stone of live) {
        moveDisk(stone, step, stone === moving && sweeping ? .72 : 1.2);
        if (stone.x < 74 || stone.x > 316 || stone.y < 15 || stone.y > 327) stone.out = true;
      }
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        if (!live[i].out && !live[j].out) collideDisks(live[i], live[j], .92);
      }
      for (const stone of live) if (speed(stone) < 4) stone.vx = stone.vy = 0;
      if (stones.every(stone => stone.out || speed(stone) === 0)) {
        endTurn();
        return false;
      }
    });
  }
  function draw(ctx) {
    box(ctx, 0, 0, 390, 344, '#dce8e8');
    box(ctx, 67, 10, 256, 324, '#aec2be', 9);
    box(ctx, 74, 15, 242, 312, '#f3f8f5', 4);
    line(ctx, [[195, 15], [195, 327]], '#b8ccca', 1, [5, 5]);
    line(ctx, [[74, 196], [316, 196]], '#b86f56', 2);
    lettering(ctx, '有效线', 102, 207, '#79594e', 10);
    circle(ctx, house.x, house.y, houseRadius, '#6e9ea4');
    circle(ctx, house.x, house.y, 45, '#edf4ef');
    circle(ctx, house.x, house.y, 29, '#be806e');
    circle(ctx, house.x, house.y, 12, '#f4efdc');
    ellipse(ctx, hack.x, hack.y + 8, 19, 3, '#acc0b9');
    for (const stone of stones) if (!stone.out) drawStone(stone);
    if (phase === 'player') {
      guide(ctx, hack, aim.angle, 30 + aim.power * 1.25, '#527d7e');
      drawStone({ ...hack, team: 'player' });
    }
    if (sweeping && !moving.out) {
      const x = moving.x + 16;
      const y = moving.y - 11;
      line(ctx, [[x - 2, y + 6], [x + 13, y - 8]], '#7b6044', 3);
      box(ctx, x - 10, y + 4, 12, 5, '#b3a06d', 2);
    }
    function drawStone(stone) {
      ellipse(ctx, stone.x + 2, stone.y + 4, 10, 8, '#82999499');
      circle(ctx, stone.x, stone.y, 9, '#b3c0b8');
      circle(ctx, stone.x, stone.y - 2, 7, colors[stone.team]);
      line(ctx, [[stone.x - 3, stone.y - 2], [stone.x + 3, stone.y - 2]], paper, 2);
    }
  }
  ui.status('轮到你投壶。将冰壶留在圆环内。');
  ui.frame(update, draw);
}

const poolBounds = [26, 26, 394, 236];
const pockets = [[26, 26], [210, 26], [394, 26], [26, 236], [210, 236], [394, 236]].map(position);
const poolColors = ['#e2b852', '#437991', '#ad624d', '#8a67a1', '#eb9346', '#719951'];

export function pool(host, api) {
  const ui = stage(host, api, '落袋台球', 420, 262, [['目标球', '0 / 6'], ['剩余', '12 次'], ['得分', '0']]);
  const cue = { ...disk(100, 131, 8), number: 0, sunk: false };
  const objectBalls = [[304, 104], [239, 56], [288, 199], [336, 172], [138, 181], [184, 76]]
    .map(([x, y], i) => ({ ...disk(x, y, 8), number: i + 1, sunk: false }));
  const balls = [cue, ...objectBalls];
  let used = 0;
  let potted = 0;
  let moving = false;
  let previousPotted = 0;
  const ready = () => !moving && used < 12 && potted < 6;
  const aim = aimControls(ui, () => cue, ready, (angle, power) => {
    previousPotted = potted;
    used++;
    throwDisk(cue, angle, 38 + power * 6.4);
    moving = true;
    aim.fireButton.disabled = true;
    stats();
    ui.status('球在滚动。');
  }, 60, '击球', 0);
  function stats(score = potted * 10) {
    ui.stat(`${potted} / 6`, `${12 - used} 次`, score);
  }
  function respot() {
    for (let y = 49; y <= 217; y += 21) {
      for (let x = 58; x <= 147; x += 21) {
        const mark = { x, y };
        if (objectBalls.every(ball => ball.sunk || distance(mark, ball) > 17)) {
          Object.assign(cue, mark, { sunk: false });
          return;
        }
      }
    }
  }
  function finishShot() {
    const scratch = cue.sunk;
    moving = false;
    if (scratch) {
      used = Math.min(12, used + 1);
      respot();
    }
    const score = potted * 10 + (potted === 6 ? 12 - used : 0);
    stats(score);
    if (potted === 6 || used === 12) {
      ui.finish(`打进 ${potted} 颗目标球，${score} 分。`, score);
      return;
    }
    aim.fireButton.disabled = false;
    ui.status(scratch ? '母球落袋，已复位并扣 1 次机会。' :
      potted > previousPotted ? `打进 ${potted - previousPotted} 颗球。` : '这一杆未进球，可以继续瞄准。');
  }
  function update(dt) {
    if (!moving) return;
    substeps(dt, step => {
      const live = balls.filter(ball => !ball.sunk);
      for (const ball of live) {
        moveDisk(ball, step, 1.12);
        if (pockets.some(pocket => distance(ball, pocket) < 15)) {
          ball.sunk = true;
          ball.vx = ball.vy = 0;
          if (ball.number) potted++;
        } else {
          containDisk(ball, poolBounds, .84);
        }
      }
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        if (!live[i].sunk && !live[j].sunk) collideDisks(live[i], live[j], .94);
      }
      for (const ball of live) if (speed(ball) < 6) ball.vx = ball.vy = 0;
      if (live.every(ball => speed(ball) === 0)) {
        finishShot();
        return false;
      }
    }, 720);
  }
  function draw(ctx) {
    box(ctx, 0, 0, 420, 262, '#e9e5d5');
    box(ctx, 8, 8, 404, 246, '#764e35', 13);
    box(ctx, 18, 18, 384, 226, '#647c50', 8);
    box(ctx, 26, 26, 368, 210, '#4f744a', 5);
    line(ctx, [[106, 29], [106, 233]], '#719268', 1, [3, 7]);
    for (const p of pockets) circle(ctx, p.x, p.y, 15, '#26382e');
    if (ready()) guide(ctx, cue, aim.angle, Math.min(260, (38 + aim.power * 6.4) / 1.12));
    for (const ball of balls) {
      if (ball.sunk) continue;
      ellipse(ctx, ball.x + 2, ball.y + 5, 9, 7, '#1a372666');
      circle(ctx, ball.x, ball.y, ball.radius, ball.number ? poolColors[ball.number - 1] : paper);
      if (ball.number) {
        circle(ctx, ball.x, ball.y, 4.6, paper);
        lettering(ctx, String(ball.number), ball.x, ball.y + .5, ink, 7);
      }
    }
  }
  ui.status('瞄准彩球，调整力度后击球。');
  ui.frame(update, draw);
}
