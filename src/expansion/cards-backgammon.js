import { action, facts, range, table, zone } from './cards-ui.js';

const bar = -1, off = 24;
const signFor = seat => seat === 0 ? 1 : -1;
const distance = (point, seat) => seat === 0 ? point + 1 : 24 - point;
export function initialBackgammon() {
  const points = Array(24).fill(0);
  for (const [i, n] of [[23, 2], [12, 5], [7, 3], [5, 5]]) { points[i] = n; points[23 - i] = -n; }
  return { points, bar: [0, 0], off: [0, 0] };
}

function singleSteps(board, seat, die) {
  const sign = signFor(seat), open = at => board.points[at] * sign >= -1;
  if (board.bar[seat]) {
    const to = seat === 0 ? 24 - die : die - 1;
    return open(to) ? [{ from: bar, to, die }] : [];
  }
  const occupied = range(24).filter(i => board.points[i] * sign > 0);
  const farthest = Math.max(0, ...occupied.map(i => distance(i, seat))), steps = [];
  for (const from of occupied) {
    const to = from - sign * die;
    if (to >= 0 && to < 24) {
      if (open(to)) steps.push({ from, to, die });
    } else if (farthest <= 6 && (distance(from, seat) === die || distance(from, seat) === farthest)) {
      steps.push({ from, to: off, die });
    }
  }
  return steps;
}

export function bgApply(board, seat, move) {
  const sign = signFor(seat), next = { points: [...board.points], bar: [...board.bar], off: [...board.off] };
  if (move.from === bar) next.bar[seat]--; else next.points[move.from] -= sign;
  if (move.to === off) next.off[seat]++;
  else {
    if (next.points[move.to] === -sign) { next.bar[1 - seat]++; next.points[move.to] = 0; }
    next.points[move.to] += sign;
  }
  return next;
}
function consume(dice, die) {
  const next = [...dice]; next.splice(next.indexOf(die), 1); return next;
}

// Filter first steps by the longest attainable turn before enforcing the higher-die rule.
export function bgLegal(board, seat, dice) {
  const memo = new Map();
  function length(state, left) {
    if (!left.length) return 0;
    const key = state.points.join(',') + '/' + state.bar + '/' + left;
    if (memo.has(key)) return memo.get(key);
    let best = 0;
    for (const die of new Set(left)) {
      const rest = consume(left, die);
      for (const step of singleSteps(state, seat, die)) {
        best = Math.max(best, 1 + length(bgApply(state, seat, step), rest));
        if (best === left.length) { memo.set(key, best); return best; }
      }
    }
    memo.set(key, best); return best;
  }
  const target = length(board, dice);
  if (!target) return [];
  let legal = [];
  for (const die of new Set(dice)) {
    const rest = consume(dice, die);
    legal.push(...singleSteps(board, seat, die).filter(step => 1 + length(bgApply(board, seat, step), rest) === target));
  }
  if (target === 1 && new Set(dice).size > 1) {
    const largest = Math.max(...legal.map(step => step.die));
    legal = legal.filter(step => step.die === largest);
  }
  return legal;
}

export function bgWinValue(board, winner) {
  const loser = 1 - winner;
  if (board.off[loser]) return 1;
  return board.bar[loser] || board.points.some((n, i) => n * signFor(loser) > 0 && distance(i, winner) <= 6) ? 3 : 2;
}
function computerStep(board, moves) {
  function strength(move) {
    const next = bgApply(board, 1, move);
    let value = next.bar[0] * 6 + next.off[1] * 3;
    for (let i = 0; i < 24; i++) {
      if (next.points[i] >= 0) continue;
      if (next.points[i] <= -2) value += distance(i, 1) <= 6 ? 1.9 : 0.8;
      if (next.points[i] === -1 && (next.bar[0] || next.points.slice(i + 1, i + 7).some(n => n > 0))) value -= 1.6;
      value -= -next.points[i] * distance(i, 1) * 0.1;
    }
    return value;
  }
  return moves.reduce((best, move) => strength(move) > strength(best) ? move : best);
}
const place = position => position === bar ? '中栏' : position === off ? '收子' : String(position + 1);

