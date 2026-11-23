import { action, face, faceName, facts, pip, range, red, shuffled, sum, table, zone } from './cards-ui.js';

const mahjongQuestions = [
  '123m 456p 789s 1115z', '12345m 456p 345s 77z', '12s 456m 789p 666z 22p',
  '234m 555p 789s 22z 66z', '1122m 3366p 8899s 5z', '23456m 678p 456s 33z',
  '1112345678999m', '19m 19p 19s 1234567z',
];
const honors = ['东', '南', '西', '北', '白', '发', '中'];
const families = ['万', '筒', '条', '字'];
const orphans = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
const tileName = tile => tile >= 27 ? honors[tile - 27] : (tile % 9 + 1) + families[Math.floor(tile / 9)];
export const mahjongHands = mahjongQuestions.map(notation => notation.split(' ').flatMap(group => {
  const base = 'mpsz'.indexOf(group.at(-1)) * 9;
  return [...group.slice(0, -1)].map(ch => base + Number(ch) - 1);
}).sort((a, b) => a - b));

function allMelds(counts) {
  const i = counts.findIndex(n => n > 0);
  if (i < 0) return true;
  if (counts[i] >= 3) {
    counts[i] -= 3;
    const valid = allMelds(counts);
    counts[i] += 3;
    if (valid) return true;
  }
  if (i < 27 && i % 9 <= 6 && counts[i + 1] && counts[i + 2]) {
    counts[i]--; counts[i + 1]--; counts[i + 2]--;
    const valid = allMelds(counts);
    counts[i]++; counts[i + 1]++; counts[i + 2]++;
    return valid;
  }
  return false;
}

export function mahjongWin(counts) {
  if (sum(counts) !== 14 || counts.some(n => n > 4)) return false;
  if (counts.filter(n => n === 2).length === 7 || orphans.every(i => counts[i]) && orphans.some(i => counts[i] === 2)) return true;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] < 2) continue;
    counts[i] -= 2;
    const valid = allMelds(counts);
    counts[i] += 2;
    if (valid) return true;
  }
  return false;
}

export function mahjongWaits(hand) {
  const counts = Array(34).fill(0);
  hand.forEach(i => counts[i]++);
  return range(34).filter(i => {
    if (counts[i] === 4) return false;
    counts[i]++;
    const valid = mahjongWin(counts);
    counts[i]--;
    return valid;
  });
}

