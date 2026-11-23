import { action, facts, range, shuffled, suits, suitNames, table, zone } from './cards-ui.js';

const values = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', '小王', '大王'];
const kinds = { single: '单张', pair: '对子', triple: '三张', oneWing: '三带一', pairWing: '三带一对', run: '顺子', pairRun: '连对', plane: '飞机', planeOne: '飞机带单', planePair: '飞机带对', fourOne: '四带二单', fourPair: '四带两对', bomb: '炸弹', rocket: '火箭' };
const seats = ['你', '下家', '上家'];
const levels = ['轻松', '标准', '高手'];
const rank = card => card < 52 ? Math.floor(card / 4) : card - 39;
const sorted = list => [...list].sort((a, b) => a - b);
const copies = (r, n) => Array(n).fill(r);
function frequencies(ranks) {
  const counts = Array(15).fill(0);
  for (const r of ranks) counts[r]++;
  return counts;
}

export function landlordPatterns(ranks) {
  if (!ranks.length) return [];
  const counts = frequencies(ranks), present = range(15).filter(r => counts[r]);
  const n = ranks.length, highest = present.at(-1), result = [];
  const add = (kind, high = highest) => result.push({ kind, high, n });
  if (n === 2 && present[0] === 13 && highest === 14) add('rocket');
  if (present.length === 1 && n <= 4) add(['', 'single', 'pair', 'triple', 'bomb'][n]);
  const consecutive = highest < 12 && highest - present[0] + 1 === present.length;
  if (consecutive && present.length >= 5 && present.every(r => counts[r] === 1)) add('run');
  if (consecutive && present.length >= 3 && present.every(r => counts[r] === 2)) add('pairRun');
  for (const main of present) {
    if (counts[main] === 3 && n === 4) add('oneWing', main);
    if (counts[main] === 3 && n === 5 && present.length === 2) add('pairWing', main);
    if (counts[main] === 4 && n === 6) add('fourOne', main);
    if (counts[main] === 4 && n === 8 && present.length === 3 && present.every(r => r === main || counts[r] === 2)) add('fourPair', main);
  }
  for (const [kind, perGroup] of [['plane', 3], ['planeOne', 4], ['planePair', 5]]) {
    const length = n / perGroup;
    if (!Number.isInteger(length) || length < 2) continue;
    for (let low = 0; low + length <= 12; low++) {
      const core = range(length).map(i => low + i);
      if (!core.every(r => counts[r] === 3)) continue;
      const wings = present.filter(r => !core.includes(r));
      if (kind === 'planePair' && (wings.length !== length || wings.some(r => counts[r] !== 2))) continue;
      add(kind, low + length - 1);
    }
  }
  return result;
}

export function landlordBeats(play, previous) {
  if (!previous) return true;
  if (play.kind === 'rocket') return previous.kind !== 'rocket';
  if (play.kind === 'bomb' && previous.kind !== 'bomb' && previous.kind !== 'rocket') return true;
  return play.kind === previous.kind && play.n === previous.n && play.high > previous.high;
}

// One representative per attachment strategy suffices for the computer. Human plays
// are classified independently, so every legal choice of wings remains available.
export function landlordMoves(handRanks, previous = null) {
  const counts = frequencies(handRanks), candidates = new Map();
  function add(ranks) {
    const cards = sorted(ranks), token = cards.join(',');
    if (candidates.has(token)) return;
    const pattern = landlordPatterns(cards).find(candidate => landlordBeats(candidate, previous));
    if (pattern) candidates.set(token, { cards, pattern });
  }
  function withWings(core, units, paired) {
    const remaining = range(15).filter(r => counts[r] && !core.includes(r));
    const orders = [remaining, [...remaining].sort((a, b) => counts[a] - counts[b] || a - b)];
    for (const order of orders) {
      const available = paired ? order.filter(r => counts[r] >= 2) : order.flatMap(r => copies(r, counts[r]));
      if (available.length >= units) add([...core, ...available.slice(0, units).flatMap(r => copies(r, paired ? 2 : 1))]);
    }
  }
  for (const r of range(15)) {
    for (let n = 1; n <= counts[r]; n++) add(copies(r, n));
    if (counts[r] >= 3) {
      withWings(copies(r, 3), 1, false);
      withWings(copies(r, 3), 1, true);
    }
    if (counts[r] === 4) {
      withWings(copies(r, 4), 2, false);
      withWings(copies(r, 4), 2, true);
    }
  }
  for (const width of [1, 2, 3]) {
    for (let low = 0; low < 12; low++) {
      const core = [], minimum = width === 1 ? 5 : width === 2 ? 3 : 2;
      for (let high = low; high < 12 && counts[high] >= width; high++) {
        core.push(...copies(high, width));
        const length = high - low + 1;
        if (length < minimum) continue;
        add(core);
        if (width === 3) {
          withWings(core, length, false);
          withWings(core, length, true);
        }
      }
    }
  }
  if (counts[13] && counts[14]) add([13, 14]);
  return [...candidates.values()];
}

