import { SNAKE_SPEEDS, createSnakeGame, startSnake, pauseSnake, turnSnake, stepSnake } from './snake.js';
import { createGameRecordTracker } from './record-hooks.js';

const RECORD_KEY = 'playroom.snake.best.v1';
const speedNames = { easy: '慢慢来', normal: '刚刚好', fast: '手速派' };
const keyDirections = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' };

export function createSnakeController() {
  const $ = selector => document.querySelector(selector);
  const view = $('#snake-view');
  const field = $('#snake-field');
  let game = createSnakeGame();
  let active = false;
  let speed = 'normal';
  const records = createGameRecordTracker('snake', view);
  let timer = null;
  let generation = 0;
  let best = 0;
  let storageAvailable = true;

  try {
    const record = Number(localStorage.getItem(RECORD_KEY));
    if (Number.isSafeInteger(record) && record >= 0 && record <= 3970) best = record;
  } catch { storageAvailable = false; }

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
    try { localStorage.setItem(RECORD_KEY, String(best)); storageAvailable = true; }
    catch { storageAvailable = false; }
  }

  function render() {
    records.updateLink(game, speed);
    const fragment = document.createDocumentFragment();
    game.snake.forEach((cell, index) => {
      const segment = document.createElement('span');
      segment.className = `snake-segment${index === 0 ? ' snake-head' : ''}`;
      segment.style.gridArea = `${cell.y + 1} / ${cell.x + 1}`;
      if (index === 0) segment.dataset.direction = game.direction;
      fragment.append(segment);
    });
    if (game.food) {
      const food = document.createElement('span');
      food.className = 'snake-food';
      food.style.gridArea = `${game.food.y + 1} / ${game.food.x + 1}`;
      fragment.append(food);
    }
    field.replaceChildren(fragment);
    field.setAttribute('aria-label', `贪吃蛇场地，蛇身 ${game.snake.length} 格，得分 ${game.score}`);
    text('#snake-score', game.score);
    text('#snake-best', best);
    text('#snake-length', game.snake.length);
    text('#snake-speed-label', speedNames[speed]);
    text('#snake-record-note', storageAvailable ? '最高分保存在当前浏览器' : '浏览器未允许保存，最高分仅在本次有效');

    const status = {
      ready: '准备就绪，点击开始游戏', running: `正在游戏 · 得分 ${game.score}`, paused: '游戏已暂停，点击继续游戏',
      over: `${game.reason === 'wall' ? '撞到边界' : '撞到自己'}，本局得分 ${game.score}`, won: `填满棋盘，通关！本局得分 ${game.score}`,
    }[game.status];
    text('#snake-status', status);
    $('#snake-status').dataset.state = game.status;
    $('#snake-overlay').hidden = game.status === 'running';
    text('#snake-overlay-title', { ready: '准备好，开吃。', paused: '休息一下。', over: '再来一口？', won: '满格快乐，通关了！' }[game.status] ?? '');
    text('#snake-overlay-description', {
      ready: '吃掉小点心，把快乐变长一点。', paused: '这一局还在，准备好就继续。',
      over: `${game.reason === 'wall' ? '差一点就转过弯了。' : '记得给自己留一条路。'}本局 ${game.score} 分。`,
      won: `你用 ${game.score} 分，填满了整个场地。`,
    }[game.status] ?? '');
    text('#snake-start', game.status === 'paused' ? '继续游戏' : game.status === 'ready' ? '开始游戏' : '再玩一次');
    text('#snake-pause', game.status === 'paused' ? '继续游戏' : '暂停游戏');
    $('#snake-pause').disabled = !['running', 'paused'].includes(game.status);
    $('#snake-restart').disabled = game.status === 'ready';
    view.querySelectorAll('[data-snake-speed]').forEach(button => {
      const selected = button.dataset.snakeSpeed === speed;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.disabled = ['running', 'paused'].includes(game.status);
    });
    view.querySelectorAll('[data-snake-direction]').forEach(button => { button.disabled = game.status !== 'running'; });
  }

  function schedule() {
    stopTimer();
    if (!active || document.hidden || game.status !== 'running') return;
    const id = generation;
    timer = setTimeout(() => {
      if (id !== generation || !active || document.hidden) return;
      game = stepSnake(game);
      records.observe(game, speed);
      rememberBest();
      render();
      schedule();
    }, SNAKE_SPEEDS[speed]);
  }

  function focusBoard() { $('#snake-play-area').focus({ preventScroll: true }); }

  function begin() {
    if (!active || document.hidden) return;
    if (['over', 'won'].includes(game.status)) { records.reset(); game = createSnakeGame(); }
    game = startSnake(game);
    records.begin(game, speed);
    render();
    focusBoard();
    schedule();
  }

  function pause() {
    records.pause();
    stopTimer();
    game = pauseSnake(game);
    render();
  }

  function togglePause() {
    if (game.status === 'running') pause();
    else if (game.status === 'paused') begin();
  }

  $('#snake-start').addEventListener('click', begin);
  $('#snake-pause').addEventListener('click', togglePause);
  $('#snake-restart').addEventListener('click', () => {
    pause();
    $('#snake-confirm-dialog').showModal();
  });
  $('#snake-confirm-restart').addEventListener('click', () => {
    $('#snake-confirm-dialog').close();
    stopTimer();
    game = createSnakeGame();
    records.reset();
    render();
    $('#snake-start').focus({ preventScroll: true });
  });
  $('#snake-rules-button').addEventListener('click', () => {
    pause();
    $('#snake-rules-dialog').showModal();
  });
  view.querySelectorAll('[data-snake-speed]').forEach(button => button.addEventListener('click', () => {
    if (['running', 'paused'].includes(game.status)) return;
    speed = button.dataset.snakeSpeed;
    render();
  }));
  view.querySelectorAll('[data-snake-direction]').forEach(button => button.addEventListener('click', () => {
    game = turnSnake(game, button.dataset.snakeDirection);
    focusBoard();
  }));

  document.addEventListener('keydown', event => {
    if (!active || document.querySelector('dialog[open]') || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (keyDirections[key]) {
      event.preventDefault();
      game = turnSnake(game, keyDirections[key]);
    } else if (key === ' ' && !event.target.closest('button, a, input, select, textarea')) {
      event.preventDefault();
      if (event.repeat) return;
      if (['ready', 'over', 'won'].includes(game.status)) begin();
      else togglePause();
    } else if (key === 'Escape' && game.status === 'running') pause();
  });

  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  document.addEventListener('playroom:pause-for-record', () => { if (active) pause(); });
  window.addEventListener('blur', () => { if (active) pause(); });
  window.addEventListener('pagehide', pause);
  window.addEventListener('storage', event => {
    if (event.key !== RECORD_KEY) return;
    const record = Number(event.newValue);
    if (Number.isSafeInteger(record) && record >= 0 && record <= 3970) {
      best = Math.max(best, record);
      text('#snake-best', best);
    }
  });
  render();
  return {
    setActive(value) {
      active = value;
      if (!active) pause();
    },
  };
}
