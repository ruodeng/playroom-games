import { games } from './boards-catalog.js';
import { chess, xiangqi } from './boards-chess.js';
import { checkers, jungle, tafl } from './boards-captures.js';
import { go } from './boards-go.js';
import { isolation, kalah, morris, nim } from './boards-strategy.js';
import { element, header, makeBoard } from './boards-view.js';

export const engines = {
  xiangqi, chess, 'go-nine': go, jungle, checkers, kalah, 'nine-mens-morris': morris, nim, tafl, isolation,
};

const promotions = { q: '后', r: '车', b: '象', n: '马' };
const levels = ['入门', '标准', '进阶'];

function command(label, cmd, value) {
  const button = element('button', 'brd-command', label);
  button.type = 'button'; button.dataset.cmd = cmd;
  if (value !== undefined) button.dataset.value = value;
  return button;
}

function instruction(id, state, selected, choices) {
  if (state.turn === -1) return state.checked ? '电脑正在应将…' : '轮到电脑思考…';
  if (choices.length) return id === 'nim' ? '从选中的石堆取走几颗？' : '兵已抵达底线，请选择升变棋子。';
  if (id === 'go-nine') return state.passes ? '电脑已停着。你可以继续落黑子，或停着数子。' : '点空交叉点落黑子，收完死子后可以停着。';
  if (id === 'kalah') {
    if (state.extra) return '最后一粒入仓，再选下排一个有种子的坑。';
    return state.caught ? '上一手收获 ' + state.caught + ' 粒。选下排一个坑播种。' : '点下排有种子的坑，向右开始播种。';
  }
  if (id === 'nim') return '先选一个石堆，再选要取走的颗数。';
  if (id === 'nine-mens-morris') {
    if (state.taking) return '你组成了磨坊，点一枚可取的对方棋子。';
    if (state.reserve[0]) return '点空位布子，你还有 ' + state.reserve[0] + ' 枚待放。';
    if (selected < 0 && state.board.filter(p => p === 1).length === 3) return '只剩三枚棋，选一枚飞到任意空点。';
  }
  if (id === 'isolation') return state.blocking ? '点任一空格，把它永久封住。' : '点相邻的标记格移动你的棋子。';
  if (id === 'checkers' && state.forced >= 0) return '这枚棋子还可以跳吃，点标出的落点继续。';
  if (state.checked) return selected < 0 ? '你被将军了，选择能应将的棋子。' : '选择标出的安全落点应将。';
  if (selected >= 0) return '点标出的落点走棋，再点所选棋子可取消。';
  if (id === 'checkers') return '选择一枚深色棋子，有跳吃机会时必须跳吃。';
  if (id === 'tafl') return '选择国王或卫士，把国王送往标有「门」的一角。';
  return '选择你的棋子，再点标出的落点。';
}