function remainingCost(hand, move) {
  const counts = frequencies(hand);
  for (const r of move.cards) counts[r]--;
  let cost = 0;
  for (const [width, min] of [[3, 2], [2, 3], [1, 5]]) {
    for (let start = 0; start < 12;) {
      let end = start;
      while (end < 12 && counts[end] >= width) end++;
      if (end - start >= min) {
        for (let r = start; r < end; r++) counts[r] -= width;
        cost++;
      } else start = end + 1;
    }
  }
  let groups = 0, carriers = 0, attachments = 0;
  for (const count of counts) {
    if (count) groups++;
    if (count === 3) carriers++;
    if (count === 1 || count === 2) attachments++;
  }
  return cost + groups - Math.min(carriers, attachments);
}

function chooseMove(hands, seat, landlord, previous, owner, level, random) {
  const hand = hands[seat].map(rank), moves = landlordMoves(hand, previous);
  if (!moves.length) return null;
  const finish = moves.find(move => move.cards.length === hand.length);
  if (finish) return finish;
  const partnerLed = previous && owner !== landlord && seat !== landlord;
  if (partnerLed && (level === 2 || level === 1 && (previous.high >= 8 || hands[owner].length <= 4))) return null;
  const nextSeat = (seat + 1) % 3;
  const danger = level === 2 && hands[nextSeat].length <= 2 && (seat === landlord || nextSeat === landlord);
  const preference = move => {
    const { kind, high } = move.pattern;
    const premium = kind === 'bomb' || kind === 'rocket' ? 32 : 0;
    if (level === 0) return premium + (previous ? high : move.cards.length * 1.8 + high * 0.3);
    const rankCost = high * (danger && previous ? -0.9 : 0.35);
    const shapeCost = level === 2 ? remainingCost(hand, move) * 4 : -move.cards.length;
    return premium + rankCost + shapeCost + (danger && move.cards.length === hands[nextSeat].length ? 7 : 0);
  };
  const ordered = moves.map(move => ({ move, score: preference(move) })).sort((a, b) => a.score - b.score);
  return ordered[level === 0 ? Math.floor(random() * Math.min(3, ordered.length)) : 0].move;
}

function bidStrength(hand, level, random) {
  const counts = frequencies(hand.map(rank));
  const strength = counts[14] * 2.8 + counts[13] * 1.8 + counts[12] * 1.15 + counts[11] * 0.5
    + counts.filter(n => n === 4).length * 2.4 + (counts[13] && counts[14] ? 1.5 : 0);
  const adjusted = strength + (random() - 0.5) * (level === 0 ? 4 : level === 1 ? 2 : 0.6);
  return adjusted > 7.4 ? 3 : adjusted > 5.4 ? 2 : adjusted > 3.6 ? 1 : 0;
}

