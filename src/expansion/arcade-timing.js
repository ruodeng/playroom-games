import { WIDTH, TAU, circle, clamp, line, nearestPoint, pill, polygon, screen, star, text } from './arcade-view.js';

const toySpecies = [
  { name: '星星', shape: 'star', color: '#fac36c', value: 110 },
  { name: '兔子', shape: 'rabbit', color: '#c191bc', value: 75 },
  { name: '团子', shape: 'round', color: '#abd6bd', value: 45 },
  { name: '石块', shape: 'stone', color: '#818090', value: -35 },
];
const modulo = (value, period) => (value % period + period) % period;

export function toyClaw(host, api) {
  const height = 361, top = 69, bottom = 273, period = 398;
  const view = screen(host, api, '抓娃娃', height, '#6b4e68');
  const { ctx, canvas } = view;
  const left = view.hold('向左', ['arrowleft', 'a']);
  const right = view.hold('向右', ['arrowright', 'd']);
  const slots = Array.from({ length: 8 }, (_, index) => ({
    base: index * period / 8, type: toySpecies[(index + Math.floor(api.random() * 2)) % toySpecies.length],
  }));
  let x = 180, depth = top, coins = 6, time = 0, score = 0, state = 'ready', caught, feedAt = 0;
  const xAt = slot => modulo(slot.base + time * 38, period) - 19;
  function drop() {
    if (state !== 'ready' || coins <= 0) return;
    coins--;
    state = 'down';
    dropButton.disabled = true;
    view.say('爪子正在下降');
  }
  const dropButton = view.button('下爪', drop);
  view.keys([' '], drop);
  view.on(canvas, 'pointerdown', event => {
    if (event.button !== 0 || state !== 'ready') return;
    x = clamp(view.point(event).x, 32, 328);
    view.say('位置已选定，准备下爪');
  });
  function update(delta) {
    time = api.elapsed();
    if (state === 'ready') {
      x = clamp(x + (Number(right()) - Number(left())) * 164 * delta, 32, 328);
      return;
    }
    if (state === 'down') {
      depth = Math.min(bottom, depth + delta * 263);
      if (depth < bottom) return;
      let best = 19;
      for (const slot of slots) {
        if (!slot.type) continue;
        const distance = Math.abs(xAt(slot) - x);
        if (distance < best) { caught = slot; best = distance; }
      }
      state = 'up';
      return;
    }
    if (state === 'up') {
      depth = Math.max(top, depth - delta * (caught ? 222 : 305));
      if (depth > top) return;
      if (caught) {
        const { name, value } = caught.type;
        score = Math.max(0, score + value);
        caught.type = null;
        view.say(value >= 0 ? `抓到${name}，加 ${value} 分` : `抓到${name}，扣 ${-value} 分`);
        caught = undefined;
      } else view.say('这次抓空了');
      if (!coins) { view.end('六枚代币已用完。', score); return; }
      feedAt = time + .45;
      state = 'feed';
      return;
    }
    if (time >= feedAt) {
      for (const slot of slots) if (!slot.type) slot.type = toySpecies[Math.floor(api.random() * toySpecies.length)];
      state = 'ready';
      dropButton.disabled = false;
    }
  }
  function drawToy(type, px, py) {
    const { shape, color } = type;
    if (shape === 'stone') {
      polygon(ctx, [[px - 13, py], [px - 9, py - 8], [px + 6, py - 11], [px + 14, py + 1], [px + 8, py + 10], [px - 9, py + 8]], color, '#49394e');
      line(ctx, px - 3, py - 5, px + 4, py + 1, '#5c5263', 2);
      return;
    }
    if (shape === 'star') star(ctx, px, py, 17, 9, color);
    else {
      if (shape === 'rabbit') {
        pill(ctx, px - 10, py - 23, 7, 17, 3, color);
        pill(ctx, px + 3, py - 23, 7, 17, 3, color);
      }
      circle(ctx, px, py, 13, color, '#49394e');
    }
    circle(ctx, px - 4, py - 2, 1.7, '#352e3e');
    circle(ctx, px + 4, py - 2, 1.7, '#352e3e');
    line(ctx, px - 1, py + 4, px + 2, py + 4, '#352e3e', 1.4);
  }
  function draw() {
    view.clear();
    pill(ctx, 11, 17, 338, 324, 16, '#523d58');
    pill(ctx, 20, 43, 320, 257, 10, '#765770');
    pill(ctx, 17, 25, 326, 26, 8, '#ad7b96');
    text(ctx, '玩偶橱窗', 180, 37, 13);
    for (const offset of [0, 44, 88, 132]) line(ctx, 57 + offset, 92, 39 + offset, 153, '#a3769055', 5);
    pill(ctx, 15, 302, 330, 19, 6, '#d49b93');
    for (let i = 0; i < 17; i++) circle(ctx, 14 + modulo(i * 20 + time * 38, 332), 311, 2.2, '#925b74');
    for (const slot of slots) if (slot.type && slot !== caught) drawToy(slot.type, xAt(slot), 287);
    if (caught) drawToy(caught.type, x, depth + 14);
    line(ctx, x, 51, x, depth - 5, '#f2e5c5', 3);
    pill(ctx, x - 9, depth - 8, 18, 13, 4, '#f6c17d');
    const spread = state === 'down' || state === 'ready' ? 12 : 7;
    for (const side of [-1, 1]) {
      line(ctx, x + 6 * side, depth + 2, x + spread * side, depth + 10, '#f4d2a2', 3);
      line(ctx, x + spread * side, depth + 10, x + (spread - 4) * side, depth + 16, '#f4d2a2', 3);
    }
    for (const [index, type] of toySpecies.entries()) text(ctx, `${type.name} ${type.value}`, 53 + index * 84, 331, 10, type.color);
    view.readout(`得分 ${score}　·　剩余代币 ${coins}/6`);
  }
  view.say('根据传送带速度，预先对准玩偶');
  view.run(update, draw);
}