export function mount(id, host, api) {
  const engine = engines[id], game = games.find(item => item.id === id);
  if (!engine || !game) throw new Error('未知棋盘游戏 ' + id);
  api.unrank();
  let state = engine.create(), legal = [], result = null, selected = -1, choices = [], level = 1, confirming = false;
  let computerPending = false;
  const panel = element('section', 'brd-panel brd-game-' + id), info = header(id), view = makeBoard(id, state.board.length, game.name);
  const toolbar = element('div', 'brd-toolbar x-actions'), alternatives = element('div', 'brd-choices x-actions');
  panel.setAttribute('aria-label', game.name + '对弈');
  const levelButtons = [];
  if (id === 'xiangqi') {
    const difficulty = element('div', 'brd-difficulty');
    difficulty.setAttribute('role', 'group'); difficulty.setAttribute('aria-label', '电脑棋力');
    difficulty.append(element('span', 'brd-level-label', '棋力'));
    levels.forEach((name, n) => { const button = command(name, 'level', n); difficulty.append(button); levelButtons.push(button); });
    panel.append(difficulty);
  }
  const pass = id === 'go-nine' ? command('停着', 'pass') : null;
  const concede = command('认输', 'resign');
  if (pass) toolbar.append(pass);
  toolbar.append(concede);
  panel.append(info.bar, view.board, alternatives, toolbar);
  host.replaceChildren(panel);

  function draw() {
    const origins = new Set(), targets = new Set();
    const interactive = !result && !confirming && state.turn === 1;
    if (interactive) {
      for (const move of legal) {
        if (move.from !== undefined) origins.add(move.from);
        if (move.to !== undefined && (move.from === undefined || move.from === selected)) targets.add(move.to);
      }
    }
    const showDots = selected >= 0 || state.taking;
    view.draw(state, { selected, origins, targets, showDots, active: interactive });
    info.update(state, result);
    const message = result ? (result.winner > 0 ? '你赢了！' : result.winner < 0 ? '电脑获胜。' : '和棋。') + result.reason
      : confirming ? '确定认输并结束本局吗？' : instruction(id, state, selected, choices);
    api.status(message);
    levelButtons.forEach((button, n) => {
      button.setAttribute('aria-pressed', String(n === level));
      button.disabled = Boolean(state.ply || result || confirming);
    });
    if (pass) pass.disabled = !interactive;
    concede.hidden = Boolean(result || confirming);
    toolbar.hidden = Boolean(result || confirming);
    alternatives.replaceChildren();
    if (confirming) alternatives.append(command('继续对弈', 'cancel'), command('确认认输', 'confirm'));
    else choices.forEach((move, i) => {
      const label = id === 'nim' ? '取 ' + move.take + ' 颗' : '升' + promotions[move.promotion];
      alternatives.append(command(label, 'choice', i));
    });
    alternatives.hidden = !confirming && !choices.length;
    return message;
  }

  function scheduleComputer() {
    if (computerPending || confirming || result || state.turn !== -1) return;
    computerPending = true;
    let fired = false;
    const stop = api.every(() => {
      if (fired) return;
      fired = true;
      computerPending = false;
      if (typeof stop === 'function') stop();
      if (!api.signal.aborted && !result && !confirming && state.turn === -1) {
        play(engine.choose(state, legal, () => api.random(), level));
      }
    }, 520);
  }
  function refresh() {
    legal = engine.moves(state);
    result = engine.result(state, legal);
    selected = state.forced >= 0 && state.turn === 1 ? state.forced : -1;
    if (id === 'isolation' && state.turn === 1 && !state.blocking && !result) selected = state.board.indexOf(1);
    choices = [];
    const message = draw();
    if (result) api.end(message, null);
    else scheduleComputer();
  }
  function play(move) {
    if (result || !move || api.signal.aborted) return;
    state = engine.apply(state, move);
    refresh();
  }
  function pick(i) {
    if (state.turn !== 1 || confirming || result) return;
    choices = [];
    const at = legal.filter(move => move.to === i && (move.from === undefined || move.from === selected));
    if (at.length === 1) { play(at[0]); return; }
    if (at.length > 1) {
      choices = at; selected = i; draw();
      alternatives.querySelector('button')?.focus({ preventScroll: true });
      return;
    }
    const movable = legal.some(move => move.from === i);
    if (selected === i && id !== 'isolation' && state.forced !== i) selected = -1;
    else if (movable) selected = i;
    draw();
  }
  panel.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || !panel.contains(button) || button.disabled || result || api.signal.aborted) return;
    if (button.dataset.pos !== undefined) {
      const i = Number(button.dataset.pos);
      view.focusAt(i); pick(i); return;
    }
    const value = Number(button.dataset.value);
    switch (button.dataset.cmd) {
      case 'level': if (!state.ply && !confirming && levels[value]) { level = value; draw(); } break;
      case 'pass': if (state.turn === 1 && !confirming) play(legal.find(move => move.kind === 'pass')); break;
      case 'resign': confirming = true; choices = []; draw(); alternatives.firstElementChild.focus(); break;
      case 'cancel': confirming = false; draw(); concede.focus(); scheduleComputer(); break;
      case 'confirm':
        if (confirming) { confirming = false; result = { winner: -1, reason: '你已认输' }; api.end(draw(), null); }
        break;
      case 'choice':
        if (state.turn === 1 && !confirming && choices[value]) {
          const target = choices[value].to;
          play(choices[value]);
          view.focusAt(target);
        }
        break;
    }
  }, { signal: api.signal });
  view.board.addEventListener('keydown', view.key, { signal: api.signal });
  refresh();
  const first = legal.find(move => move.from !== undefined || move.to !== undefined);
  if (state.turn === 1 && first) view.focusAt(first.from ?? first.to, false);
}
