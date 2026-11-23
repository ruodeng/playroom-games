import { SIZE, BLACK, WHITE, createGame, placeStone, undoMoves, undoCount, coordinate, chooseMove } from './gomoku.js';
import { DEFAULT_SETTINGS, restoreSession } from './session.js';
import { createSnakeController } from './snake-ui.js';
import { createTetrisController } from './tetris-ui.js';
import { createArcadeController } from './arcade-ui.js';
import { createRecordsController } from './records-ui.js';
import { createExpansionController } from './expansion-runtime.js';
import { initLobbyFilters } from './lobby-filters.js';
import { mountStaticViews } from './site-games.js';
import { SITE_ORIGIN } from './site-pages.js';
import { startNavigation } from './site-navigation.js';
import { initAnalytics } from './site-analytics.js';

mountStaticViews();

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const STORAGE_KEY = 'playroom.gomoku.v1';
const difficultyDescriptions = { easy: '轻松落子，享受每一步。', normal: '有来有回，刚刚好的挑战。', hard: '多想一步，和棋友认真过招。' };
let game = createGame();
let settings = { ...DEFAULT_SETTINGS };
let draftSettings;
let preferences = { sound: false, numbers: false };
let focusedIndex = 112;
let aiWorker = null;
let aiTimer = null;
let aiRequestId = 0;
let aiError = false;
let toastTimer;
let audioContext;
let storageAvailable = true;
let restored = false;
let restoreFailed = false;
let migratedLocal = false;
const cells = [];

function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = restoreSession(JSON.parse(raw));
    game = saved.game;
    settings = saved.settings;
    preferences = saved.preferences;
    migratedLocal = saved.migratedLocal;
    restored = game.moves.length > 0;
    const last = game.moves.at(-1);
    if (last) focusedIndex = last.row * SIZE + last.col;
  } catch (error) {
    if (error.name === 'SecurityError') storageAvailable = false;
    else restoreFailed = true;
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, settings, moves: game.moves, preferences }));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  $('#save-status').innerHTML = storageAvailable ? '<svg class="icon"><use href="#icon-check"/></svg>对局自动保存' : '浏览器未允许保存，刷新将丢失进度';
}

function notify(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3200);
}

function isComputerTurn() {
  return game.turn !== settings.humanPlayer && !game.winner && !game.draw;
}

function playerName(player) {
  return player === settings.humanPlayer ? '你' : '片刻棋友';
}

function createBoard() {
  const renderedCells = $$('#board .cell');
  if (renderedCells.length === SIZE * SIZE) {
    cells.push(...renderedCells);
    return;
  }
  let lines = '';
  for (let index = 0; index < SIZE; index++) {
    const position = 20 + index * 40;
    lines += `<path d="M20 ${position}H580M${position} 20V580"/>`;
    const column = document.createElement('span');
    column.textContent = String.fromCharCode(65 + index);
    $('#column-labels').append(column);
    const row = document.createElement('span');
    row.textContent = SIZE - index;
    $('#row-labels').append(row);
  }
  for (const [row, col] of [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]]) {
    lines += `<circle class="star-point" cx="${20 + col * 40}" cy="${20 + row * 40}" r="3.6"/>`;
  }
  $('#board-lines').innerHTML = lines;
  for (let row = 0; row < SIZE; row++) {
    const rowElement = document.createElement('div');
    rowElement.className = 'board-row';
    rowElement.setAttribute('role', 'row');
    rowElement.setAttribute('aria-rowindex', row + 1);
    for (let col = 0; col < SIZE; col++) {
      const cell = document.createElement('button');
      cell.className = 'cell';
      cell.type = 'button';
      cell.dataset.index = row * SIZE + col;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-colindex', col + 1);
      rowElement.append(cell);
      cells.push(cell);
    }
    $('#board').append(rowElement);
  }
}