export function mountMahjong(host, api) {
  let question = 0, errors = 0, solved = false, practice = false, note = '';
  let answers = mahjongWaits(mahjongHands[0]);
  const selected = new Set(), ui = table(host, api, click);
  function click(id) {
    if (id === 'next' && solved) {
      if (question === mahjongHands.length - 1) return;
      question++; solved = false; selected.clear(); note = '';
      answers = mahjongWaits(mahjongHands[question]);
    } else if (!solved && id.startsWith('tile-')) {
      const tile = Number(id.slice(5));
      if (selected.has(tile)) selected.delete(tile); else selected.add(tile);
      note = '';
    } else if (!solved && id === 'hint') {
      practice = true; api.unrank();
      const missing = answers.find(tile => !selected.has(tile));
      const extra = [...selected].find(tile => !answers.includes(tile));
      note = missing !== undefined ? `试着把${tileName(missing)}加入答案。` : extra !== undefined ? `${tileName(extra)}不能让这手牌和牌。` : '你的选择已完整，可以确认。';
    } else if (!solved && selected.size && id === 'confirm') {
      solved = selected.size === answers.length && answers.every(i => selected.has(i));
      if (!solved) { errors++; note = '答案尚未完整或含有多选，本次加时 15 秒。'; }
      else {
        note = '正确，等待 ' + answers.map(tileName).join('、') + '。';
        if (question === mahjongHands.length - 1) {
          const seconds = Math.max(1, Math.ceil(api.elapsed()) + errors * 15);
          draw(); ui.end(`八题全部解开！总用时 ${seconds} 秒，含 ${errors * 15} 秒罚时。`, seconds); return;
        }
      }
    } else return;
    draw();
  }
  function draw() {
    const hand = mahjongHands[question].map(tile => `<span class="xc-mah xc-family-${Math.floor(tile / 9)}">${tileName(tile)}</span>`).join('');
    const choices = families.map((family, i) => `<div class="xc-tile-row" aria-label="${family}">${range(i === 3 ? 7 : 9).map(n => {
      const tile = i * 9 + n;
      return action('tile-' + tile, tileName(tile), { selected: selected.has(tile), disabled: solved, className: 'xc-mah xc-family-' + i });
    }).join('')}</div>`).join('');
    const command = solved ? (question < mahjongHands.length - 1 ? action('next', '下一题', { className: 'xc-primary' }) : '')
      : action('confirm', '确认听牌', { disabled: !selected.size, className: 'xc-primary' }) + action('hint', '提示 · 转为练习');
    ui.paint(facts([['固定牌题', (question + 1) + ' / 8'], ['累计罚时', (errors * 15) + ' 秒'], ['模式', practice ? '练习' : '计时挑战']])
      + zone('十三张手牌', hand, 'xc-hand xc-mah-hand') + zone('选出全部和牌张', choices, 'xc-tile-choices')
      + zone(solved ? '本题已解' : `已选 ${selected.size} 种`, command, 'xc-actions'));
    api.status(note || '选择所有胡牌进张，再确认答案。');
  }
  draw();
}

const pyramidValue = card => (pip(card) + 1) % 13 + 1;
export function pyramidOpen(index, taken) {
  if (taken.has(index)) return false;
  const row = Math.floor((Math.sqrt(8 * index + 1) - 1) / 2);
  return row === 6 || taken.has(index + row + 1) && taken.has(index + row + 2);
}

export function mountPyramid(host, api) {
  const deck = shuffled(range(52), api.random), pyramid = deck.slice(0, 28), stock = deck.slice(28), waste = [];
  const taken = new Set(), ui = table(host, api, click);
  let selected = null, note = '';
  const cardAt = key => key === 'waste' ? waste.at(-1) : pyramid[Number(key)];
  function remove(key) { if (key === 'waste') waste.pop(); else taken.add(Number(key)); }
  function click(id) {
    if (id === 'draw' && stock.length) { waste.push(stock.pop()); selected = null; note = ''; }
    else {
      const key = id.slice(2);
      if (!id.startsWith('p-') || (key === 'waste' ? !waste.length : !pyramidOpen(Number(key), taken))) return;
      if (selected === key) { selected = null; note = ''; }
      else if (pyramidValue(cardAt(key)) === 13) { remove(key); selected = null; note = '移除一张 K。'; }
      else if (selected !== null && pyramidValue(cardAt(key)) + pyramidValue(cardAt(selected)) === 13) {
        remove(key); remove(selected); selected = null; note = '两张合为十三，已移除。';
      } else {
        note = selected === null ? '再选一张可用牌，合为十三。' : '两张未合为十三，已改选当前牌。'; selected = key;
      }
    }
    draw(); check();
  }
  function check() {
    if (taken.size === 28) { ui.end('整座金字塔已清空！'); return; }
    if (stock.length) return;
    const open = pyramid.filter((_, i) => pyramidOpen(i, taken)).map(pyramidValue);
    if (waste.length) open.push(pyramidValue(waste.at(-1)));
    if (!open.some((n, i) => n === 13 || open.slice(i + 1).includes(13 - n))) ui.end(`已清除 ${taken.size}/28 张塔牌，剩余牌无法配对。`);
  }
  function draw() {
    const rows = range(7).map(row => `<div class="xc-pyr-row">${range(row + 1).map(col => {
      const i = row * (row + 1) / 2 + col, card = pyramid[i];
      return taken.has(i) ? '<span class="xc-pyr-space"></span>' : action('p-' + i, face(card), { className: 'xc-card xc-pyr-card' + red(card), name: `第${row + 1}层第${col + 1}张，${faceName(card)}`, selected: selected === String(i), disabled: !pyramidOpen(i, taken) });
    }).join('')}</div>`).join('');
    const top = waste.at(-1);
    ui.paint(facts([['塔牌已清', taken.size + ' / 28'], ['牌库', stock.length + ' 张']]) + `<div class="xc-pyramid">${rows}</div>`
      + zone('牌库与弃牌', action('draw', '翻一张 · ' + stock.length, { disabled: !stock.length }) + (waste.length ? action('p-waste', face(top), { name: '弃牌顶 ' + faceName(top), selected: selected === 'waste', className: 'xc-card' + red(top) }) : '<span class="xc-muted">弃牌堆为空</span>'), 'xc-actions'));
    api.status(note || '选择两张露出的牌凑十三；K 可直接拿走。');
  }
  draw();
}