const minerals = [
  { name: '大金块', color: '#edb74f', value: 100, radius: 20, speed: 92 },
  { name: '小金块', color: '#f5d477', value: 45, radius: 13, speed: 168 },
  { name: '宝石', color: '#8ddcdd', value: 160, radius: 11, speed: 227 },
  { name: '石头', color: '#aa8b85', value: 0, radius: 19, speed: 83 },
];

export function goldMine(host, api) {
  const height = 392, origin = { x: 180, y: 56 }, limit = 359;
  const view = screen(host, api, '矿井抓金', height, '#433137');
  const { ctx, canvas } = view;
  const seams = [
    [88, 123, 1], [162, 133, 3], [258, 132, 1], [311, 164, 2],
    [57, 204, 0], [124, 206, 2], [222, 203, 0], [284, 228, 3],
    [79, 294, 3], [149, 275, 0], [195, 324, 2], [257, 298, 1], [304, 328, 0], [116, 347, 1],
  ].map(([x, y, type]) => ({ ...minerals[type], x: x + api.random() * 18 - 9, y: y + api.random() * 14 - 7 }));
  let time = 0, angle = 0, length = 16, phase = 'swing', hooked, score = 0;
  const direction = distance => ({ x: origin.x + Math.sin(angle) * distance, y: origin.y + Math.cos(angle) * distance });
  const finish = message => view.end(`${message}。`, score);
  function launch() {
    if (phase !== 'swing') return;
    phase = 'send';
    launchButton.disabled = true;
    view.say('钩子已放出');
  }
  const launchButton = view.button('放钩', launch);
  view.keys([' '], launch);
  view.on(canvas, 'click', launch);
  function update(delta) {
    time = api.elapsed();
    if (time >= 60) { finish('矿井闭工'); return; }
    if (phase === 'swing') { angle = Math.sin(time * 1.9) * 1.24; return; }
    if (phase === 'send') {
      const before = direction(length);
      length = Math.min(limit, length + delta * 376);
      const after = direction(length);
      let firstDistance = Infinity;
      for (const ore of seams) {
        const hit = nearestPoint(ore.x, ore.y, before.x, before.y, after.x, after.y);
        if (Math.hypot(ore.x - hit.x, ore.y - hit.y) >= ore.radius + 5) continue;
        const distance = Math.hypot(hit.x - before.x, hit.y - before.y);
        if (distance < firstDistance) { hooked = ore; firstDistance = distance; }
      }
      if (hooked || length >= limit || after.x < 7 || after.x > WIDTH - 7 || after.y > height - 5) phase = 'return';
      return;
    }
    length = Math.max(16, length - delta * (hooked?.speed ?? 285));
    if (length > 16) return;
    if (hooked) {
      score += hooked.value;
      view.say(`拉起${hooked.name}，收获 ${hooked.value} 分`);
      seams.splice(seams.indexOf(hooked), 1);
      hooked = undefined;
      if (!seams.length) { finish('矿脉已采完'); return; }
    } else view.say('钩子空手回来');
    phase = 'swing';
    launchButton.disabled = false;
  }
  function drawOre(item, x, y) {
    const r = item.radius;
    polygon(ctx, [[x - r, y + r * .33], [x - .67 * r, y - .69 * r], [x + .11 * r, y - .94 * r],
      [x + r * .82, y - r * .38], [x + r, y + r * .39], [x + r * .3, y + r * .82], [x - r * .45, y + r * .75]], item.color, '#47333b');
    polygon(ctx, [[x - r * .59, y - r * .52], [x + r * .13, y - r * .78], [x + r * .44, y - r * .3], [x - r * .21, y + r * .22]], '#fff4d674');
    if (item.value) text(ctx, item.value, x, y + r * .19, 9, '#503744');
  }
  function draw() {
    view.clear();
    for (let i = 0; i < 4; i++) {
      const y = 74 + i * 86;
      polygon(ctx, [[0, y], [90, y + 18], [160, y + 7], [235, y + 19], [310, y + 4], [360, y + 10], [360, height], [0, height]], ['#644650', '#75524e', '#654647', '#593f49'][i]);
    }
    for (let i = 0; i < 30; i++) {
      const x = (i * 67 + 13) % 356, y = 100 + (i * 61) % 287;
      line(ctx, x, y, x + 7 + i % 6, y + 2, '#c199886b', 1.6);
    }
    pill(ctx, 144, 25, 72, 28, 5, '#b8815f');
    circle(ctx, 180, 47, 13, '#eead73', '#482f39', 2);
    circle(ctx, 180, 47, 4, '#824e46');
    if (phase === 'swing') {
      const guide = direction(125);
      ctx.setLineDash([4, 6]);
      line(ctx, origin.x, origin.y, guide.x, guide.y, '#eedab175', 1.5);
      ctx.setLineDash([]);
    }
    for (const ore of seams) if (ore !== hooked) drawOre(ore, ore.x, ore.y);
    const tip = direction(length);
    line(ctx, origin.x, origin.y, tip.x, tip.y, '#efc399', 2.5);
    if (hooked) drawOre(hooked, tip.x, tip.y + hooked.radius * .45);
    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate(-angle);
    line(ctx, -7, -3, -6, 5, '#fff2d7', 3);
    line(ctx, -6, 5, 0, 9, '#fff2d7', 3);
    line(ctx, 0, 9, 7, 4, '#fff2d7', 3);
    ctx.restore();
    view.readout(`得分 ${score}　·　${Math.max(0, 60 - Math.floor(time))} 秒`);
  }
  view.say('等钩子转向矿石再放出');
  view.run(update, draw);
}

