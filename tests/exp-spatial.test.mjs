import assert from 'node:assert/strict';
import test from 'node:test';
import { games } from '../src/expansion/spatial-catalog.js';
import { mount } from '../src/expansion/spatial.js';
import { checkPipes, pegInitial, pegJump, pipeInitial, pipeSolved, rotatePipe, rollBlock, rollFootprint, rollInitial, rollMap } from '../src/expansion/spatial-grid-games.js';
import { bridgeChange, bridgeMaterial, gearDrive, testBridge } from '../src/expansion/spatial-machines.js';
import { tangramCells, tangramLayouts, tangramPieces, tangramPolygon } from '../src/expansion/spatial-tangram.js';
import { foldPaper, knotInitial, newPaper } from '../src/expansion/spatial-workshop.js';

const noop = () => {};
const context = new Proxy({}, { get: (target, key) => target[key] ?? noop });

class Element extends EventTarget {
  constructor(tagName) {
    super();
    this.tagName = tagName;
  }
  children = [];
  attributes = new Map();
  style = { setProperty: noop };
  dataset = {};
  className = '';
  textContent = '';
  classList = { toggle: (name, force) => {
    const classes = new Set(this.className.split(' '));
    if (force) classes.add(name);
    else classes.delete(name);
    this.className = Array.from(classes).filter(Boolean).join(' ');
  } };
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(key, value) { this.attributes.set(key, value); }
  getContext() { return context; }
  focus() {}
  click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
  key(key) { this.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key })); }
  byClass(name) { return this.find(node => node.className.split(' ').includes(name)); }
  byText(label) { return this.find(node => node.tagName === 'button' && node.textContent === label)[0]; }
  find(predicate) { return [...(predicate(this) ? [this] : []), ...this.children.flatMap(child => child.find(predicate))]; }
}

function start(id) {
  const host = new Element('div');
  const abort = new AbortController();
  const frames = new Set();
  const run = { host, abort, metric: null, status: '', ranked: true };
  globalThis.document = { createElement: tag => new Element(tag) };
  mount(id, host, {
    signal: abort.signal,
    elapsed: () => 18.49,
    status(value) { run.status = value; },
    unrank() { run.ranked = false; },
    frame(fn) { frames.add(fn); return () => frames.delete(fn); },
    end(message, metric) { run.metric = metric; abort.abort(); frames.clear(); },
  });
  run.tick = (dt) => [...frames].forEach(fn => fn(dt));
  return run;
}

test('空间解谜依次提供十个独立且可排名的游戏', () => {
  assert.deepEqual(games.map(game => game.name), [
    '七巧板', '激光镜阵', '解绳结', '滚动方块', '管道接通', '独立钻石棋', '天平配重', '齿轮机房', '折纸对孔', '桥梁承重',
  ]);
  assert.equal(new Set(games.map(game => game.id)).size, 10);
  assert.ok(games.every(game => game.metric.direction === 'asc'));
  for (const game of games) {
    const run = start(game.id);
    assert.ok(run.status, game.name);
    assert.equal(run.metric, null);
    run.abort.abort();
  }
});

test('七巧板用标准七片拼完十二幅不同剪影并记录整数用时', () => {
  assert.deepEqual(tangramPieces.map(shape => tangramCells(shape).length), [16, 16, 8, 8, 8, 4, 4]);
  const run = start('tangram');
  const board = run.host.byClass('sp-canvas')[0];
  const outlines = new Set();
  tangramLayouts.forEach(([name, layout], stage) => {
    const cells = layout.flatMap((placement, i) => tangramCells(tangramPolygon(i, placement)));
    assert.equal(new Set(cells).size, 64, name);
    outlines.add(cells.sort().join(';'));
    let x = 0;
    let y = 0;
    for (const [px, py, turns, flip] of layout) {
      while (x < px) { board.key('ArrowRight'); x++; }
      while (x > px) { board.key('ArrowLeft'); x--; }
      while (y < py) { board.key('ArrowDown'); y++; }
      while (y > py) { board.key('ArrowUp'); y--; }
      for (let i = 0; i < turns; i++) board.key('r');
      if (flip) board.key('f');
      board.key('Enter');
    }
    assert.match(run.status, /7 \/ 7 片 · 已完成/, name);
    if (stage < 11) run.host.byText('下一幅剪影').click();
  });
  assert.equal(outlines.size, 12);
  assert.equal(run.metric, 19);
  assert.equal(run.ranked, true);
  const practice = start('tangram');
  practice.host.byText('提示分块').click();
  assert.equal(practice.ranked, false);
  const selector = practice.host.find(node => node.tagName === 'select')[0];
  selector.value = '11';
  selector.dispatchEvent(new Event('change'));
  assert.match(practice.status, /12 \/ 12 图 · 短靴/);
  practice.abort.abort();
});

