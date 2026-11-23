import { arrowIndex, control, directions, element, grid, keyboard, labelCell, seconds } from './spatial-ui.js';

const laserWidth = 7;
const laserStart = [0, 3, 1];
const laserTarget = 32;
const crystals = new Set([15, 10, 33]);
const walls = new Set([4, 28, 36, 42, 47]);
export const laserMirrors = new Map([
  [22, '\\'], [8, '/'], [12, '/'], [40, '\\'], [37, '\\'], [16, '\\'], [20, '/'], [34, '/'],
  [1, '\\'], [24, '/'], [41, '/'], [46, '\\'],
]);

export function traceLaser(mirrors) {
  const segments = new Map();
  const visited = new Set();
  const lit = new Set();
  let [x, y, direction] = laserStart;
  while (x >= 0 && x < laserWidth && y >= 0 && y < laserWidth) {
    const index = y * laserWidth + x;
    if (walls.has(index)) return { segments, lit, result: 'wall' };
    const key = index * 4 + direction;
    if (visited.has(key)) return { segments, lit, result: 'loop' };
    visited.add(key);
    const incoming = (direction + 2) % 4;
    let mask = (segments.get(index) ?? 0) | (1 << incoming);
    if (crystals.has(index)) lit.add(index);
    if (index === laserTarget) {
      segments.set(index, mask);
      return { segments, lit, result: lit.size === crystals.size ? 'win' : 'target' };
    }
    const mirror = mirrors.get(index);
    if (mirror === '/') direction ^= 1;
    if (mirror === '\\') direction = 3 - direction;
    mask |= 1 << direction;
    segments.set(index, mask);
    const [dx, dy] = directions[direction];
    x += dx;
    y += dy;
  }
  return { segments, lit, result: 'edge' };
}

const directionFlags = ['north', 'east', 'south', 'west'];

export function mountLaser(host, api) {
  const mirrors = new Map(laserMirrors);
  let moves = 0;
  let finished = false;
  const { cells } = grid(host, api, laserWidth, laserWidth, '激光镜阵棋盘', index => {
    if (finished || !mirrors.has(index)) return;
    mirrors.set(index, mirrors.get(index) === '/' ? '\\' : '/');
    moves++;
    draw();
  }, 'sp-laser');
  const tileParts = cells.map((cell, index) => {
    const arms = directionFlags.map(direction => element(cell, 'span', `sp-ray sp-${direction}`));
    const symbol = element(cell, 'span', 'sp-laser-symbol');
    if (!mirrors.has(index)) cell.disabled = true;
    return { arms, symbol };
  });

  function draw() {
    const { segments, lit, result } = traceLaser(mirrors);
    cells.forEach((cell, index) => {
      const { arms, symbol } = tileParts[index];
      const mirror = mirrors.get(index);
      const source = index === laserStart[1] * laserWidth + laserStart[0];
      const target = index === laserTarget;
      const crystal = crystals.has(index);
      const wall = walls.has(index);
      cell.classList.toggle('sp-mirror', Boolean(mirror));
      cell.classList.toggle('sp-wall', wall);
      cell.classList.toggle('sp-lit', lit.has(index) || (target && result === 'win'));
      symbol.textContent = mirror || (source ? '➤' : target ? '◎' : crystal ? '◇' : wall ? '▦' : '');
      arms.forEach((ray, direction) => { ray.hidden = !(segments.get(index) & 1 << direction); });
      const state = mirror ? `反射镜 ${mirror}` : source ? '光源' : target ? '接收器' : crystal ? (lit.has(index) ? '已点亮的晶体' : '晶体') : wall ? '墙' : '空格';
      labelCell(cell, index, laserWidth, state);
    });
    const status = { wall: '撞墙', loop: '形成回路', target: '晶体尚未集齐', edge: '射出边界', win: '接收器点亮' }[result];
    api.status(`晶体 ${lit.size} / ${crystals.size} · 转镜 ${moves} 次 · ${status}`);
    if (result === 'win') {
      finished = true;
      api.end('光束穿过了全部晶体，接收器点亮！', moves);
    }
  }
  draw();
}

