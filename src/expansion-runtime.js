import { EXPANSION_GAMES } from './expansion-catalog.js';
import { renderExpansionView } from './expansion-view.js';
import { startRecordAttempt, invalidateRecordAttempt } from './record-client.js';

const games = new Map(EXPANSION_GAMES.map(game => [game.id, game]));
const styledGroups = new Set(['paper', 'spatial', 'action', 'sports', 'boards', 'cards', 'sim', 'strategy', 'words']);
const styles = new Map();

function loadStyle(group) {
  if (!styledGroups.has(group)) return Promise.resolve();
  if (styles.has(group)) return styles.get(group);
  const promise = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL(`./expansion/${group}.css`, import.meta.url).href;
    link.onload = resolve;
    link.onerror = () => {
      link.remove();
      styles.delete(group);
      reject(new Error('样式未能加载'));
    };
    document.head.append(link);
  });
  styles.set(group, promise);
  return promise;
}

// The same ranked challenge gets the same sequence on every device.
export function challengeRandom(id) {
  let seed = 2166136261;
  for (const ch of id) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let value = Math.imul(seed ^ (seed >>> 15), seed | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function personalBest(game, value, ranked) {
  if (!game.metric || !Number.isSafeInteger(value)) return '';
  const key = `playroom.best.${game.id}.${ranked ? 'challenge' : 'practice'}.v1`;
  try {
    const raw = localStorage.getItem(key);
    const old = raw === null ? null : Number(raw);
    const improved = old === null || !Number.isFinite(old) || (game.metric.direction === 'asc' ? value < old : value > old);
    if (improved) localStorage.setItem(key, String(value));
    return ` · 本机${ranked ? '' : '练习'}最佳 ${improved ? value : old} ${game.metric.unit}`;
  } catch { return ''; }
}

// Scheduling, input cancellation and the submission ticket share one round lifetime.
function startRound(game, root, mount) {
  const host = root.querySelector('[data-x-host]');
  const status = root.querySelector('[data-x-status]');
  const pauseButton = root.querySelector('[data-x-pause]');
  const result = root.querySelector('[data-x-result]');
  const controller = new AbortController();
  let phase = 'playing';
  let ranked = Boolean(game.metric);
  let runningSince = performance.now();
  let activeMs = 0;
  let lastStatus = '游戏中';
  let frameHandle = 0;
  let ticking = false;
  let lastFrame = null;
  const callbacks = new Set();
  const ticket = ranked ? startRecordAttempt(game.id, root) : null;
  host.replaceChildren();
  host.inert = false;
  result.textContent = '';
  status.textContent = lastStatus;
  pauseButton.disabled = false;
  pauseButton.textContent = '暂停游戏';
  root.dataset.state = phase;

  function activeSeconds() {
    return (activeMs + (phase === 'playing' ? performance.now() - runningSince : 0)) / 1000;
  }
  function stopClock() {
    if (phase === 'playing') activeMs += performance.now() - runningSince;
    cancelAnimationFrame(frameHandle);
    frameHandle = 0;
    lastFrame = null;
  }
  function tick(now) {
    frameHandle = 0;
    if (phase !== 'playing') return;
    const dt = lastFrame === null ? 0 : Math.min((now - lastFrame) / 1000, .10);
    lastFrame = now;
    ticking = true;
    try {
      for (const item of [...callbacks]) {
        if (phase !== 'playing') break;
        if (!item.interval) item.fn(dt);
        else {
          item.accumulated += dt * 1000;
          if (item.accumulated >= item.interval) {
            item.accumulated %= item.interval;
            item.fn();
          }
        }
      }
    } catch (error) {
      end('这一局意外中断，请重新开始。');
      console.error('Game loop interrupted', game.id, error);
    } finally {
      ticking = false;
    }
    if (phase === 'playing' && callbacks.size) frameHandle = requestAnimationFrame(tick);
    else lastFrame = null;
  }
  function schedule(fn, interval = 0) {
    const item = { fn, interval, accumulated: 0 };
    callbacks.add(item);
    if (!frameHandle && !ticking && phase === 'playing') frameHandle = requestAnimationFrame(tick);
    return () => callbacks.delete(item);
  }
  function pause() {
    if (phase !== 'playing') return;
    stopClock();
    root.dataset.state = phase = 'paused';
    host.inert = true;
    host.dispatchEvent(new Event('playroom:round-pause'));
    pauseButton.textContent = '继续游戏';
    status.textContent = '已暂停';
  }
  function resume() {
    if (phase !== 'paused') return;
    runningSince = performance.now();
    root.dataset.state = phase = 'playing';
    host.inert = false;
    status.textContent = lastStatus;
    pauseButton.textContent = '暂停游戏';
    if (callbacks.size) frameHandle = requestAnimationFrame(tick);
  }
  function end(message, value = null) {
    if (phase !== 'playing') return;
    stopClock();
    root.dataset.state = phase = 'ended';
    controller.abort();
    callbacks.clear();
    pauseButton.disabled = true;
    status.textContent = '本局结束';
    host.inert = true;
    const hasScore = Number.isSafeInteger(value) && Boolean(game.metric);
    const scoreText = hasScore ? ` · ${game.metric.label} ${value} ${game.metric.unit}` : '';
    result.textContent = String(message) + scoreText + (hasScore ? personalBest(game, value, ranked) : '');
    if (hasScore && ranked) void ticket.finish(value, game.metric.direction === 'asc' ? 'won' : 'over');
  }
  const api = {
    signal: controller.signal, end, elapsed: activeSeconds,
    random: ranked ? challengeRandom(game.id) : Math.random,
    unrank() {
      if (!ranked) return;
      ranked = false;
      result.textContent = '本局为练习模式，成绩保存在本机。';
    },
    every: (fn, ms) => schedule(fn, Math.max(1, ms)),
    frame: fn => schedule(fn),
    status(text) {
      lastStatus = String(text);
      if (phase === 'playing') status.textContent = lastStatus;
    },
  };
  const options = { signal: controller.signal };
  window.addEventListener('blur', pause, options);
  window.addEventListener('pagehide', pause, options);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); }, options);
  document.addEventListener('playroom:pause-for-record', pause, options);
  pauseButton.addEventListener('click', () => phase === 'playing' ? pause() : resume(), options);
  function dispose() {
    stopClock();
    phase = 'disposed';
    controller.abort();
    callbacks.clear();
    invalidateRecordAttempt(root);
  }
  try {
    mount(game.id, host, api);
    if (document.hidden && phase === 'playing') pause();
  } catch (error) {
    dispose();
    throw error;
  }
  return dispose;
}

