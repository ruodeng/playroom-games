import { corners, jungleDens, jungleTraps, jungleWater, throne } from './boards-captures.js';
import { morrisLines, morrisPoints } from './boards-strategy.js';

const sizes = {
  xiangqi: [9, 10], chess: [8, 8], 'go-nine': [9, 9], jungle: [7, 9], checkers: [8, 8],
  kalah: [8, 2], 'nine-mens-morris': [7, 7], nim: [1, 4], tafl: [7, 7], isolation: [7, 7],
};
const camps = {
  xiangqi: ['红方', '黑方'], chess: ['白方', '黑方'], 'go-nine': ['黑棋', '白棋'], jungle: ['青方', '棕方'],
  checkers: ['深子', '浅子'], kalah: ['下排', '上排'], 'nine-mens-morris': ['深子', '浅子'],
  nim: ['先手', '后手'], tafl: ['守方', '攻方'], isolation: ['深子', '浅子'],
};
const animals = ['', '鼠', '猫', '狗', '狼', '豹', '虎', '狮', '象'];
const redPieces = ['', '帅', '仕', '相', '马', '车', '炮', '兵'];
const blackPieces = ['', '将', '士', '象', '马', '车', '炮', '卒'];
const chessNames = ['', '兵', '马', '象', '车', '后', '王'];
const chessGlyphs = ['', '♟', '♞', '♝', '♜', '♛', '♚'];

export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function position(id, i) {
  if (id === 'nine-mens-morris') return morrisPoints[i];
  if (id === 'kalah') {
    if (i === 13) return [0, 0.5];
    if (i === 6) return [7, 0.5];
    return i < 6 ? [i + 1, 1] : [13 - i, 0];
  }
  const [width] = sizes[id];
  return [i % width, Math.floor(i / width)];
}

function addLines(board, id, w, h) {
  const uri = 'http://www.w3.org/2000/svg';
  const layer = document.createElementNS(uri, 'svg');
  layer.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
  layer.setAttribute('preserveAspectRatio', 'none');
  layer.setAttribute('aria-hidden', 'true');
  layer.classList.add('brd-lines');
  const shape = (tag, attrs) => {
    const part = document.createElementNS(uri, tag);
    for (const [key, value] of Object.entries(attrs)) part.setAttribute(key, value);
    layer.append(part);
    return part;
  };
  const line = (x1, y1, x2, y2) => shape('line', { x1: x1 + 0.5, y1: y1 + 0.5, x2: x2 + 0.5, y2: y2 + 0.5 });
  if (id === 'nine-mens-morris') {
    for (const path of morrisLines) line(...morrisPoints[path[0]], ...morrisPoints[path[2]]);
    morrisPoints.forEach(([x, y]) => shape('circle', { cx: x + 0.5, cy: y + 0.5, r: 0.095 }));
  } else {
    for (let y = 0; y < h; y++) line(0, y, w - 1, y);
    for (let x = 0; x < w; x++) {
      if (id === 'xiangqi' && x > 0 && x < w - 1) { line(x, 0, x, 4); line(x, 5, x, 9); }
      else line(x, 0, x, h - 1);
    }
    if (id === 'xiangqi') {
      for (const y of [0, 7]) { line(3, y, 5, y + 2); line(5, y, 3, y + 2); }
      shape('text', { x: 2.5, y: 5.1, 'text-anchor': 'middle' }).textContent = '楚 河';
      shape('text', { x: 6.5, y: 5.1, 'text-anchor': 'middle' }).textContent = '汉 界';
    } else {
      for (const [x, y] of [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]]) shape('circle', { cx: x + 0.5, cy: y + 0.5, r: 0.09 });
    }
  }
  board.append(layer);
}

function terrain(id, i) {
  if (id === 'jungle') {
    if (jungleWater(i)) return ['water', '水域', ''];
    if (jungleDens.includes(i)) return ['den', i === 59 ? '你的兽穴' : '电脑兽穴', '穴'];
    if (jungleTraps.has(i)) return ['trap', jungleTraps.get(i) === 1 ? '你的陷阱' : '电脑陷阱', '陷'];
  }
  if (id === 'tafl') {
    if (corners.includes(i)) return ['gate', '逃生角', '门'];
    if (i === throne) return ['throne', '王座', '座'];
  }
  if (id === 'kalah' && (i === 6 || i === 13)) return ['store', i === 6 ? '你的粮仓' : '电脑粮仓', i === 6 ? '你仓' : '机仓'];
  return ['', '', ''];
}

function tileContents(id, i, p) {
  const rank = Math.abs(p), side = Math.sign(p);
  if (id === 'nim' || id === 'kalah') {
    const name = p + (id === 'nim' ? ' 颗石子' : ' 粒种子');
    return { side: 0, glyph: id === 'nim' ? '●'.repeat(p) : String(p), name, badge: id === 'nim' ? String(p) : '' };
  }
  if (!p) return { side: 0, glyph: '', name: '空位' };
  if (id === 'isolation' && p === 2) return { side: 0, glyph: '×', name: '已封住' };
  let glyph, name, badge;
  if (id === 'xiangqi') glyph = name = (side > 0 ? redPieces : blackPieces)[rank];
  else if (id === 'chess') { glyph = chessGlyphs[rank] + '\uFE0E'; name = chessNames[rank]; }
  else if (id === 'jungle') { glyph = name = animals[rank]; badge = String(rank); }
  else if (id === 'tafl') { glyph = side > 0 ? (p === 2 ? '王' : '卫') : '攻'; name = p === 2 ? '国王' : glyph === '卫' ? '卫士' : '攻兵'; }
  else if (id === 'isolation') { glyph = side > 0 ? '你' : '机'; name = '棋子'; }
  else if (id === 'checkers') { glyph = rank === 2 ? '王' : ''; name = rank === 2 ? '王棋' : '普通棋子'; }
  else { glyph = ''; name = camps[id][side > 0 ? 0 : 1]; }
  return { side, glyph, badge, name: (side > 0 ? '你的' : '电脑的') + name };
}