function render(newIndex = -1) {
  const finished = !!game.winner || game.draw;
  const computerTurn = isComputerTurn();
  const last = game.moves.at(-1);
  const lastIndex = last ? last.row * SIZE + last.col : -1;
  const moveNumbers = new Map(game.moves.map((move, index) => [move.row * SIZE + move.col, index + 1]));
  const board = $('#board');
  board.dataset.turn = game.turn;
  board.setAttribute('aria-disabled', String(finished || computerTurn));
  board.setAttribute('aria-busy', String(computerTurn && !aiError));
  board.classList.toggle('show-numbers', preferences.numbers);
  for (let index = 0; index < cells.length; index++) {
    const cell = cells[index];
    const value = game.board[index];
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    cell.tabIndex = index === focusedIndex ? 0 : -1;
    cell.dataset.player = value;
    cell.setAttribute('aria-disabled', String(!!value || finished || computerTurn));
    cell.setAttribute('aria-label', `${coordinate(row, col)}，${value ? `${value === BLACK ? '黑棋' : '白棋'}，第 ${moveNumbers.get(index)} 手` : '空位'}${game.winningLine.includes(index) ? '，获胜连线' : ''}`);
    cell.classList.toggle('last-move', index === lastIndex);
    cell.classList.toggle('winning', game.winningLine.includes(index));
    if (value) {
      const span = document.createElement('span');
      span.className = `stone stone-${value === BLACK ? 'black' : 'white'}${index === newIndex ? ' just-placed' : ''}`;
      span.textContent = preferences.numbers ? moveNumbers.get(index) : '';
      span.setAttribute('aria-hidden', 'true');
      cell.replaceChildren(span);
    } else cell.replaceChildren();
  }

  for (const [color, player] of [['black', BLACK], ['white', WHITE]]) {
    $(`#${color}-name`).textContent = playerName(player);
    const active = !finished && game.turn === player;
    $(`#${color}-player`).classList.toggle('active', active);
    $(`#${color}-turn`).hidden = !active;
    $(`#${color}-turn`).textContent = computerTurn ? '思考中' : '落子中';
  }
  let status;
  if (game.winner) status = `${playerName(game.winner)}${game.winner === settings.humanPlayer ? '赢了' : '获胜'}！${game.winner === BLACK ? '黑棋' : '白棋'}连成五子，再来一局吧`;
  else if (game.draw) status = '棋逢对手，这一局是和棋。再来一局吧';
  else if (computerTurn) status = aiError ? '棋友暂时走神了，请重试这一手' : '片刻棋友正在思考，下一手会落在哪里？';
  else status = game.moves.length ? '轮到你了，慢慢想，好棋不着急' : '轮到你了，落下第一颗黑棋';
  $('#game-status').textContent = status;
  $('.board-status').classList.toggle('is-finished', finished);
  $('.board-status').classList.toggle('thinking', computerTurn && !aiError);
  $('#retry-ai').hidden = !aiError || !computerTurn;
  $('#move-count').textContent = game.moves.length;
  $('#last-move').textContent = last ? `上一手 ${coordinate(last.row, last.col)}` : '等待第一手';
  $('#undo-button').disabled = undoCount(game, settings.humanPlayer) === 0;
  $('#sound-button').setAttribute('aria-pressed', String(preferences.sound));
  $('#sound-button').setAttribute('aria-label', preferences.sound ? '关闭落子音效' : '开启落子音效');
  $('#sound-button').title = preferences.sound ? '关闭落子音效' : '开启落子音效';
  $('#show-numbers').checked = preferences.numbers;
  renderHistory();
}

function renderHistory() {
  const history = $('#move-history');
  history.replaceChildren();
  if (!game.moves.length) {
    history.innerHTML = '<p class="history-empty">故事，从第一手开始。</p>';
    return;
  }
  game.moves.slice().reverse().forEach((move, index) => {
    const row = document.createElement('div');
    row.className = 'history-row';
    row.innerHTML = `<span class="history-index">${String(game.moves.length - index).padStart(2, '0')}</span><i class="mini-stone ${move.player === BLACK ? 'black' : 'white'}" aria-hidden="true"></i><span>${move.player === BLACK ? '黑棋' : '白棋'}</span><span class="history-coordinate">${coordinate(move.row, move.col)}</span>`;
    history.append(row);
  });
  history.scrollTop = 0;
}

