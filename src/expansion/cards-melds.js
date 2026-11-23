import { action, facts, range, shuffled, sum, table, zone } from './cards-ui.js';

export const dominoes = range(7).flatMap(a => range(7 - a).map(n => [a, a + n]));
const dots = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
const dominoName = id => dominoes[id].join('｜');
function dominoFace(pair) {
  return pair.map(n => `<span class="xc-bone-half">${range(9).map(i => `<i${dots[n].includes(i) ? ' class="xc-pip"' : ''}></i>`).join('')}</span>`).join('');
}
export function dominoOptions(id, chain) {
  const tile = dominoes[id];
  if (!chain.length) return ['right'];
  const options = [];
  if (tile.includes(chain[0][0])) options.push('left');
  if (tile.includes(chain.at(-1)[1])) options.push('right');
  return options;
}
export function attachDomino(id, side, chain) {
  if (!dominoOptions(id, chain).includes(side)) return false;
  const [a, b] = dominoes[id];
  if (!chain.length) chain.push([a, b]);
  else if (side === 'left') chain.unshift(chain[0][0] === b ? [a, b] : [b, a]);
  else chain.push(chain.at(-1)[1] === a ? [a, b] : [b, a]);
  return true;
}
export function mountDominoes(host, api) {
  const deck = shuffled(range(28), api.random), hands = [deck.splice(0, 7), deck.splice(0, 7)];
  const chain = [], ui = table(host, api, click);
  let selected = null, passes = 0, note = '', over = '';
  const weight = id => { const [a, b] = dominoes[id]; return a === b ? 1000 + a : (a + b) * 10 + b; };
  const first = [...hands[0], ...hands[1]].sort((a, b) => weight(b) - weight(a))[0], starter = hands[0].includes(first) ? 0 : 1;
  const pips = hand => sum(hand.map(id => sum(dominoes[id])));
  function playable(seat) { return hands[seat].filter(id => dominoOptions(id, chain).length); }
  function place(seat, id, side) {
    if (!attachDomino(id, side, chain)) return;
    hands[seat].splice(hands[seat].indexOf(id), 1); passes = 0;
    if (!hands[seat].length) over = `${seat === 0 ? '你' : '对手'}先出光骨牌，获胜！另一方剩 ${pips(hands[1 - seat])} 点。`;
  }
  function pass() {
    passes++;
    if (passes < 2) return;
    const own = pips(hands[0]), other = pips(hands[1]);
    over = `两端封死。你剩 ${own} 点，对手剩 ${other} 点，${own === other ? '平局' : own < other ? '你获胜' : '对手获胜'}。`;
  }
  function opponent() {
    let drew = 0;
    while (!playable(1).length && deck.length) { hands[1].push(deck.pop()); drew++; }
    const legal = playable(1);
    if (!legal.length) { pass(); note += ' 对手也无法接牌，过。'; return; }
    const moves = legal.flatMap(id => dominoOptions(id, chain).map(side => {
      const copy = [...chain]; attachDomino(id, side, copy);
      const options = hands[1].filter(other => other !== id && dominoOptions(other, copy).length).length;
      return { id, side, score: sum(dominoes[id]) + options * 2 };
    })).sort((a, b) => b.score - a.score);
    const { id, side } = moves[0]; place(1, id, side);
    note += ` 对手${drew ? '摸 ' + drew + ' 张后' : ''}在${side === 'left' ? '左' : '右'}端接 ${dominoName(id)}。`;
  }
  function click(id) {
    const legal = playable(0);
    if (id.startsWith('bone-')) {
      const tile = Number(id.slice(5));
      if (!legal.includes(tile)) return;
      selected = tile === selected ? null : tile; note = selected === null ? '' : '选择要接入的一端。';
    } else if ((id === 'left' || id === 'right') && selected !== null && dominoOptions(selected, chain).includes(id)) {
      note = `你接了 ${dominoName(selected)}。`; place(0, selected, id); selected = null;
      if (!over) opponent();
    } else if (id === 'draw' && !legal.length && deck.length) {
      const tile = deck.pop(); hands[0].push(tile); note = `你摸到 ${dominoName(tile)}。`;
    } else if (id === 'pass' && !legal.length && !deck.length) {
      pass(); note = '你无法接牌，过。'; if (!over) opponent();
    } else return;
    draw(); if (over) ui.end(over);
  }
  function draw() {
    const legal = playable(0), ends = selected === null ? [] : dominoOptions(selected, chain);
    const path = chain.map(pair => `<span class="xc-bone" role="img" aria-label="${pair.join('和')}">${dominoFace(pair)}</span>`).join('');
    const tiles = hands[0].map(id => action('bone-' + id, dominoFace(dominoes[id]), { className: 'xc-bone', name: dominoName(id), selected: selected === id, disabled: !legal.includes(id) })).join('');
    const controls = action('left', '接左端 ' + chain[0][0], { disabled: !ends.includes('left') }) + action('right', '接右端 ' + chain.at(-1)[1], { disabled: !ends.includes('right') })
      + (deck.length ? action('draw', '摸一张', { disabled: !!legal.length }) : action('pass', '过牌', { disabled: !!legal.length }));
    ui.paint(facts([['牌链两端', chain[0][0] + ' · ' + chain.at(-1)[1]], ['对手', hands[1].length + ' 张'], ['牌库', deck.length + ' 张']])
      + zone('骨牌链 · 从左至右', path, 'xc-chain') + zone('你的骨牌', tiles) + `<div class="xc-actions">${controls}</div>`);
    api.status(note.trim() || (legal.length ? '选一张骨牌，再选择接入的一端。' : deck.length ? '没有可接的牌，请摸一张。' : '不能接牌，请过。'));
  }
  place(starter, first, 'right'); note = `${starter ? '对手' : '你'}以 ${dominoName(first)} 开局。`;
  if (!starter) opponent();
  draw();
}