test('激光从错向开局转到三晶体完成，释放后镜面不响应', () => {
  const run = start('laser-mirrors');
  const mirrors = run.host.byClass('sp-cell');
  assert.match(run.status, /晶体 0 \/ 3/);
  for (const index of [22, 12, 40, 16, 20]) mirrors[index].click();
  assert.match(run.status, /晶体 3 \/ 3.*接收器点亮/);
  assert.equal(run.metric, 5);
  const restart = start('laser-mirrors');
  const oldMirror = restart.host.byClass('sp-cell')[22];
  const status = restart.status;
  restart.abort.abort();
  oldMirror.click();
  assert.equal(restart.status, status);
});

test('解绳结交换固定节点，全部连线消除交叉后得分', () => {
  const run = start('untangle-knots');
  const nodes = run.host.byClass('sp-node');
  const order = [...knotInitial];
  assert.match(run.status, /交叉 37 处/);
  let swaps = 0;
  for (let index = 0; index < order.length && run.metric === null; index++) {
    const other = order.indexOf(index);
    if (other === index) continue;
    nodes[index].click();
    nodes[other].click();
    [order[index], order[other]] = [order[other], order[index]];
    swaps++;
  }
  assert.match(run.status, /交叉 0 处/);
  assert.equal(run.metric, swaps);
});

test('滚动方块掉落回起点并保留步数，解答实际经过吊桥', () => {
  const run = start('rolling-block');
  const game = run.host.children[0];
  const arrows = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
  game.key('ArrowLeft');
  assert.match(run.status, /步数 1.*掉落/);
  let state = rollInitial();
  let usedBridge = false;
  let outcome;
  const solution = [...'2301221321111223'].map(Number);
  for (const direction of solution) {
    game.key(arrows[direction]);
    ({ state, outcome } = rollBlock(state, direction));
    usedBridge ||= rollFootprint(state).some(([x, y]) => rollMap[y][x] === 'b');
  }
  assert.equal(outcome, 'win');
  assert.ok(usedBridge);
  assert.equal(run.metric, solution.length + 1);
  assert.equal(rollBlock([4, 1, 1, false], 1).outcome, 'fall');
});

test('管网要求每一口相接且连回源阀', () => {
  assert.ok(checkPipes(pipeInitial).leaks > 0);
  assert.equal(checkPipes(pipeSolved).wet.size, 36);
  const disconnected = new Array(36).fill(0);
  disconnected[0] = 2;
  disconnected[1] = 8;
  assert.deepEqual(checkPipes(disconnected), { wet: new Set([0, 1]), leaks: 0, solved: false });
  const run = start('pipe-network');
  const cells = run.host.byClass('sp-cell');
  let turns = 0;
  for (let i = 0; i < cells.length && run.metric === null; i++) {
    let mask = pipeInitial[i];
    while (mask !== pipeSolved[i] && run.metric === null) {
      cells[i].click();
      mask = rotatePipe(mask);
      turns++;
    }
  }
  assert.ok(turns > 30);
  assert.equal(run.metric, turns);
});

test('独立钻石棋完成英式十字合法跳跃，最终仅中心有棋', () => {
  const run = start('diamond-solitaire');
  const cells = run.host.byClass('sp-cell');
  const pegs = pegInitial();
  assert.equal(pegJump(pegs, 16, 24), -1);
  const solution = [
    [10, 24], [15, 17], [2, 16], [4, 2], [17, 15], [14, 16], [18, 4], [20, 18],
    [23, 9], [2, 16], [21, 23], [25, 11], [4, 18], [39, 25], [18, 32], [27, 25],
    [25, 39], [34, 32], [31, 33], [29, 31], [16, 30], [31, 29], [28, 30], [45, 31],
    [24, 38], [46, 32], [33, 31], [31, 29], [44, 30], [29, 31], [38, 24],
  ];
  for (const [from, to] of solution) {
    const middle = pegJump(pegs, from, to);
    assert.ok(middle >= 0);
    pegs[from] = pegs[middle] = false;
    pegs[to] = true;
    cells[from].click();
    cells[to].click();
  }
  assert.equal(run.metric, 19);
  assert.match(run.status, /剩余 1 颗/);
});