export function mountBackgammon(host, api) {
  let board = initialBackgammon(), phase = 'opening', dice = [], legal = [], selected = null, choices = [];
  let note = '开局双方各掷一颗，高者先走。', rolled = '', over = '';
  const ui = table(host, api, click);
  const die = () => 1 + Math.floor(api.random() * 6);
  function roll() { const a = die(), b = die(); return a === b ? [a, a, a, a] : [a, b]; }
  function finish(seat) {
    const multiple = bgWinValue(board, seat);
    over = `${seat === 0 ? '你' : '对手'}率先收齐十五枚，${['', '单胜', '双胜', '三胜'][multiple]}（${multiple} 分）。`;
    phase = 'done'; legal = []; selected = null;
  }
  function refreshMoves() {
    choices = []; selected = null;
    if (board.off[0] === 15) { finish(0); return; }
    legal = bgLegal(board, 0, dice);
    if (!legal.length) {
      phase = 'next';
      note += dice.length ? ' 剩余骰点无法使用。' : ' 你的骰点已用完。';
    } else { phase = 'move'; if (board.bar[0]) selected = bar; }
  }
  function computer(throwing) {
    let left = [...throwing];
    const log = [];
    while (left.length && board.off[1] !== 15) {
      const options = bgLegal(board, 1, left);
      if (!options.length) break;
      const move = computerStep(board, options);
      board = bgApply(board, 1, move); left = consume(left, move.die);
      log.push(`${place(move.from)}→${place(move.to)}`);
    }
    note = `对手掷 ${throwing.join('、')}，${log.length ? log.join('，') : '没有可走的步'}。`;
    rolled = '对手 ' + throwing.join(' · '); dice = []; legal = []; choices = []; selected = null;
    if (board.off[1] === 15) finish(1); else phase = 'roll';
  }
  function step(move) {
    board = bgApply(board, 0, move); dice = consume(dice, move.die);
    note = `你从${place(move.from)}走到${place(move.to)}，用掉 ${move.die} 点。`;
    refreshMoves();
  }
  function click(id) {
    if (id === 'opening' && phase === 'opening') {
      const mine = die(), theirs = die();
      rolled = `白 ${mine} · 黑 ${theirs}`;
      if (mine === theirs) note = `双方都掷出 ${mine} 点，请重新对掷。`;
      else if (mine > theirs) { dice = [mine, theirs]; note = '你先走，使用开局的两颗骰子。'; refreshMoves(); }
      else computer([mine, theirs]);
    } else if (id === 'roll' && phase === 'roll') {
      dice = roll(); rolled = '你 ' + dice.join(' · '); note = '请选择白子起点和目的地。'; refreshMoves();
    } else if (id === 'opponent' && phase === 'next') computer(roll());
    else if (phase === 'move' && id.startsWith('point-')) {
      const point = Number(id.slice(6));
      const hits = selected === null ? [] : legal.filter(move => move.from === selected && move.to === point);
      if (hits.length === 1) step(hits[0]);
      else if (hits.length > 1) { choices = hits; note = '同一终点可用不同骰子，请选择。'; }
      else if (legal.some(move => move.from === point)) {
        selected = selected === point && point !== bar ? null : point; choices = [];
        note = selected === null ? '选择要移动的白子。' : `已选${place(point)}，请选择标出的终点。`;
      }
    } else if (phase === 'move' && id.startsWith('use-')) {
      const move = choices.find(option => option.die === Number(id.slice(4)));
      if (move) step(move);
    } else return;
    draw(); if (over) ui.end(over);
  }
  function pointButton(i) {
    const qty = board.points[i], source = legal.some(move => move.from === i), target = legal.some(move => move.from === selected && move.to === i);
    const klass = 'xc-point ' + (i % 2 ? 'xc-light' : 'xc-dark') + (source ? ' xc-origin' : '') + (target ? ' xc-target' : '');
    const name = `${i + 1} 点，${qty ? (qty > 0 ? '白' : '黑') + '子 ' + Math.abs(qty) + ' 枚' : '空'}${target ? '，可以到达' : source ? '，可以移动' : ''}`;
    return action('point-' + i, `<small>${i + 1}</small><b class="${qty > 0 ? 'xc-white' : 'xc-black'}">${qty ? Math.abs(qty) : ''}</b>`, { name, selected: selected === i, disabled: !source && !target, className: klass });
  }
  function draw() {
    const rows = [[...range(6)].map(i => i + 12), range(6).map(i => i + 18), range(6).map(i => 11 - i), range(6).map(i => 5 - i)];
    const boardView = rows.map(segment => `<div class="xc-quadrant">${segment.map(pointButton).join('')}</div>`).join('');
    const hasBar = legal.some(move => move.from === bar);
    const canOff = legal.some(move => move.from === selected && move.to === off);
    const barButton = action('point--1', '白方中栏 ' + board.bar[0], { disabled: !hasBar, selected: selected === bar });
    const bearButton = action('point-24', '收子区 ' + board.off[0], { disabled: !canOff, className: canOff ? 'xc-primary' : '' });
    let control = '';
    if (phase === 'opening') control = action('opening', '开局对掷', { className: 'xc-primary' });
    if (phase === 'roll') control = action('roll', '掷骰', { className: 'xc-primary' });
    if (phase === 'next') control = action('opponent', '结束回合，对手掷骰', { className: 'xc-primary' });
    if (choices.length) control = choices.map(move => action('use-' + move.die, '用 ' + move.die + ' 点收子')).join('');
    ui.paint(facts([['白方 · 你', `栏 ${board.bar[0]} / 收 ${board.off[0]}`], ['黑方 · 对手', `栏 ${board.bar[1]} / 收 ${board.off[1]}`], ['骰子', phase === 'move' ? dice.join(' · ') : rolled || '待掷']])
      + zone('白子向 1 点走 · 黑子向 24 点走', boardView, 'xc-bg-board')
      + `<div class="xc-actions">${barButton}${bearButton}${control}</div>`);
    api.status(over || note);
  }
  draw();
}