const chart = [
  [0, 1, 2, 3, 2, 1, 0, 3], [1, 2, 1, 3, 0, 2, 3, 0],
  [0, 2, 1, 3, 0, 1, 3, 2], [2, 3, 1, 2, 0, 1, 3, 0],
  [1, 3, 0, 2, 1, 0, 3, 2], [3, 2, 1, 0, 2, 1, 3, 0],
];
const beatSeconds = .48;
const beatLead = 1.42;

export function beatKeys(host, api) {
  const height = 383, hitY = 313, laneWidth = 85;
  const view = screen(host, api, '节拍落键', height, '#241e39');
  const { ctx, canvas } = view;
  const colors = ['#87c9bb', '#9daee4', '#e5a4bd', '#edbf81'];
  const keys = ['D', 'F', 'J', 'K'];
  const freqs = [261.63, 329.63, 392, 523.25];
  const notes = chart.flatMap((bar, index) => bar.flatMap((lane, i) => {
    const time = 2 + (8 * index + i) * beatSeconds;
    const main = { lane, time };
    return index > 0 && (i === 1 || i === 5) ? [main, { lane: (lane + 2) % 4, time: time + beatSeconds / 2 }] : [main];
  }));
  const noteTimes = notes.at(-1).time;
  const flash = Array(4).fill(0);
  let score = 0, combo = 0, missed = 0, time = 0, nextSound = 0, audio, enabled = true;
  function makeAudio() {
    const AudioContext = host.ownerDocument.defaultView?.AudioContext;
    if (audio || !AudioContext) return;
    try { audio = new AudioContext(); } catch { enabled = false; }
  }
  makeAudio();
  api.signal.addEventListener('abort', () => { if (audio && audio.state !== 'closed') audio.close().catch(() => {}); }, { once: true });
  function tone(lane) {
    if (!enabled || !audio || audio.state !== 'running') return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = audio.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.value = freqs[lane];
    gain.gain.setValueAtTime(.075, start);
    gain.gain.exponentialRampToValueAtTime(.001, start + .12);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + .13);
  }
  function strike(lane) {
    if (enabled && audio?.state === 'suspended') audio.resume().catch(() => {});
    time = api.elapsed();
    const candidates = notes.filter(item => item.lane === lane && !item.result && Math.abs(time - item.time) <= .18);
    candidates.sort((a, b) => Math.abs(time - a.time) - Math.abs(time - b.time));
    const note = candidates[0];
    flash[lane] = time + .15;
    if (!note) { combo = 0; view.say('击空，连击中断'); return; }
    note.result = 'hit';
    combo++;
    const perfect = Math.abs(time - note.time) <= .08;
    score += (perfect ? 100 : 60) + Math.min((combo - 1) * 5, 95);
    view.say(`${perfect ? '精准' : '命中'} · ${combo} 连击`);
  }
  keys.forEach((key, lane) => {
    const action = () => strike(lane);
    const button = view.button(key, action);
    button.style.borderBottom = `4px solid ${colors[lane]}`;
    button.setAttribute('aria-label', `轨道 ${lane + 1}，${key} 键`);
    view.keys([key.toLowerCase(), String(lane + 1)], action);
  });
  const audioButton = view.button('声音', () => {
    enabled = !enabled;
    if (enabled && audio?.state === 'suspended') audio.resume().catch(() => {});
    audioButton.setAttribute('aria-pressed', String(enabled));
  });
  audioButton.setAttribute('aria-pressed', String(enabled));
  audioButton.disabled = !audio;
  view.on(canvas, 'pointerdown', event => {
    if (event.button !== 0) return;
    const lane = Math.floor((view.point(event).x - 10) / laneWidth);
    if (lane >= 0 && lane < 4) strike(lane);
  });
  function update() {
    time = api.elapsed();
    while (nextSound < notes.length && notes[nextSound].time <= time) {
      if (time - notes[nextSound].time < .1) tone(notes[nextSound].lane);
      nextSound++;
    }
    for (const note of notes) {
      if (!note.result && time - note.time > .18) {
        note.result = 'miss';
        missed++;
        combo = 0;
        view.say(`漏掉音符 · ${missed} 次`);
      }
    }
    if (time > noteTimes + .6) view.end(`乐曲结束，漏键 ${missed} 次。`, score);
  }
  function draw() {
    view.clear();
    for (let lane = 0; lane < 4; lane++) {
      const x = 10 + lane * laneWidth;
      pill(ctx, x, 13, laneWidth - 3, 352, 9, '#37314c');
      pill(ctx, x + 7, hitY - 12, laneWidth - 17, 24, 5, flash[lane] > time ? colors[lane] : '#5e5270');
      text(ctx, keys[lane], x + 41, 348, 17, colors[lane]);
    }
    for (const note of notes) {
      const lead = note.time - time;
      if (note.result || lead > beatLead || lead < -.19) continue;
      const x = 10 + note.lane * laneWidth + 12;
      const y = hitY - lead / beatLead * 287;
      pill(ctx, x, y - 8, 58, 16, 5, colors[note.lane]);
      line(ctx, x + 12, y - 2, x + 46, y - 2, '#ffffff80', 2);
    }
    line(ctx, 12, hitY, WIDTH - 12, hitY, '#fdf1dc', 1.5);
    view.readout(`得分 ${score}　·　连击 ${combo}　·　漏键 ${missed}`);
  }
  view.say('音符到白线时按下对应键');
  view.run(update, draw);
}