export const rollMap = [
  '###.##...',
  '#S#.#gg##',
  '###...###',
  '##ss..###',
  '.####b###',
  '...#...##',
  '...#..G##',
];
const rollStart = [1, 1, 0, false];
export const rollInitial = () => [...rollStart];
const rollTile = (x, y) => rollMap[y]?.[x] ?? '.';

export function rollFootprint([x, y, posture]) {
  return posture === 0 ? [[x, y]] : [[x, y], [x + Number(posture === 1), y + Number(posture === 2)]];
}

export function rollBlock([x, y, posture, bridge], direction) {
  const [dx, dy] = directions[direction];
  const axis = dx ? 1 : 2;
  if (!posture) {
    x += dx < 0 ? 2 * dx : dx;
    y += dy < 0 ? 2 * dy : dy;
    posture = axis;
  } else if (posture === axis) {
    x += dx > 0 ? 2 * dx : dx;
    y += dy > 0 ? 2 * dy : dy;
    posture = 0;
  } else {
    x += dx;
    y += dy;
  }
  const tiles = rollFootprint([x, y, posture]).map(([c, r]) => rollTile(c, r));
  if (tiles.some(tile => tile === '.' || tile === 'b' && !bridge || tile === 'g' && !posture)) {
    return { state: rollInitial(), outcome: 'fall' };
  }
  if (!posture && tiles[0] === 's') bridge = !bridge;
  return { state: [x, y, posture, bridge], outcome: !posture && tiles[0] === 'G' ? 'win' : 'move' };
}

export function mountRolling(host, api) {
  let state = rollInitial();
  let steps = 0;
  let finished = false;
  const width = rollMap[0].length;
  const { board, cells } = grid(host, api, width, rollMap.length, '滚动方块棋盘', null, 'sp-rolling');
  board.tabIndex = 0;
  const block = element(board, 'span', 'sp-block');
  const actions = element(host, 'div', 'x-actions sp-direction-pad');
  const buttons = directions.map(([, , symbol, label], direction) => {
    const button = control(actions, api, symbol, () => move(direction));
    button.setAttribute('aria-label', `向${label}滚动`);
    return button;
  });
  keyboard(host, api, key => {
    const direction = arrowIndex(key);
    if (direction < 0) return false;
    move(direction);
    return true;
  });

  function draw(outcome = '') {
    const [x, y, posture, bridge] = state;
    cells.forEach((cell, index) => {
      const tile = rollTile(index % width, Math.floor(index / width));
      cell.dataset.tile = tile;
      cell.classList.toggle('sp-raised', tile === 'b' && bridge);
      cell.textContent = { S: '起', G: '◎', s: '↯', b: bridge ? '═' : '┄', g: '◇' }[tile] ?? '';
    });
    block.style.left = `${100 * x / width}%`;
    block.style.top = `${100 * y / rollMap.length}%`;
    block.style.width = `${100 * (posture === 1 ? 2 : 1) / width}%`;
    block.style.height = `${100 * (posture === 2 ? 2 : 1) / rollMap.length}%`;
    block.classList.toggle('sp-upright', !posture);
    block.textContent = posture ? '━' : '◆';
    board.setAttribute('aria-label', `方块在第 ${y + 1} 行第 ${x + 1} 列，${['竖直', '横向躺下', '纵向躺下'][posture]}`);
    api.status(`步数 ${steps} · 吊桥${bridge ? '已铺开' : '收起'}${outcome === 'fall' ? ' · 掉落，已回到起点' : ''}`);
  }

  function move(direction) {
    if (finished) return;
    steps++;
    const next = rollBlock(state, direction);
    state = next.state;
    draw(next.outcome);
    if (next.outcome === 'win') {
      finished = true;
      buttons.forEach(button => { button.disabled = true; });
      api.end('方块已在终点站稳！', steps);
    }
  }
  draw();
  board.focus({ preventScroll: true });
}