const colorNames = ['蓝', '橙', '绿', '紫'];
const joker = tile => tile >= 104;
const color = tile => Math.floor(tile % 52 / 13);
const value = tile => tile % 13 + 1;
const rackCost = tiles => sum(tiles.map(tile => joker(tile) ? 30 : value(tile)));
const orderedRack = tiles => [...tiles].sort((a, b) => Number(joker(a)) - Number(joker(b)) || color(a) - color(b) || value(a) - value(b) || a - b);

export function meldInfo(tiles) {
  if (tiles.length < 3 || tiles.length > 13 || new Set(tiles).size !== tiles.length) return null;
  const wild = tiles.filter(joker), natural = tiles.filter(tile => !joker(tile));
  if (!natural.length) return null;
  const colors = new Set(natural.map(color)), ranks = natural.map(value), rankSet = new Set(ranks);
  let best = null;
  if (tiles.length <= 4 && rankSet.size === 1 && colors.size === natural.length) {
    best = { kind: '刻组', points: ranks[0] * tiles.length, ordered: [...orderedRack(natural), ...wild] };
  }
  if (colors.size === 1 && rankSet.size === natural.length) {
    const start = Math.min(Math.min(...ranks), 14 - tiles.length);
    if (start >= 1 && Math.max(...ranks) < start + tiles.length) {
      const deck = new Map(natural.map(tile => [value(tile), tile])), spare = [...wild];
      const sequence = range(tiles.length).map(i => deck.get(i + start) ?? spare.shift());
      const points = (2 * start + tiles.length - 1) * tiles.length / 2;
      if (!best || points > best.points) best = { kind: '顺组', points, ordered: sequence };
    }
  }
  return best;
}