test('天平用重量乘距离配平三台并保留总用时', () => {
  const run = start('balance-weights');
  const rack = run.host.byClass('sp-weight');
  const slots = run.host.byClass('sp-slot');
  for (const [stage, solution] of [[0, [3, 5, 6]], [1, [2, 5, 3, 6]], [2, [1, 2, 3, 5]]]) {
    solution.forEach((slot, weight) => {
      rack[weight].click();
      slots[slot].click();
    });
    assert.match(run.status, /已配平/);
    if (stage < 2) run.host.byText('下一台天平').click();
  }
  assert.equal(run.metric, 19);
});

test('齿轮要求动力连通、啮合一致且两个输出方向正确', () => {
  assert.ok(gearDrive([6, 11]).conflicts.size > 0);
  assert.equal(gearDrive([8, 11, 12, 17, 18, 23]).solved, false);
  const run = start('gear-room');
  const axles = run.host.byClass('sp-gear-node');
  function gear(index) {
    const label = `第 ${Math.floor(index / 5) + 1} 行第 ${index % 5 + 1} 列`;
    return axles.find(node => node.attributes.get('aria-label').startsWith(label));
  }
  gear(6).click();
  gear(11).click();
  run.host.byText('检查传动').click();
  assert.match(run.status, /传动卡死/);
  assert.equal(run.metric, null);
  gear(11).click();
  [7, 8, 13, 18, 23].forEach(index => gear(index).click());
  run.host.byText('检查传动').click();
  assert.equal(run.metric, 6);
});

test('折纸严格限制可折深度并核对打孔贯穿的所有纸层', () => {
  assert.equal(foldPaper(newPaper(), 'left', 4), null);
  const run = start('paper-fold-holes');
  const work = run.host.byClass('sp-paper-work')[0];
  run.host.byText('折左边').click();
  run.host.byText('折起 2 列').click();
  run.host.byText('折上边').click();
  run.host.byText('折起 2 行').click();
  work.children[0].click();
  work.children[1].click();
  assert.match(run.status, /孔位未对准/);
  run.host.byText('撤回操作').click();
  work.children[18].click();
  assert.match(run.status, /孔位全部对准/);
  run.host.byText('下一张图样').click();
  run.host.byText('折下边').click();
  run.host.byText('折起 3 行').click();
  run.host.byText('折右边').click();
  run.host.byText('折起 2 列').click();
  work.children[9].click();
  work.children[13].click();
  assert.equal(run.metric, 19);
});

test('桥梁拒绝失稳和过载，两个合格构造的材料量不同', () => {
  const lowCost = [[0,6],[2,6],[3,7],[4,8],[6,7],[7,8],[1,6],[2,7],[3,8]];
  const full = [[5,6],[6,7],[7,8],[8,9],[0,5],[1,6],[2,7],[3,8],[4,9],[1,5],[2,6],[2,8],[3,9]];
  const overload = [...full.slice(0, 9), [0,6],[1,7],[3,7],[4,8]];
  assert.equal(testBridge([]).reason, 'unstable');
  assert.equal(testBridge(overload).reason, 'overload');
  assert.match(bridgeChange([[0,6]], 1, 5).warning, /交叉/);
  assert.ok(testBridge(lowCost).passed);
  assert.ok(testBridge(full).passed);
  assert.equal(bridgeMaterial(lowCost), 106);
  assert.equal(bridgeMaterial(full), 146);
  const run = start('bridge-load');
  run.host.byText('测试承重').click();
  assert.match(run.status, /结构会松动/);
  const joints = run.host.byClass('sp-bridge-node');
  for (const [a, b] of lowCost) {
    joints[a].click();
    joints[b].click();
  }
  run.host.byText('测试承重').click();
  assert.match(run.status, /正在通过/);
  run.tick(2);
  assert.equal(run.metric, 106);
});