export const pipeWidth = 6;
const pipeSize = pipeWidth * pipeWidth;
const pipeSource = 0;

function neighbor(index, direction) {
  const [dx, dy] = directions[direction];
  const x = index % pipeWidth + dx;
  const y = Math.floor(index / pipeWidth) + dy;
  return x >= 0 && x < pipeWidth && y >= 0 && y < pipeWidth ? y * pipeWidth + x : -1;
}

function pipeLayout() {
  let seed = 71923;
  const pick = length => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return Math.floor(seed / 4294967296 * length);
  };
  const graph = new Array(pipeSize).fill(0);
  const visited = new Set([pipeSource]);
  const frontier = [pipeSource];
  const connect = (from, direction, to) => {
    graph[from] |= 1 << direction;
    graph[to] |= 1 << ((direction + 2) % 4);
  };
  while (frontier.length) {
    const i = pick(frontier.length);
    const from = frontier[i];
    const options = directions.map((_, d) => [d, neighbor(from, d)]).filter(([, to]) => to >= 0 && !visited.has(to));
    if (!options.length) {
      frontier.splice(i, 1);
      continue;
    }
    const [direction, to] = options[pick(options.length)];
    connect(from, direction, to);
    visited.add(to);
    frontier.push(to);
  }
  const gaps = graph.flatMap((mask, i) => [1, 2].filter(d => neighbor(i, d) >= 0 && !(mask & 1 << d)).map(d => [i, d]));
  for (let i = 0; i < 5; i++) {
    const [[from, direction]] = gaps.splice(pick(gaps.length), 1);
    connect(from, direction, neighbor(from, direction));
  }
  return graph;
}

export const pipeSolved = pipeLayout();
export const rotatePipe = mask => ((mask << 1) | (mask >> 3)) & 15;
export const pipeInitial = pipeSolved.map((mask, index) => {
  const turns = (index * index + Math.floor(index / 4) + 1) % 4;
  for (let i = 0; i < turns; i++) mask = rotatePipe(mask);
  return mask;
});

export function checkPipes(board) {
  const wet = new Set([pipeSource]);
  const wave = [pipeSource];
  let leaks = 0;
  for (let i = 0; i < board.length; i++) {
    for (let d = 0; d < 4; d++) {
      if ((board[i] & 1 << d) && !(board[neighbor(i, d)] & 1 << ((d + 2) % 4))) leaks++;
    }
  }
  for (const i of wave) {
    for (let d = 0; d < 4; d++) {
      const next = neighbor(i, d);
      if ((board[i] & 1 << d) && (board[next] & 1 << ((d + 2) % 4)) && !wet.has(next)) {
        wet.add(next);
        wave.push(next);
      }
    }
  }
  return { wet, leaks, solved: leaks === 0 && wet.size === board.length };
}

export function mountPipes(host, api) {
  const masks = [...pipeInitial];
  let turns = 0;
  let finished = false;
  const { cells } = grid(host, api, pipeWidth, pipeWidth, '管道棋盘', index => {
    if (finished || rotatePipe(masks[index]) === masks[index]) return;
    masks[index] = rotatePipe(masks[index]);
    turns++;
    draw();
  }, 'sp-pipes');
  const parts = cells.map((cell, index) => {
    const arms = directionFlags.map(direction => element(cell, 'span', `sp-pipe-arm sp-${direction}`));
    element(cell, 'span', 'sp-pipe-hub', index === pipeSource ? '源' : '');
    if (masks[index] === 15) cell.disabled = true;
    return arms;
  });

  function draw() {
    const { wet, leaks, solved } = checkPipes(masks);
    cells.forEach((cell, index) => {
      cell.classList.toggle('sp-wet', wet.has(index));
      const ports = [];
      parts[index].forEach((arm, d) => {
        arm.hidden = !(masks[index] & 1 << d);
        if (!arm.hidden) ports.push(directions[d][3]);
      });
      labelCell(cell, index, pipeWidth, `${index === pipeSource ? '源阀，' : ''}${ports.join('、')}开口，${wet.has(index) ? '通水' : '未通水'}`);
    });
    api.status(`已通 ${wet.size} / ${pipeSize} · 未接管口 ${leaks} 个 · 已转 ${turns} 次`);
    if (solved) {
      finished = true;
      api.end('全部管件已通水，没有漏口！', turns);
    }
  }
  draw();
}