export function createExpansionController() {
  let root = document.querySelector('#expansion-view');
  let active = null;
  let generation = 0;
  let dispose = null;
  async function play() {
    if (!active) return;
    const game = active;
    const version = ++generation;
    dispose?.();
    dispose = null;
    const button = root.querySelector('[data-x-start]');
    const status = root.querySelector('[data-x-status]');
    root.querySelector('[data-x-pause]').disabled = true;
    button.disabled = true;
    status.textContent = '正在准备游戏…';
    try {
      const moduleUrl = new URL(`./expansion/${game.group}.js`, import.meta.url);
      const [module] = await Promise.all([import(moduleUrl.href), loadStyle(game.group)]);
      if (version !== generation) return;
      dispose = startRound(game, root, module.mount);
      button.textContent = '重新开始';
    } catch (error) {
      if (version !== generation) return;
      root.dataset.state = 'error';
      root.querySelector('[data-x-pause]').disabled = true;
      status.textContent = '游戏暂时无法启动，请重试。';
      button.textContent = '重试';
      console.error('Game could not start', game.id, error);
    } finally {
      if (version === generation) button.disabled = false;
    }
  }
  return { setActive(id) {
    const game = games.get(id) ?? null;
    if (game === active) return Boolean(game);
    generation++;
    dispose?.();
    dispose = null;
    if (root) root.hidden = true;
    active = game;
    if (!game) return false;
    const template = document.createElement('template');
    template.innerHTML = renderExpansionView(game);
    const next = template.content.firstElementChild;
    if (root) root.replaceWith(next);
    else document.querySelector('#library-view').after(next);
    root = next;
    root.dataset.state = 'ready';
    root.querySelector('[data-x-start]').addEventListener('click', play);
    return true;
  } };
}