function renderSettings() {
  $$('[data-difficulty]').forEach(button => {
    const selected = button.dataset.difficulty === draftSettings.difficulty;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  $$('[data-side]').forEach(button => {
    const selected = Number(button.dataset.side) === draftSettings.humanPlayer;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  $('#difficulty-description').textContent = difficultyDescriptions[draftSettings.difficulty];
  const changed = Object.keys(DEFAULT_SETTINGS).some(key => draftSettings[key] !== settings[key]);
  $('#settings-note').textContent = changed ? '新设置将在开始新对局后生效' : '随时开局，尽兴就好';
}

function cancelAI() {
  aiRequestId++;
  clearTimeout(aiTimer);
  aiWorker?.terminate();
  aiWorker = null;
  aiError = false;
}

function applyMove(row, col) {
  const next = placeStone(game, row, col);
  if (!next) return false;
  game = next;
  render(row * SIZE + col);
  save();
  playSound();
  return true;
}

function scheduleAI() {
  if (!isComputerTurn()) return;
  aiError = false;
  render();
  const id = ++aiRequestId;
  const complete = move => {
    if (id !== aiRequestId || !isComputerTurn()) return;
    if (!move || !applyMove(move.row, move.col)) {
      aiError = true;
      render();
    }
  };
  const fallback = () => {
    if (id !== aiRequestId || !isComputerTurn()) return;
    aiWorker?.terminate();
    aiWorker = null;
    try { complete(chooseMove(game, settings.difficulty)); }
    catch { aiError = true; render(); }
  };
  aiTimer = setTimeout(() => {
    if (id !== aiRequestId || !isComputerTurn()) return;
    try {
      aiWorker = new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' });
      aiWorker.onmessage = ({ data }) => {
        if (data.id !== id || id !== aiRequestId) return;
        if (data.error) { fallback(); return; }
        aiWorker?.terminate();
        aiWorker = null;
        complete(data.move);
      };
      aiWorker.onerror = event => { event.preventDefault(); fallback(); };
      aiWorker.postMessage({ id, game, difficulty: settings.difficulty });
    } catch { fallback(); }
  }, 350);
}

function newGame() {
  cancelAI();
  settings = { ...draftSettings };
  game = createGame();
  focusedIndex = 112;
  renderSettings();
  render();
  save();
  scheduleAI();
  notify(`新的一局开始了，你执${settings.humanPlayer === BLACK ? '黑' : '白'}棋`);
}

function playSound() {
  if (!preferences.sound || !audioContext || audioContext.state !== 'running') return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(640, now);
  oscillator.frequency.exponentialRampToValueAtTime(180, now + .06);
  gain.gain.setValueAtTime(.0001, now);
  gain.gain.exponentialRampToValueAtTime(.16, now + .005);
  gain.gain.exponentialRampToValueAtTime(.0001, now + .09);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + .1);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}

async function enableAudio() {
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') await audioContext.resume();
  } catch {
    preferences.sound = false;
    notify('当前浏览器暂不支持音效，仍可正常下棋');
    render();
    save();
  }
}

function setBoardFocus(index) {
  cells[focusedIndex].tabIndex = -1;
  focusedIndex = index;
  cells[index].tabIndex = 0;
}

$('#board').addEventListener('click', event => {
  const cell = event.target.closest('.cell');
  if (!cell) return;
  const index = Number(cell.dataset.index);
  setBoardFocus(index);
  if (isComputerTurn()) { notify('棋友正在思考，稍等这一手'); return; }
  if (game.winner || game.draw) { notify('这一局已结束，可以悔棋或开始新对局'); return; }
  if (game.board[index]) { notify('这里已经有棋子了，试试其他交点'); return; }
  if (preferences.sound) void enableAudio();
  if (applyMove(Math.floor(index / SIZE), index % SIZE)) scheduleAI();
});

$('#board').addEventListener('keydown', event => {
  const row = Math.floor(focusedIndex / SIZE);
  const col = focusedIndex % SIZE;
  const targets = {
    ArrowUp: Math.max(0, row - 1) * SIZE + col,
    ArrowDown: Math.min(SIZE - 1, row + 1) * SIZE + col,
    ArrowLeft: row * SIZE + Math.max(0, col - 1),
    ArrowRight: row * SIZE + Math.min(SIZE - 1, col + 1),
    Home: event.ctrlKey ? 0 : row * SIZE,
    End: event.ctrlKey ? SIZE * SIZE - 1 : row * SIZE + SIZE - 1,
  };
  if (event.key in targets) {
    event.preventDefault();
    setBoardFocus(targets[event.key]);
    cells[focusedIndex].focus({ preventScroll: true });
  }
});

$('#undo-button').addEventListener('click', () => {
  const count = undoCount(game, settings.humanPlayer);
  if (!count) return;
  cancelAI();
  game = undoMoves(game, count);
  render();
  save();
  notify('已回到你上一次落子前，再想一想');
});

$$('[data-difficulty]').forEach(button => button.addEventListener('click', () => { draftSettings.difficulty = button.dataset.difficulty; renderSettings(); }));
$$('[data-side]').forEach(button => button.addEventListener('click', () => { draftSettings.humanPlayer = Number(button.dataset.side); renderSettings(); }));
$('#settings-form').addEventListener('submit', event => {
  event.preventDefault();
  if (game.moves.length && !game.winner && !game.draw) $('#confirm-dialog').showModal();
  else newGame();
});
$('#confirm-new-game').addEventListener('click', () => { $('#confirm-dialog').close(); newGame(); });
$$('.rules-trigger').forEach(button => button.addEventListener('click', () => $('#rules-dialog').showModal()));
$$('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$$('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
}));
$('#sound-button').addEventListener('click', async () => {
  preferences.sound = !preferences.sound;
  if (preferences.sound) { await enableAudio(); playSound(); }
  render();
  save();
});
$('#show-numbers').addEventListener('change', event => { preferences.numbers = event.target.checked; render(); save(); });
$('#retry-ai').addEventListener('click', () => { cancelAI(); scheduleAI(); });