const pegLayout = [
  [-.48, 113, 45], [0, 107, 40], [.49, 121, 45],
  [-.44, 177, 70], [-.02, 170, 65], [.43, 185, 75],
  [-.39, 247, 100], [0, 260, 120], [.35, 248, 105],
];

export function streetRings(host, api) {
  const height = 397, origin = { x: 180, y: 326 };
  const view = screen(host, api, '街头套圈', height, '#995e57');
  const { ctx, canvas } = view;
  const left = view.hold('向左', ['arrowleft', 'a']);
  const right = view.hold('向右', ['arrowright', 'd']);
  const at = (distance, angle) => ({ x: origin.x + Math.sin(angle) * distance, y: origin.y - Math.cos(angle) * distance * .88 });
  const pegs = pegLayout.map(([angle, distance, value]) => ({ ...at(distance, angle), distance, value, caught: false }));
  let time = 0, angle = 0, rings = 8, score = 0, shot;
  const strength = () => (1 + Math.sin(time * 3.4 - Math.PI / 2)) / 2;
  const reach = () => 77 + strength() * 202;
  function release() {
    if (shot || !rings) return;
    rings--;
    shot = { ...at(reach(), angle), start: time };
    toss.disabled = true;
    view.say('圈已抛出');
  }
  const toss = view.button('投圈', release);
  view.keys([' '], release);
  view.on(canvas, 'pointerdown', event => {
    if (event.button !== 0 || shot) return;
    const point = view.point(event);
    if (point.y < origin.y - 12) angle = clamp(Math.atan2(point.x - origin.x, (origin.y - point.y) / .88), -.69, .69);
  });
  function update(delta) {
    time = api.elapsed();
    angle = clamp(angle + (Number(right()) - Number(left())) * 1.24 * delta, -.69, .69);
    if (!shot || time - shot.start < .69) return;
    const available = pegs.filter(peg => !peg.caught && Math.hypot(peg.x - shot.x, peg.y - shot.y) < (peg.distance > 230 ? 16 : 18));
    available.sort((a, b) => Math.hypot(a.x - shot.x, a.y - shot.y) - Math.hypot(b.x - shot.x, b.y - shot.y));
    const peg = available[0];
    if (peg) {
      peg.caught = true;
      score += peg.value;
      view.say(`套中了，加 ${peg.value} 分`);
    } else view.say('圈落在奖柱旁边');
    shot = undefined;
    if (!rings) { view.end('八个圈已投完。', score); return; }
    toss.disabled = false;
  }
  function ellipse(x, y, rx, ry, stroke, width = 2) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  function draw() {
    view.clear();
    for (let i = 0; i < 9; i++) polygon(ctx, [[i * 40, 0], [i * 40 + 40, 0], [i * 40 + 34, 47], [i * 40 + 5, 47]], i % 2 ? '#efc58c' : '#c57764');
    pill(ctx, 12, 62, 336, 267, 12, '#c38975');
    for (let i = 0; i < 12; i++) line(ctx, 14, 85 + i * 21, 348, 85 + i * 21, '#a86f63', 1.2);
    for (const peg of [...pegs].sort((a, b) => a.y - b.y)) {
      const color = peg.caught ? '#f2dfa8' : peg.value >= 100 ? '#e9bf79' : '#eee0bc';
      ellipse(peg.x, peg.y, 16, 7, peg.caught ? '#fff6a0' : '#9a695e', peg.caught ? 4 : 1.4);
      line(ctx, peg.x, peg.y, peg.x, peg.y - 20, color, 6);
      circle(ctx, peg.x, peg.y - 21, 5, color);
      text(ctx, peg.caught ? '✓' : peg.value, peg.x, peg.y + 15, 10, '#4e3639');
    }
    if (!shot) {
      const target = at(reach(), angle);
      ctx.setLineDash([5, 6]);
      line(ctx, origin.x, origin.y, target.x, target.y, '#fff4cb', 1.7);
      ctx.setLineDash([]);
      ellipse(target.x, target.y, 10, 5, '#fff4cb');
      ellipse(origin.x, origin.y, 13, 7, '#ffeea5', 3);
    } else {
      const t = clamp((time - shot.start) / .69, 0, 1);
      const x = origin.x + (shot.x - origin.x) * t, y = origin.y + (shot.y - origin.y) * t;
      ellipse(x, y, 13, 5, '#644951', 1);
      ellipse(x, y - Math.sin(t * Math.PI) * 52, 13, 5, '#fff2ad', 4);
    }
    const x = 37 + strength() * 286;
    pill(ctx, 28, 353, 304, 24, 8, '#5b424b');
    for (let i = 0; i < 7; i++) line(ctx, 37 + i * 286 / 6, 359, 37 + i * 286 / 6, 371, '#ad8070', 1.4);
    line(ctx, x, 352, x, 378, '#ffe3a2', 4);
    view.readout(`得分 ${score}　·　剩余圈数 ${rings}/8`);
  }
  view.say('调整方向，等力度指针到合适位置再投');
  view.run(update, draw);
}