function meldCandidates(rack) {
  const wild = rack.filter(joker), byFace = new Map();
  for (const tile of rack) if (!joker(tile)) byFace.set(tile % 52, tile);
  const found = new Map();
  function add(faces) {
    const cards = faces.map(face => byFace.get(face));
    const absent = cards.filter(tile => tile === undefined).length;
    if (absent > wild.length || absent === cards.length) return;
    let i = 0;
    const tiles = cards.map(tile => tile ?? wild[i++]), key = [...tiles].sort((a, b) => a - b).join(',');
    if (found.has(key)) return;
    const info = meldInfo(tiles);
    if (info) found.set(key, info);
  }
  for (let r = 0; r < 13; r++) {
    for (const mask of [7, 11, 13, 14, 15]) add(range(4).filter(c => mask & (1 << c)).map(c => c * 13 + r));
  }
  for (const c of range(4)) {
    for (let low = 0; low < 11; low++) {
      for (let high = low + 2; high < 13; high++) add(range(high - low + 1).map(i => c * 13 + low + i));
    }
  }
  return [...found.values()].sort((a, b) => b.ordered.length - a.ordered.length || b.points - a.points);
}
const without = (list, removed) => list.filter(tile => !removed.includes(tile));
export function rummyOpening(rack, needed = 30) {
  const seen = new Set();
  function search(tiles, remaining) {
    const key = [...tiles].sort((a, b) => a - b).join(',') + '/' + remaining;
    if (seen.has(key)) return null;
    seen.add(key);
    const candidates = meldCandidates(tiles);
    const single = candidates.find(option => option.points >= remaining);
    if (single) return [single.ordered];
    for (const option of candidates) {
      const rest = without(tiles, option.ordered);
      if (rest.length < 3) continue;
      const more = search(rest, remaining - option.points);
      if (more) return [option.ordered, ...more];
    }
    return null;
  }
  return search(rack, needed);
}

function rummyAI(rack, groups, opened) {
  const original = rack.length;
  if (!opened) {
    const initial = rummyOpening(rack);
    if (!initial) return { rack, groups, played: false };
    for (const group of initial) { rack = without(rack, group); groups.push(group); }
  }
  for (let option; (option = meldCandidates(rack)[0]);) {
    groups.push(option.ordered); rack = without(rack, option.ordered);
  }
  if (opened) {
    let changed;
    do {
      changed = false;
      for (const tile of rack) {
        const index = groups.findIndex(group => meldInfo([...group, tile]));
        if (index < 0) continue;
        groups[index] = meldInfo([...groups[index], tile]).ordered;
        rack = without(rack, [tile]); changed = true; break;
      }
    } while (changed);
  }
  return { rack, groups, played: original !== rack.length };
}