export function mountLandlord(host, api) {
  let stage = 'level', level = 1, hands, bottom, turn, bid, bidder, bids, landlord, previous, owner, passes;
  let selected = new Set(), history = [], note = '', outcome = '';
  const ui = table(host, api, click);
  function deal() {
    const deck = shuffled(range(54), api.random);
    hands = range(3).map(i => sorted(deck.slice(i * 17, i * 17 + 17)));
    bottom = deck.slice(51); turn = Math.floor(api.random() * 3);
    bid = 0; bidder = -1; bids = 0; stage = 'bid'; selected.clear(); history = [];
    note = '轮流叫分，最高分拿底牌。';
  }
  function takeBid(value) {
    bids++;
    history.push(`${seats[turn]}：${value ? '叫 ' + value + ' 分' : '不叫'}`);
    if (value) { bid = value; bidder = turn; }
    if (value === 3 || bids === 3) {
      if (bidder < 0) { deal(); note = '三家都不叫，已重新发牌。'; return; }
      landlord = bidder; turn = landlord; owner = -1; previous = null; passes = 0; stage = 'play';
      hands[landlord] = sorted([...hands[landlord], ...bottom]);
      note = `${seats[landlord]}当地主，拿走底牌并先出。`;
    } else turn = (turn + 1) % 3;
  }
  function play(cards, pattern) {
    if (!cards) {
      history.push(`${seats[turn]}：过`); passes++;
      if (passes === 2) { previous = null; passes = 0; history.push(`${seats[owner]}重新领出`); }
    } else {
      const ids = new Set(cards);
      hands[turn] = hands[turn].filter(card => !ids.has(card));
      history.push(`${seats[turn]}：${kinds[pattern.kind]} · ${sorted(cards.map(rank)).map(r => values[r]).join(' ')}`);
      previous = pattern; owner = turn; passes = 0;
      if (!hands[turn].length) {
        const won = (turn === landlord) === (landlord === 0);
        outcome = `${seats[turn]}率先出光，${turn === landlord ? '地主' : '农民'}获胜。你${won ? '赢了' : '落败'}！`;
        stage = 'done'; return;
      }
    }
    turn = (turn + 1) % 3;
  }
  function findIds(hand, ranks) {
    const counts = frequencies(ranks);
    return hand.filter(card => { const r = rank(card); if (!counts[r]) return false; counts[r]--; return true; });
  }
  function advance() {
    while ((stage === 'bid' || stage === 'play') && turn !== 0) {
      if (stage === 'bid') {
        const wanted = bidStrength(hands[turn], level, api.random);
        takeBid(wanted > bid ? wanted : 0);
      } else {
        const move = chooseMove(hands, turn, landlord, previous, owner, level, api.random);
        play(move ? findIds(hands[turn], move.cards) : null, move?.pattern);
      }
    }
    draw();
    if (outcome) ui.end(outcome);
  }
  function click(id) {
    if (stage === 'level' && id.startsWith('level-')) {
      level = Number(id.slice(6)); api.unrank(); deal(); advance(); return;
    }
    if (turn !== 0) return;
    if (stage === 'bid' && id.startsWith('bid-')) {
      const amount = Number(id.slice(4));
      if (!amount || amount > bid && amount <= 3) { takeBid(amount); advance(); }
      return;
    }
    if (stage !== 'play') return;
    if (id.startsWith('card-')) {
      const card = Number(id.slice(5));
      if (selected.has(card)) selected.delete(card); else selected.add(card);
      draw(); return;
    }
    if (id === 'clear') { selected.clear(); draw(); return; }
    if (id === 'hint') {
      const move = landlordMoves(hands[0].map(rank), previous).sort((a, b) => b.cards.length - a.cards.length || a.pattern.high - b.pattern.high)[0];
      selected = new Set(move ? findIds(hands[0], move.cards) : []);
      note = move ? `已选出${kinds[move.pattern.kind]}，确认后出牌。` : '没有能压过桌面的牌，可以过牌。';
      api.unrank(); draw(); return;
    }
    if (id === 'pass' && previous) { selected.clear(); note = ''; play(null); advance(); return; }
    if (id === 'play') {
      const cards = [...selected], patterns = landlordPatterns(cards.map(rank));
      const pattern = patterns.find(option => landlordBeats(option, previous));
      if (!pattern) {
        note = patterns.length ? '这组牌压不过上一手，请换牌或过牌。' : '选中的牌不能组成合法牌型。';
        draw(); return;
      }
      selected.clear(); note = ''; play(cards, pattern); advance();
    }
  }
  function draw() {
    if (stage === 'level') {
      ui.paint(zone('选择对手难度', levels.map((name, i) => action('level-' + i, name)).join(''), 'xc-actions'));
      api.status('轻松对手偏爱小牌，高手会保留组合并与队友配合。'); return;
    }
    const bidding = stage === 'bid';
    const publicInfo = facts(hands.map((hand, i) => [seats[i] + (bidding ? '' : i === landlord ? ' · 地主' : ' · 农民'), hand.length + ' 张']));
    const latest = history.slice(-4).map(text => `<div>${text}</div>`).join('');
    const hand = zone('你的手牌', hands[0].map(card => {
      const r = rank(card), s = card % 4;
      const label = card < 52 ? suits[s] + values[r] : values[r];
      return action('card-' + card, label, { className: 'xc-card' + (card < 52 && (s === 1 || s === 2) || card === 53 ? ' xc-red' : ''), name: (card < 52 ? suitNames[s] : '') + values[r], selected: selected.has(card), disabled: bidding });
    }).join(''));
    const controls = bidding
      ? [0, 1, 2, 3].map(n => action('bid-' + n, n ? n + ' 分' : '不叫', { disabled: n > 0 && n <= bid })).join('')
      : action('play', '出选中的牌', { disabled: !selected.size, className: 'xc-primary' }) + action('pass', '过牌', { disabled: !previous }) + action('clear', '清除选择', { disabled: !selected.size }) + action('hint', '提示');
    const call = bidding ? '轮到你叫分' : previous ? `请压过${seats[owner]}的${kinds[previous.kind]}（${values[previous.high]}）` : '轮到你领出任意合法牌型';
    ui.paint(publicInfo + `<div class="xc-field"><span>底牌 · ${bidding ? '未揭晓' : bottom.map(card => values[rank(card)]).join('　')}</span><div class="xc-log">${latest}</div></div>` + hand + zone(call, controls, 'xc-actions'));
    api.status(outcome || [call, note].filter(Boolean).join('。'));
  }
  draw();
}