function route(page) {
  const records = page.kind === 'records';
  const library = page.kind === 'home';
  const snake = page.kind === 'game' && page.id === 'snake';
  const tetris = page.kind === 'game' && page.id === 'tetris';
  const extraId = page.kind === 'game' ? page.id : null;
  const extra = arcadeController.has(extraId);
  const expanded = expansionController.setActive(extraId);
  $('#game-view').hidden = library || snake || tetris || extra || expanded || records;
  $('#library-view').hidden = !library;
  $('#snake-view').hidden = !snake;
  $('#tetris-view').hidden = !tetris;
  snakeController.setActive(snake);
  tetrisController.setActive(tetris);
  arcadeController.setActive(extra ? extraId : null);
  $('#breadcrumb-page').textContent = page.name;
  document.body.dataset.pageKind = page.kind;
  document.body.dataset.pageId = page.id ?? '';
  document.title = page.title;
  $('meta[name="description"]').content = page.description;
  const canonical = $('link[rel="canonical"]');
  if (canonical) canonical.href = SITE_ORIGIN + page.path;
  for (const [selector, active] of [['#nav-library', library], ['#nav-gomoku', page.kind === 'game' && page.id === 'gomoku'], ['#nav-snake', snake], ['#nav-tetris', tetris], ['#nav-records', records]]) {
    $(selector).classList.toggle('active', active);
    if (active) $(selector).setAttribute('aria-current', 'page');
    else $(selector).removeAttribute('aria-current');
  }
  if (window.innerWidth <= 760) {
    const activeLink = $('.nav-link.active');
    const navigation = $('.sidebar-body');
    if (activeLink) navigation.scrollLeft = activeLink.offsetLeft - navigation.offsetLeft - 16;
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}

restore();
draftSettings = { ...settings };
createBoard();
renderSettings();
render();
save();
createRecordsController();
const snakeController = createSnakeController();
const tetrisController = createTetrisController();
const arcadeController = createArcadeController();
const expansionController = createExpansionController();
initLobbyFilters();
startNavigation(route);
initAnalytics();
window.addEventListener('pagehide', cancelAI);
window.addEventListener('pageshow', event => { if (event.persisted) scheduleAI(); });
scheduleAI();
if (restoreFailed) notify('上次的存档无法读取，已为你准备新棋局');
else if (migratedLocal) notify(`已保留原棋局，现在与电脑对弈，你执${settings.humanPlayer === BLACK ? '黑' : '白'}棋`);
else if (restored) notify('欢迎回来，已恢复上次的棋局');