export function mountRummikub(host, api) {
  const pile = shuffled(range(106), api.random), hands = [pile.splice(0, 14), pile.splice(0, 14)];
  const opened = [false, false], ui = table(host, api, click);
  let board = [], working, rack, selected, dirty, passes = 0, note = '', over = '';
  function resetDraft() {
    working = board.map(group => [...group]); rack = [...hands[0]]; selected = new Set(); dirty = false;
  }
  function assign(target) {
    if (!selected.size) return;
    if (target === 'rack' && ![...selected].every(tile => hands[0].includes(tile))) return;
    if (typeof target === 'number' && !opened[0] && target < board.length) return;
    const tiles = [...selected];
    rack = without(rack, tiles); working = working.map(group => without(group, tiles));
    if (target === 'new') working.push(tiles);
    else if (target === 'rack') rack.push(...tiles);
    else working[target].push(...tiles);
    dirty = true; selected.clear(); note = '';
  }
  function pass() {
    if (++passes < 2) return;
    const own = rackCost(hands[0]), theirs = rackCost(hands[1]);
    over = `牌库已空，双方都过。你剩 ${own} 点，对手剩 ${theirs} 点，${own === theirs ? '平局' : own < theirs ? '你获胜' : '对手获胜'}。`;
  }
  function opponent() {
    const before = hands[1].length, move = rummyAI(hands[1], board, opened[1]);
    if (move.played) {
      hands[1] = move.rack; board = move.groups; passes = 0;
      note += ` 对手${opened[1] ? '打出' : '破冰并打出'} ${before - hands[1].length} 张。`; opened[1] = true;
      if (!hands[1].length) over = '对手率先清空手牌，赢得本局。';
    } else if (pile.length) {
      hands[1].push(pile.pop()); passes = 0; note += ' 对手摸了一张。';
    } else { pass(); note += ' 对手过牌。'; }
    resetDraft();
  }
  function commit() {
    const used = hands[0].length - rack.length;
    if (used < 1) { note = '本轮至少需要打出一张自己的手牌。'; return; }
    const groups = working.filter(group => group.length), valid = groups.map(meldInfo);
    if (valid.some(info => !info)) { note = '还有牌组不合法，请调整标记的牌组。'; return; }
    if (!opened[0]) {
      const openingPoints = sum(working.slice(board.length).filter(g => g.length).map(g => meldInfo(g).points));
      if (openingPoints < 30) { note = `破冰至少 30 点，目前 ${openingPoints} 点。可以继续添加牌组。`; return; }
    }
    board = valid.map(info => info.ordered); hands[0] = [...rack]; opened[0] = true; passes = 0;
    note = `你打出 ${used} 张。`;
    if (!rack.length) { over = '你率先清空手牌，赢得本局！'; resetDraft(); }
    else opponent();
  }
  function click(id) {
    if (id.startsWith('tile-')) {
      const tile = Number(id.slice(5));
      if (selected.has(tile)) selected.delete(tile); else selected.add(tile);
    } else if (id === 'new' || id === 'rack') assign(id);
    else if (id.startsWith('group-')) assign(Number(id.slice(6)));
    else if (id === 'undo') { resetDraft(); note = '已还原本轮开始时的桌面。'; }
    else if (id === 'commit') commit();
    else if (id === 'draw' && !dirty) {
      if (pile.length) { hands[0].push(pile.pop()); passes = 0; note = '你摸了一张。'; }
      else { pass(); note = '你过牌。'; }
      if (!over) opponent(); else resetDraft();
    } else return;
    draw(); if (over) ui.end(over);
  }
  function tileButton(tile, disabled = false) {
    const wild = joker(tile), text = wild ? '百搭' : colorNames[color(tile)] + value(tile);
    return action('tile-' + tile, `<b>${wild ? '★' : value(tile)}</b><small>${wild ? '百搭' : colorNames[color(tile)]}</small>`, { name: text, className: 'xc-rummy xc-ink-' + (wild ? 4 : color(tile)), selected: selected.has(tile), disabled });
  }
  function draw() {
    const groups = working.map((group, i) => {
      const info = meldInfo(group), locked = !opened[0] && i < board.length;
      const tiles = (info?.ordered || group).map(tile => tileButton(tile, locked)).join('');
      return `<div class="xc-meld${info || !group.length ? '' : ' xc-incomplete'}"><div class="xc-meld-head"><small>第 ${i + 1} 组 · ${info ? info.kind + ' ' + info.points + ' 点' : group.length ? '待整理' : '空组'}</small>${locked ? '' : action('group-' + i, '移入本组', { disabled: !selected.size })}</div><div class="xc-hand">${tiles}</div></div>`;
    }).join('');
    const controls = action('new', '新建牌组', { disabled: !selected.size }) + action('rack', '收回手牌', { disabled: !selected.size || ![...selected].every(tile => hands[0].includes(tile)) })
      + action('commit', '确认出牌', { disabled: !dirty, className: 'xc-primary' }) + action('undo', '撤回本轮', { disabled: !dirty }) + action('draw', pile.length ? '摸一张并过' : '过牌', { disabled: dirty });
    ui.paint(facts([['你的状态', opened[0] ? '已破冰' : '需破冰 30 点'], ['对手手牌', hands[1].length + ' 张'], ['牌库', pile.length + ' 张']])
      + zone('桌面牌组', groups || '<span class="xc-muted">桌面为空，先从手牌中选出一组。</span>', 'xc-melds')
      + zone('你的手牌 · ' + rack.length + ' 张', orderedRack(rack).map(tile => tileButton(tile)).join('')) + `<div class="xc-actions">${controls}</div>`);
    api.status(note.trim() || (selected.size ? `已选 ${selected.size} 张，可新建牌组或移入已有牌组。` : '选手牌拼组，或摸一张结束回合。'));
  }
  resetDraft(); draw();
}