export function makeBoard(id, length, name) {
  const [w, h] = sizes[id], board = element('div', 'brd-board brd-' + id);
  board.style.setProperty('--brd-cols', w); board.style.setProperty('--brd-rows', h);
  board.setAttribute('role', 'group'); board.setAttribute('aria-label', name + '棋盘');
  board.setAttribute('aria-description', '用方向键选择棋位，按回车或空格确认。');
  if (['xiangqi', 'go-nine', 'nine-mens-morris'].includes(id)) addLines(board, id, w, h);
  const cells = Array.from({ length }, (_, i) => {
    const [x, y] = position(id, i), [land, landName, mark] = terrain(id, i);
    const button = element('button', 'brd-cell');
    button.type = 'button'; button.dataset.pos = i; button.tabIndex = i === 0 ? 0 : -1;
    button.style.gridColumn = String(x + 1);
    button.style.gridRow = y === 0.5 ? '1 / 3' : String(y + 1);
    const base = ['brd-cell', (x + y) % 2 === 1 ? 'brd-dark' : '', land ? 'brd-' + land : ''].filter(Boolean).join(' ');
    const markNode = element('span', 'brd-mark', id === 'nim' ? '第 ' + (i + 1) + ' 堆' : mark);
    const token = element('span', 'brd-token'), glyph = element('span', 'brd-glyph'), badge = element('small', 'brd-badge');
    token.append(glyph, badge); button.append(markNode, token); board.append(button);
    const where = id === 'nim' ? markNode.textContent : id === 'kalah' && land ? landName
      : id === 'chess' ? String.fromCharCode(97 + x) + (8 - y)
      : '第 ' + (y + 1) + ' 行第 ' + (x + 1) + ' 列';
    return { button, base, glyph, badge, where, x, y, landName };
  });
  function focusAt(i, activate = true) {
    cells.forEach(({ button }, n) => { button.tabIndex = n === i ? 0 : -1; });
    if (activate) cells[i].button.focus({ preventScroll: true });
  }
  function key(event) {
    const target = event.target.closest('[data-pos]');
    if (!target) return;
    const current = cells[Number(target.dataset.pos)];
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    let next;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = cells.length - 1;
    else if (dir) {
      const [dx, dy] = dir;
      let distance = Infinity;
      cells.forEach(({ x, y }, i) => {
        const ahead = (x - current.x) * dx + (y - current.y) * dy;
        const off = Math.abs(dx ? y - current.y : x - current.x);
        if (ahead > 0 && off <= (id === 'kalah' ? 0.5 : 0) && ahead + off < distance) { next = i; distance = ahead + off; }
      });
    } else return;
    event.preventDefault(); event.stopPropagation();
    if (next !== undefined) focusAt(next);
  }
  function draw(state, options) {
    const { selected, origins, targets, showDots, active } = options;
    cells.forEach((cell, i) => {
      const { side, glyph, badge, name: pieceName } = tileContents(id, i, state.board[i]);
      const target = targets.has(i), origin = origins.has(i);
      cell.glyph.textContent = glyph; cell.badge.textContent = badge || '';
      cell.button.className = [cell.base, side > 0 ? 'brd-human' : side < 0 ? 'brd-cpu' : '',
        selected === i ? 'brd-selected' : '', state.last?.to === i ? 'brd-last' : '',
        active && target && showDots ? 'brd-target' : '', active && (origin || target) ? 'brd-playable' : '',
        id === 'isolation' && state.board[i] === 2 ? 'brd-blocked' : ''].filter(Boolean).join(' ');
      cell.button.setAttribute('aria-label', [cell.where, cell.landName, pieceName, selected === i ? '已选中' : '', target && active ? '可选择' : ''].filter(Boolean).join('，'));
      cell.button.setAttribute('aria-disabled', String(!active || (!target && !origin && selected !== i)));
    });
  }
  return { board, cells, focusAt, key, draw };
}

export function header(id) {
  const bar = element('div', 'brd-head');
  const [human, cpu] = camps[id];
  const mine = element('span', 'brd-camp brd-mine', '你 · ' + human), theirs = element('span', 'brd-camp brd-theirs', '电脑 · ' + cpu);
  const stats = element('span', 'brd-stats');
  bar.append(mine, theirs, stats);
  return { bar, update(state, result) {
    mine.classList.toggle('brd-turn', !result && state.turn === 1); theirs.classList.toggle('brd-turn', !result && state.turn === -1);
    if (id === 'go-nine') stats.textContent = '提子 ' + state.captures.join(' 比 ') + ' · 白贴 6.5';
    else if (id === 'nine-mens-morris') stats.textContent = '待放 ' + state.reserve.join(' 比 ');
    else if (id === 'kalah') stats.textContent = '粮仓 ' + state.board[6] + ' 比 ' + state.board[13];
    else if (id === 'nim') stats.textContent = '桌上 ' + state.board.reduce((a, b) => a + b, 0) + ' 颗';
    else if (id === 'isolation') stats.textContent = '已封 ' + state.board.filter(p => p === 2).length + ' 格';
    else stats.textContent = '已行 ' + state.ply + ' 手';
  } };
}