const yachtNames = ['一点', '二点', '三点', '四点', '五点', '六点', '四同号', '小顺子', '大顺子', '葫芦', '任选', '游艇'];
const dieFaces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
export function yachtScore(dice, category) {
  const counts = range(7).map(n => dice.filter(value => value === n).length);
  if (category < 6) return counts[category + 1] * (category + 1);
  if (category === 6) return Math.max(0, counts.findIndex(n => n >= 4)) * 4;
  if (category === 7 || category === 8) return range(5).every(i => counts[i + category - 6] === 1) ? 30 : 0;
  if (category === 9) return counts.includes(3) && counts.includes(2) ? sum(dice) : 0;
  if (category === 10) return sum(dice);
  return counts.includes(5) ? 50 : 0;
}

export function mountYacht(host, api) {
  let dice = [0, 0, 0, 0, 0], held = new Set(), rolls = 0, round = 1, total = 0;
  const sheet = Array(12).fill(null), ui = table(host, api, click);
  function click(id) {
    if (id === 'roll' && rolls < 3 && held.size < 5) {
      dice = dice.map((v, i) => held.has(i) ? v : 1 + Math.floor(api.random() * 6)); rolls++;
    } else if (id.startsWith('die-') && rolls && rolls < 3) {
      const i = Number(id.slice(4)); if (held.has(i)) held.delete(i); else held.add(i);
    } else if (id.startsWith('score-') && rolls) {
      const i = Number(id.slice(6));
      if (sheet[i] !== null) return;
      sheet[i] = yachtScore(dice, i); total += sheet[i];
      if (round === 12) { draw(); ui.end(`十二格计分完成，总分 ${total} 分。`); return; }
      round++; rolls = 0; held.clear(); dice.fill(0);
    } else return;
    draw();
  }
  function draw() {
    const cubes = dice.map((value, i) => action('die-' + i, `<b>${value ? dieFaces[value - 1] : '·'}</b><small>${held.has(i) ? '保留' : value ? value + ' 点' : '待掷'}</small>`, {
      name: `第 ${i + 1} 颗，${value || '待掷'}${held.has(i) ? '，已保留' : ''}`, className: 'xc-die', selected: held.has(i), disabled: !rolls || rolls === 3,
    })).join('');
    const boxes = yachtNames.map((name, i) => action('score-' + i, `<span>${name}</span><strong>${sheet[i] ?? (rolls ? yachtScore(dice, i) : '—')}</strong>`, { className: 'xc-score' + (sheet[i] !== null ? ' xc-filled' : ''), disabled: !rolls || sheet[i] !== null, name: `${name}，${sheet[i] !== null ? '已记 ' + sheet[i] : rolls ? '可记 ' + yachtScore(dice, i) : '等待掷骰'}` })).join('');
    ui.paint(facts([['轮次', round + ' / 12'], ['本轮已掷', rolls + ' / 3'], ['总分', total]]) + zone('点选骰子保留', cubes, 'xc-dice')
      + `<div class="xc-actions">${action('roll', rolls ? '重掷未保留骰子' : '掷五颗骰子', { className: 'xc-primary', disabled: rolls >= 3 || held.size === 5 })}</div>` + zone('选择一格计分', boxes, 'xc-score-sheet'));
    api.status(!rolls ? '先掷骰，开始这一轮。' : rolls < 3 ? '点骰子可保留，也可以提前点计分格收分。' : '本轮已掷三次，请选择一格计分。');
  }
  draw();
}