const pegWidth = 7;
const center = 24;
const pegPlayable = index => {
  const x = index % pegWidth;
  const y = Math.floor(index / pegWidth);
  return x >= 0 && x < pegWidth && y >= 0 && y < pegWidth && (x >= 2 && x <= 4 || y >= 2 && y <= 4);
};
export const pegInitial = () => Array.from({ length: 49 }, (_, index) => pegPlayable(index) && index !== center);

export function pegJump(board, start, end) {
  if (!pegPlayable(start) || !pegPlayable(end) || !board[start] || board[end]) return -1;
  const dx = Math.abs(start % pegWidth - end % pegWidth);
  const dy = Math.abs(Math.floor(start / pegWidth) - Math.floor(end / pegWidth));
  const over = (start + end) / 2;
  return (dx === 2 && dy === 0 || dx === 0 && dy === 2) && board[over] ? over : -1;
}

const pegJumps = Array.from({ length: 49 }, (_, index) => [index - 2, index + 2, index - 14, index + 14]);

export function mountDiamond(host, api) {
  const pegs = pegInitial();
  const history = [];
  let selected = -1;
  let finished = false;
  const { cells } = grid(host, api, pegWidth, pegWidth, '独立钻石棋十字棋盘', choose, 'sp-pegs');
  const actions = element(host, 'div', 'x-actions');
  const undoButton = control(actions, api, '撤回一步', undo);
  keyboard(host, api, key => {
    if (key.toLowerCase() !== 'z') return false;
    undo();
    return true;
  });

  function choose(index) {
    if (finished || !pegPlayable(index)) return;
    if (pegs[index]) {
      selected = index === selected ? -1 : index;
    } else if (selected >= 0) {
      const over = pegJump(pegs, selected, index);
      if (over < 0) {
        api.status('请选择能跳过一颗棋子的空位。');
        return;
      }
      history.push([selected, over, index]);
      pegs[selected] = pegs[over] = false;
      pegs[index] = true;
      selected = -1;
    }
    draw();
  }

  function undo() {
    if (finished || !history.length) return;
    const [start, over, end] = history.pop();
    pegs[start] = pegs[over] = true;
    pegs[end] = false;
    selected = start;
    draw();
  }

  function draw() {
    const remaining = 32 - history.length;
    const stuck = !pegs.some((peg, start) => peg && pegJumps[start].some(end => pegJump(pegs, start, end) >= 0));
    cells.forEach((cell, i) => {
      cell.style.visibility = pegPlayable(i) ? '' : 'hidden';
      cell.disabled = !pegPlayable(i);
      cell.classList.toggle('sp-peg', pegs[i]);
      cell.classList.toggle('sp-selected', selected === i);
      cell.classList.toggle('sp-land', selected >= 0 && pegJump(pegs, selected, i) >= 0);
      labelCell(cell, i, pegWidth, `${i === center ? '中心，' : ''}${pegs[i] ? '有棋' : '空位'}`);
      cell.setAttribute('aria-pressed', String(selected === i));
      cell.textContent = pegs[i] ? '◆' : i === center ? '◎' : '·';
    });
    undoButton.disabled = history.length === 0;
    api.status(`剩余 ${remaining} 颗${stuck && (remaining !== 1 || !pegs[center]) ? ' · 已无可走，撤回一步可继续' : ''}`);
    if (remaining === 1 && pegs[center]) {
      finished = true;
      undoButton.disabled = true;
      api.end('最后一颗钻石落回了棋盘中心！', seconds(api));
    }
  }
  draw();
}
