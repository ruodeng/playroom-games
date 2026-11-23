import { createGameRecordTracker } from './record-hooks.js';
import { getRecordBoard, isFreshRecordState, RECORD_BOARDS } from './record-catalog.js';

const svgArrow = '<svg class="icon" aria-hidden="true"><use href="#icon-arrow"/></svg>';
export function gridButtons(parent, count, className) {
  const grid = document.createElement('div'); grid.className = className;
  const cells = Array.from({ length: count }, (_, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.cell = index; grid.append(button); return button;
  });
  parent.append(grid); return cells;
}
export function setText(element, value) { if (element.textContent !== String(value)) element.textContent = value; }

export function renderInitialRecordLink(gameId) {
  const board = getRecordBoard(gameId) ?? RECORD_BOARDS.find(item => item.game === gameId);
  return board ? `<a class="record-game-link" href="/records/${board.id}" aria-label="${board.name} · ${board.label} · 查看社区纪录前十名">查看社区纪录 Top 10 →</a>` : '';
}

export function renderArcadeView(definition, { hidden = false, preview = false } = {}) {
  const { id, name, number, category, description, welcome, hint, detail, record, intro, rules, art } = definition;
  const field = preview ? `<div class="game-card-art arcade-card-art art-${id}-back" aria-hidden="true" style="min-height:clamp(240px,40vh,390px)">${art}</div>` : '';
  const recordLink = preview ? renderInitialRecordLink(id) : '';
  return `<main id="${id}-view" class="main-content arcade-view ${id}-view"${hidden ? ' hidden' : ''}>
    <div class="page-heading"><div><p class="eyebrow">THE PLAYROOM · ${number}</p><div class="title-row"><h1>${name}</h1><span class="tag">${category}</span></div><p class="page-description">${description}</p></div><button class="button button-quiet arcade-rules">玩法说明</button></div>
    <div class="game-layout arcade-layout"><section class="arcade-panel" aria-label="${name}游戏"><div class="arcade-stats"></div><div class="arcade-stage"><div class="arcade-surface" tabindex="0" role="group" aria-label="${name}控制区">${field}</div><div class="arcade-overlay"><span class="eyebrow">A LITTLE TIME TO PLAY</span><h2>${welcome}</h2><p>${description}</p><button class="button button-primary arcade-start">开始游戏</button></div></div><div class="arcade-controls" role="group" aria-label="${name}操作"></div><div class="arcade-toolbar"><p class="arcade-status" role="status" aria-live="polite">准备就绪，开始这一局</p><button class="button button-quiet arcade-pause" disabled>暂停游戏</button></div><div class="arcade-result" hidden><strong></strong><button class="button button-primary arcade-again">再玩一局</button></div><div class="board-hint"><span>${hint}</span><span>${detail}</span></div></section>
    <aside class="game-aside arcade-aside"><section class="settings-panel"><div class="section-heading"><h2>${record ? '你的最佳一局' : '这一局，慢慢来'}</h2><span class="small-label">${record ? 'PERSONAL BEST' : 'JUST FOR FUN'}</span></div>${record ? '<div class="tetris-record"><strong class="arcade-best">0</strong><span>分</span></div><p class="field-hint arcade-record-note">最高分保存在当前浏览器</p>' : `<p class="arcade-intro">${intro}</p>`}<button class="button button-secondary new-game-button arcade-restart" disabled>重新开始${svgArrow}</button><a class="arcade-back" href="/">← 返回游戏大厅</a>${recordLink}</section><section class="rule-note arcade-guide"><h2>怎么玩，都在这里。</h2>${rules.map(rule => `<p>${rule}</p>`).join('')}<p class="arcade-session-note">离开游戏会自动暂停，回来后可继续。刷新会重置本局${record ? '，最高分会保留' : ''}。</p></section></aside></div><footer class="page-footer"><span>给快乐，留一点时间。</span><span>${name} · 片刻 Playroom</span></footer>
  </main>`;
}