const shapes = ['●', '▲', '◆'], shapeNames = ['圆', '三角', '菱形'], colors = ['青', '赭', '紫'];
const traits = card => [Math.floor(card / 9), Math.floor(card / 3) % 3, card % 3];
export function isAttributeSet(cards) {
  if (cards.length !== 3 || new Set(cards).size !== 3) return false;
  const parsed = cards.map(traits);
  return range(3).every(i => (parsed[0][i] + parsed[1][i] + parsed[2][i]) % 3 === 0);
}
export function firstAttributeSet(board) {
  for (let i = 0; i < board.length; i++)
    for (let j = i + 1; j < board.length; j++)
      for (let k = j + 1; k < board.length; k++) {
        const group = [board[i], board[j], board[k]];
        if (isAttributeSet(group)) return group;
      }
  return null;
}
export function mountSet(host, api) {
  const deck = shuffled(range(27), api.random), selected = new Set(), ui = table(host, api, click);
  let board = deck.splice(0, 9), collected = 0, note = '';
  function click(id) {
    if (id.startsWith('set-')) {
      const card = Number(id.slice(4));
      if (selected.has(card)) selected.delete(card); else if (selected.size < 3) selected.add(card);
      if (selected.size === 3) {
        if (isAttributeSet([...selected])) {
          board = board.filter(c => !selected.has(c)); selected.clear(); collected++;
          board.push(...deck.splice(0, Math.max(0, 9 - board.length))); note = '找到一组，已收牌。';
        } else note = '其中有属性出现“两同一异”，点选已选牌可更换。';
      } else note = '';
    } else if (id === 'more') {
      if (firstAttributeSet(board)) note = '桌面上仍有可组成的一组。';
      else { board.push(...deck.splice(0, 3)); selected.clear(); note = '桌面已补三张。'; }
    } else if (id === 'hint') {
      api.unrank(); const answer = firstAttributeSet(board); selected.clear();
      if (answer) { selected.add(answer[0]); selected.add(answer[1]); note = '已选好两张，请找出匹配的第三张。'; }
      else note = '桌面没有组合，可以补牌。';
    }
    draw();
    if (!deck.length && !firstAttributeSet(board)) ui.end(`桌面已无组合，共找到 ${collected} 组。`);
  }
  function draw() {
    const cells = board.map(card => {
      const [color, shape, count] = traits(card), label = `${count + 1} 个${colors[color]}色${shapeNames[shape]}`;
      return action('set-' + card, `<strong aria-hidden="true">${shapes[shape].repeat(count + 1)}</strong><small>${colors[color]} · ${shapeNames[shape]} · ${count + 1}</small>`, { className: 'xc-set xc-color-' + color, name: label, selected: selected.has(card), disabled: selected.size === 3 && !selected.has(card) });
    }).join('');
    ui.paint(facts([['找到的组', collected], ['牌库', deck.length + ' 张']]) + zone('选三张组成一组', cells, 'xc-set-board')
      + `<div class="xc-actions">${action('more', '没有一组，补三张', { disabled: !deck.length })}${action('hint', '提示两张')}</div>`);
    api.status(note || '逐项检查颜色、形状、数量，每项都要全同或全异。');
  }
  draw();
}
