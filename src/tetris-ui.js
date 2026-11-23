import { createTetrisGame, startTetris, pauseTetris, stepTetris, moveTetris, rotateTetris, hardDropTetris, landingPiece, pieceCells, fallInterval } from './tetris.js';
import { createGameRecordTracker } from './record-hooks.js';

const RECORD_KEY = 'playroom.tetris.best.v1';
const validRecord = value => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0;

export function createTetrisController() {
  const $ = selector => document.querySelector(selector);
  const view = $('#tetris-view');
  const records = createGameRecordTracker('tetris', view);
  const field = $('#tetris-field');
  let game = createTetrisGame();
  let active = false;
  let timer = null;
  let generation = 0;
  let best = 0;
  let storageAvailable = true;
  try { best = validRecord(localStorage.getItem(RECORD_KEY)); }
  catch { storageAvailable = false; }

  function text(selector, value) {
    const element = $(selector);
    if (element.textContent !== String(value)) element.textContent = value;
  }

  function stopTimer() {
    generation++;
    clearTimeout(timer);
    timer = null;
  }

  function rememberBest() {
    if (game.score <= best) return;
    best = game.score;
    try {
      best = Math.max(best, validRecord(localStorage.getItem(RECORD_KEY)));
      localStorage.setItem(RECORD_KEY, String(best));
      storageAvailable = true;
    } catch { storageAvailable = false; }
  }

  function block(type, x, y, variant = '') {
    const cell = document.createElement('span');
    cell.className = `tetromino tetromino-${type} ${variant}`;
    cell.style.gridArea = `${y + 1} / ${x + 1}`;
    return cell;
  }

  function render() {
    records.updateLink(game);
    const fragment = document.createDocumentFragment();
    game.board.forEach((row, y) => row.forEach((type, x) => {
      if (type) fragment.append(block(type, x, y, 'tetromino-fixed'));
    }));
    const landing = landingPiece(game);
    if (landing) {
      for (const cell of pieceCells(landing)) {
        if (cell.y >= 0) fragment.append(block(landing.type, cell.x, cell.y, 'tetromino-ghost'));
      }
      for (const cell of pieceCells(game.current)) {
        if (cell.y >= 0) fragment.append(block(game.current.type, cell.x, cell.y, 'tetromino-active'));
      }
    }
    field.replaceChildren(fragment);
    field.setAttribute('aria-label', `俄罗斯方块场地，得分 ${game.score}，已消除 ${game.lines} 行${game.current ? `，当前 ${game.current.type} 形方块` : ''}`);
    $('#tetris-next').replaceChildren(...game.queue.slice(0, 3).map((type, index) => {
      const preview = document.createElement('div');
      preview.className = 'tetris-preview-grid';
      preview.setAttribute('role', 'img');
      preview.setAttribute('aria-label', `接下来第 ${index + 1} 个：${type} 形方块`);
      const cells = pieceCells({ type, rotation: 0, x: 0, y: 0 });
      const minX = Math.min(...cells.map(cell => cell.x));
      const minY = Math.min(...cells.map(cell => cell.y));
      const width = Math.max(...cells.map(cell => cell.x)) - minX + 1;
      const height = Math.max(...cells.map(cell => cell.y)) - minY + 1;
      for (const cell of cells) preview.append(block(type, cell.x - minX + Math.floor((4 - width) / 2), cell.y - minY + Math.floor((4 - height) / 2)));
      return preview;
    }));
    text('#tetris-score', game.score);
    text('#tetris-lines', game.lines);
    text('#tetris-level', game.level);
    text('#tetris-best', best);
    text('#tetris-record-note', storageAvailable ? '最高分保存在当前浏览器' : '浏览器未允许保存，最高分仅在本次有效');
    text('#tetris-status', {
      ready: '准备就绪，开始拼好这一局', paused: '已暂停，准备好就继续', over: `方块到顶了，本局 ${game.score} 分`,
      running: game.lastClear ? `消除 ${game.lastClear} 行，继续保持！` : '左右移动，找一个刚好的位置',
    }[game.status]);
    $('#tetris-status').dataset.state = game.status;
    $('#tetris-overlay').hidden = game.status === 'running';
    text('#tetris-overlay-title', { ready: '拼好每一刻。', paused: '留一点空隙。', over: '再拼一局？' }[game.status] ?? '');
    text('#tetris-overlay-description', {
      ready: '转个方向，总有合适的位置。', paused: '方块会等你，准备好再继续。',
      over: `本局 ${game.score} 分，消除了 ${game.lines} 行。`,
    }[game.status] ?? '');
    text('#tetris-start', game.status === 'paused' ? '继续游戏' : game.status === 'over' ? '再玩一次' : '开始游戏');
    text('#tetris-pause', game.status === 'paused' ? '继续游戏' : '暂停游戏');
    $('#tetris-pause').disabled = !['running', 'paused'].includes(game.status);
    $('#tetris-restart').disabled = game.status === 'ready';
    view.querySelectorAll('[data-tetris-action]').forEach(button => { button.disabled = game.status !== 'running'; });
  }

  function schedule() {
    stopTimer();
    if (!active || document.hidden || game.status !== 'running') return;
    const id = generation;
    timer = setTimeout(() => {
      if (id !== generation || !active || document.hidden) return;
      game = stepTetris(game);
      records.observe(game);
      rememberBest();
      render();
      schedule();
    }, fallInterval(game.level));
  }

  function focusBoard() { $('#tetris-play-area').focus({ preventScroll: true }); }
  function begin() {
    if (!active || document.hidden) return;
    if (game.status === 'over') { records.reset(); game = createTetrisGame(); }
    game = startTetris(game);
    records.begin(game);
    render();
    focusBoard();
    schedule();
  }
  function pause() {
    records.pause();
    stopTimer();
    game = pauseTetris(game);
    render();
  }
  function togglePause() {
    if (game.status === 'running') pause();
    else if (game.status === 'paused') begin();
  }
  function act(action) {
    if (!active || game.status !== 'running') return;
    const previous = game;
    if (action === 'left') game = moveTetris(game, -1);
    else if (action === 'right') game = moveTetris(game, 1);
    else if (action === 'rotate') game = rotateTetris(game);
    else if (action === 'reverse') game = rotateTetris(game, -1);
    else if (action === 'down') game = stepTetris(game, Math.random, true);
    else if (action === 'drop') game = hardDropTetris(game);
    if (game === previous) return;
    records.observe(game);
    rememberBest();
    render();
    // Lateral moves do not reset gravity; a new piece gets a fresh fall interval.
    if (game.status !== 'running') stopTimer();
    else if (game.pieces !== previous.pieces) schedule();
  }

  $('#tetris-start').addEventListener('click', begin);
  $('#tetris-pause').addEventListener('click', togglePause);
  $('#tetris-restart').addEventListener('click', () => {
    pause();
    $('#tetris-confirm-dialog').showModal();
  });
  $('#tetris-confirm-restart').addEventListener('click', () => {
    $('#tetris-confirm-dialog').close();
    stopTimer();
    game = createTetrisGame();
    records.reset();
    render();
    $('#tetris-start').focus({ preventScroll: true });
  });
  $('#tetris-rules-button').addEventListener('click', () => {
    pause();
    $('#tetris-rules-dialog').showModal();
  });
  view.querySelectorAll('[data-tetris-action]').forEach(button => button.addEventListener('click', () => {
    act(button.dataset.tetrisAction);
    focusBoard();
  }));
  document.addEventListener('keydown', event => {
    if (!active || document.querySelector('dialog[open]') || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input, select, textarea')) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === 'p' || key === 'Escape') {
      event.preventDefault();
      if (!event.repeat) togglePause();
      return;
    }
    if (key === ' ' && event.target.closest('button, a')) return;
    const action = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowDown: 'down', s: 'down', ArrowUp: 'rotate', w: 'rotate', x: 'rotate', z: 'reverse', ' ': 'drop' }[key];
    if (!action) return;
    event.preventDefault();
    if (event.repeat && ['drop', 'rotate', 'reverse'].includes(action)) return;
    act(action);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  document.addEventListener('playroom:pause-for-record', () => { if (active) pause(); });
  window.addEventListener('blur', () => { if (active) pause(); });
  window.addEventListener('pagehide', pause);
  window.addEventListener('storage', event => {
    if (event.key === RECORD_KEY) { best = Math.max(best, validRecord(event.newValue)); text('#tetris-best', best); }
  });
  render();
  return {
    setActive(value) {
      active = value;
      if (!active) pause();
    },
  };
}
