import { coordinate, directions, element, makeBoard, neighbors, paint, setup } from './strategy-view.js';

const WIDTH = 7;
const HEIGHT = 6;
const MAP = [
  '###...G',
  '##..甲.#',
  '##.####',
  '乙.丙..##',
  '.#..###',
  'S######',
].join('');
const COMMANDS = {
  forward: { name: '前进', mark: 'F' },
  left: { name: '左转', mark: 'L' },
  right: { name: '右转', mark: 'R' },
};
const BEACONS = new Set(['甲', '乙', '丙']);
const MAX_COMMANDS = 32;

export function expandProgram(program) {
  return program.flatMap(({ command, repeat, sequence }, index) => command ? [{ command, index }]
    : Array.from({ length: repeat }, () => sequence.map(item => ({ command: item, index }))).flat());
}

export function programSize(program) {
  return program.reduce((count, item) => count + 1 + (item.sequence?.length ?? 0), 0);
}

export function roverState() {
  const at = MAP.indexOf('S');
  return { at, heading: 0, reached: new Set(), trail: new Set([at]) };
}

export function moveRover(state, command) {
  if (command === 'left' || command === 'right') {
    const heading = (state.heading + (command === 'left' ? 3 : 1)) % 4;
    return { ...state, heading };
  }
  const at = neighbors(state.at, WIDTH, HEIGHT)[state.heading];
  if (at < 0 || MAP[at] === '#') return null;
  const reached = new Set(state.reached);
  if (BEACONS.has(MAP[at])) reached.add(at);
  return { ...state, at, reached, trail: new Set([...state.trail, at]) };
}

export function roverFinished(state) {
  return MAP[state.at] === 'G' && state.reached.size === BEACONS.size;
}

export function mountRover(host, api) {
  const view = setup(host, api, 'rover');
  const { cells } = makeBoard(view, view.root, WIDTH, HEIGHT, '探险车地面图');
  const palette = element(view.root, 'div', 'x-actions');
  const loops = element(view.root, 'div', 'x-actions');
  const listing = element(view.root, 'ul', 'strategy-program');
  listing.setAttribute('aria-label', '程序顺序');
  const actions = element(view.root, 'div', 'x-actions');
  let state = roverState();
  let program = [];
  let repeat = null;
  let running = null;
  let current = -1;
  const commandButtons = Object.entries(COMMANDS).map(([command, item]) => view.button(
    palette, `${item.name} ${item.mark}`, () => {
      if (repeat) repeat.sequence.push(command);
      else program.push({ command });
      draw();
    },
  ));
  const loopButtons = [2, 3].map(count => view.button(loops, `开始重复 ${count} 次`, () => {
    repeat = { repeat: count, sequence: [] };
    program.push(repeat);
    draw();
    view.status(`正在编辑 ${count} 次重复块，添加指令后选择结束重复块。`);
  }));
  const closeLoop = view.button(loops, '结束重复块', () => {
    repeat = null;
    draw();
    view.status('已结束重复块。');
  });
  const remove = view.button(actions, '删除末项', () => {
    if (repeat?.sequence.length) repeat.sequence.pop();
    else {
      program.pop();
      repeat = null;
    }
    draw();
  });
  const clear = view.button(actions, '清空程序', () => {
    program = [];
    repeat = null;
    current = -1;
    state = roverState();
    draw();
  });
  const run = view.button(actions, '运行程序', () => {
    state = roverState();
    running = { instructions: expandProgram(program), step: 0 };
    current = -1;
    draw();
    view.status('探险车开始执行程序。');
  });

  function draw() {
    const total = programSize(program);
    view.stats([`信标 ${state.reached.size}/3`, `程序 ${total} 条`, `位置 ${coordinate(state.at, WIDTH)}`]);
    cells.forEach((cell, i) => {
      const type = MAP[i];
      const hasRover = i === state.at;
      const isBeacon = BEACONS.has(type);
      const symbol = hasRover ? directions[state.heading].arrow : type === '#' ? '▲' : isBeacon ? type : type === 'G' ? '舱' : type === 'S' ? '起' : '·';
      const label = hasRover ? `探险车${directions[state.heading].label}` : type === '#' ? '岩壁' : isBeacon ? `信标 ${type}` : type === 'G' ? '返回舱' : type === 'S' ? '起点' : '通道';
      const kind = hasRover ? 'is-player' : type === '#' ? 'is-blocked' : state.reached.has(i) ? 'is-scanned' : isBeacon || type === 'G' ? 'is-target' : state.trail.has(i) ? 'is-path' : 'is-clear';
      paint(cell, symbol, `${coordinate(i, WIDTH)} ${label}`, kind);
    });
    listing.replaceChildren();
    for (const [index, item] of program.entries()) {
      const title = item.command ? COMMANDS[item.command].name
        : `重复 ${item.repeat} 次 [${item.sequence.map(command => COMMANDS[command].mark).join(' ') || '空'}]`;
      const chip = element(listing, 'li', current === index ? 'is-current' : '', title + (item === repeat ? ' · 编辑中' : ''));
      if (current === index) chip.setAttribute('aria-current', 'step');
    }
    if (!program.length) element(listing, 'li', 'is-empty', '待添加指令');
    for (const button of commandButtons) button.disabled = Boolean(running) || total >= MAX_COMMANDS;
    for (const button of loopButtons) button.disabled = Boolean(running || repeat) || total >= MAX_COMMANDS - 1;
    closeLoop.disabled = Boolean(running) || !repeat?.sequence.length;
    remove.disabled = clear.disabled = Boolean(running) || program.length === 0;
    run.disabled = Boolean(running || repeat) || program.length === 0;
  }

  api.every(() => {
    if (!running) return;
    const instruction = running.instructions[running.step];
    current = instruction.index;
    const next = moveRover(state, instruction.command);
    if (!next) {
      running = null;
      draw();
      view.status('前进撞上岩壁。检查高亮的指令，修改后可从起点重试。');
      return;
    }
    state = next;
    running.step++;
    if (running.step === running.instructions.length) {
      running = null;
      draw();
      if (roverFinished(state)) {
        const score = programSize(program);
        view.end('三个信标全部访问，已成功返航。', score);
      } else {
        view.status(state.reached.size < BEACONS.size ? '程序结束，仍有信标未访问。' : '信标都已访问，探险车还需停到返回舱。');
      }
    } else {
      draw();
    }
  }, 300);
  draw();
  view.status('探险车从地图左下角向上出发。编排指令，经过三个信标后停到返回舱。');
}