export class ArcadePanel {
  constructor(definition) {
    this.definition = definition;
    this.active = false; this.started = false; this.paused = false;
    this.frameId = 0; this.lastFrame = null; this.accumulator = 0; this.keys = new Set();
    this.best = 0; this.storageAvailable = true;
    this.recordKey = `playroom.${definition.id}.best.v1`;
    if (definition.record) {
      try { const value = Number(localStorage.getItem(this.recordKey)); if (Number.isSafeInteger(value) && value >= 0) this.best = value; }
      catch { this.storageAvailable = false; }
    }
    let root = document.getElementById(`${definition.id}-view`);
    if (!root) {
      const library = document.querySelector('#library-view');
      library.insertAdjacentHTML('beforebegin', renderArcadeView(definition, { hidden: true }));
      root = library.previousElementSibling;
    }
    this.root = root; this.surface = root.querySelector('.arcade-surface'); this.controls = root.querySelector('.arcade-controls');
    this.surface.replaceChildren();
    this.adapter = definition.setup(this);
    this.state = this.adapter.create();
    this.records = createGameRecordTracker(definition.id, root);
    document.addEventListener('playroom:pause-for-record', () => { if (this.active) this.pause(); });
    root.querySelector('.arcade-start').addEventListener('click', () => this.start());
    root.querySelector('.arcade-pause').addEventListener('click', () => this.paused ? this.start() : this.pause());
    root.querySelector('.arcade-again').addEventListener('click', () => { this.reset(); this.start(); });
    root.querySelector('.arcade-restart').addEventListener('click', () => {
      if (!this.started || this.over()) { this.reset(); return; }
      this.pause();
      this.dialog('再来一局？', '当前进度将被清空，新的一局会重新生成。', '重新开始', () => this.reset());
    });
    root.querySelector('.arcade-rules').addEventListener('click', () => {
      this.pause();
      this.dialog(`${definition.name} · 玩法说明`, definition.rules.join('\n\n'), '知道了');
    });
    this.render();
  }
  over() { return this.state.status !== 'playing'; }
  canPlay() { return this.active && this.started && !this.paused && !this.over() && !document.querySelector('dialog[open]'); }
  button(label, onClick, className = '') {
    const button = document.createElement('button'); button.type = 'button'; button.className = `button button-secondary ${className}`; button.textContent = label;
    button.addEventListener('click', onClick); this.controls.append(button); return button;
  }
  commit(state) {
    if (state === this.state) return;
    if (isFreshRecordState(this.definition.id, this.state, state)) {
      this.records.reset();
      if (this.started && !this.paused) this.records.begin(state);
    }
    this.state = state;
    this.records.observe(state);
    if (this.definition.record && state.score > this.best) {
      this.best = state.score;
      try {
        const stored = Number(localStorage.getItem(this.recordKey));
        if (Number.isSafeInteger(stored) && stored >= 0) this.best = Math.max(this.best, stored);
        localStorage.setItem(this.recordKey, String(this.best)); this.storageAvailable = true;
      } catch { this.storageAvailable = false; }
    }
    this.render();
  }
  start() {
    if (!this.active || document.hidden || this.over()) return;
    this.started = true; this.paused = false; this.records.begin(this.state); this.render();
    this.surface.focus({ preventScroll: true }); this.run();
  }
  stop() { cancelAnimationFrame(this.frameId); this.frameId = 0; this.lastFrame = null; this.accumulator = 0; this.keys.clear(); }
  pause() {
    this.records.pause();
    this.stop();
    if (this.started && !this.over()) this.paused = true;
    this.render();
  }
  reset() { this.stop(); this.records.reset(); this.started = false; this.paused = false; this.state = this.adapter.create(); this.adapter.reset?.(); this.render(); }
  setActive(active) { this.active = active; this.root.hidden = !active; if (!active) this.pause(); }
  run() {
    this.stop();
    if (!this.adapter.tick || !this.canPlay()) return;
    const frame = now => {
      if (!this.canPlay() || document.hidden) { this.pause(); return; }
      if (this.lastFrame !== null) this.accumulator += now - this.lastFrame;
      this.lastFrame = now;
      if (this.accumulator >= (this.adapter.interval || 0)) {
        const ms = this.accumulator; this.accumulator = 0;
        this.commit(this.adapter.tick(this.state, ms));
      }
      if (!this.over()) this.frameId = requestAnimationFrame(frame);
      else this.stop();
    };
    this.frameId = requestAnimationFrame(frame);
  }
  key(event) {
    if (!this.active || !this.started || document.querySelector('dialog[open]') || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input,textarea,select')) return;
    const key = event.key.toLowerCase();
    if (['p', 'escape'].includes(key) && !this.over()) {
      event.preventDefault(); if (!event.repeat) this.paused ? this.start() : this.pause(); return;
    }
    if (!this.canPlay()) return;
    if (key === ' ' && event.target.closest('button,a')) return;
    if (this.adapter.key?.(key, event)) event.preventDefault();
  }
  render() {
    this.records.updateLink(this.state);
    const stats = this.adapter.stats(this.state);
    const container = this.root.querySelector('.arcade-stats');
    if (!container.children.length) container.innerHTML = stats.map(() => '<div><span></span><strong></strong></div>').join('');
    stats.forEach(([label, value], i) => { setText(container.children[i].firstChild, label); setText(container.children[i].lastChild, value); });
    const overlay = this.root.querySelector('.arcade-overlay');
    overlay.hidden = this.started && !this.paused;
    setText(overlay.querySelector('h2'), this.paused ? '留一点时间，等你。' : this.definition.welcome);
    setText(overlay.querySelector('p'), this.paused ? '这一局已暂停，准备好再继续。' : this.definition.description);
    setText(overlay.querySelector('button'), this.paused ? '继续游戏' : '开始游戏');
    setText(this.root.querySelector('.arcade-status'), !this.started ? '准备就绪，开始这一局' : this.paused ? '已暂停，进度已保留' : this.adapter.message(this.state));
    const pause = this.root.querySelector('.arcade-pause'); pause.disabled = !this.started || this.over(); setText(pause, this.paused ? '继续游戏' : '暂停游戏');
    this.root.querySelector('.arcade-restart').disabled = !this.started;
    const result = this.root.querySelector('.arcade-result'); result.hidden = !this.started || !this.over();
    if (!result.hidden) setText(result.querySelector('strong'), this.adapter.message(this.state));
    if (this.definition.record) {
      setText(this.root.querySelector('.arcade-best'), this.best);
      setText(this.root.querySelector('.arcade-record-note'), this.storageAvailable ? '最高分保存在当前浏览器' : '浏览器未允许保存，最高分仅在本次有效');
    }
    this.adapter.draw(this.state);
  }
  dialog(title, description, action, callback) {
    const dialog = document.createElement('dialog'); dialog.className = 'dialog arcade-dialog'; dialog.setAttribute('aria-label', title);
    const heading = document.createElement('h2'); heading.textContent = title;
    const copy = document.createElement('p'); copy.className = 'dialog-description'; copy.textContent = description;
    const actions = document.createElement('div'); actions.className = 'dialog-actions';
    if (callback) { const cancel = document.createElement('button'); cancel.className = 'button button-secondary'; cancel.textContent = '保留这一局'; cancel.onclick = () => dialog.close(); actions.append(cancel); }
    const confirm = document.createElement('button'); confirm.className = 'button button-primary'; confirm.textContent = action;
    confirm.onclick = () => { dialog.close(); callback?.(); }; actions.append(confirm);
    dialog.append(heading, copy, actions); document.body.append(dialog);
    dialog.addEventListener('close', () => dialog.remove(), { once: true }); dialog.showModal();
  }
}
