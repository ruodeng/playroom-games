import { TOWN, PLAYER_NAMES, ROUND_LIMIT, createMonopoly, rollMonopoly, buyProperty, skipProperty, endMonopolyTurn,
  canManage, manageProperty, settleDebt, declareBankruptcy, liquidCash, assets, ranking, rentAt, upgradeCost,
  mortgageValue, redeemCost, stepMonopolyAI, restoreMonopoly, chooseMonopolyRoute } from './monopoly.js';
import { MAP_POINTS, FORKS, terrainFor, roadPath } from './monopoly-map.js';

export const MONOPOLY_GAME = {
  id: 'monopoly', name: '迷你大富翁', number: '012', category: '经营策略', filter: 'strategy',
  description: '穿过森林与海湾，在岔路口遇见新机遇。', detail: '曲折地图 · 岔路选择 · 自动存档',
  art: '<img class="town-card-map" src="/assets/monopoly/town-map.png" alt="" loading="lazy"><span class="town-card-caption">林间小镇 · 海湾漫游</span>',
};
const STORAGE_KEY = 'playroom.monopoly.v1';
const money = value => value.toLocaleString('zh-CN');
const GROUPS = ['#9bbba3', '#d4b279', '#bf96a4', '#a0b2d0', '#8ebbb5', '#b2a1cb', '#d19b7f', '#c7bb71'];
const MARKS = { start: '↗', station: '↔', chance: '?', park: '♧', tax: '§' };
const PAWNS = ['你', '麦', '橙'];
const TOWN_ROADS = TOWN.flatMap((_, from) => {
  const main = (from + 1) % TOWN.length;
  const destinations = FORKS[from] ? [main, FORKS[from][1].next] : [main];
  return destinations.map(to => ({ from, to, route: to === main ? 'main' : 'shortcut' }));
});
const RULES = [
  '你与两名电脑各带 1,200 金币出发。每回合掷两颗骰子，双骰相同也只行动一次；经过或落在起点领取 200 金币。',
  '地图的 07、17 号地点有岔路。经过岔路且仍有步数时，会暂停移动让你选路：主路经过更多地产，近路跳过部分街区。每条道路都消耗 1 步，最终停留地点才触发收租或事件。虚线表示近路，亮色道路表示本次走过的路线。',
  '空地产可购买，别人的未抵押地产要付租金。普通地产可独立升级 3 次，无需集齐同色组，租金为基础的 3 / 6 / 10 倍。车站不可升级，一座收 40，两座均未抵押时各收 80。',
  '你的回合掷骰前或结束前可管理地产。升级费为地价的一半；卖房退回升级费的一半，卖完房才能抵押，获得地价的一半，抵押后不收租。赎回支付抵押款及 10% 费用。',
  '现金不足时先卖房或抵押偿债；全部可变现资产仍不足才能破产。地产归还市场，剩余资产用于偿债。你破产后可观看电脑结算。',
  '公园 +100，城市税 −150，机会随机增减现金。20 轮后按总资产排名，同额并列；仅剩一人则提前胜出。总资产 = 现金 + 地产原价（抵押中按一半）+ 房屋建造费。',
  '地图支持拖动、缩放、全图和定位角色，键盘聚焦地图后可用方向键滚动。地形插画用于区分街区，费用以地点手册为准。自动存档兼容旧棋局，离开或失焦会暂停。P / Esc 暂停，在非按钮区域按空格掷骰。',
];

function button(label, action, className = 'button-secondary') {
  const node = document.createElement('button'); node.type = 'button'; node.className = `button ${className}`; node.textContent = label; node.addEventListener('click', action); return node;
}

export function renderMonopolyView({ hidden = false } = {}) {
  const roads = TOWN_ROADS.map(({ from, to, route }) => {
    const path = roadPath(from, to);
    return `<g class="town-road-${route}">${['edge', 'surface', 'trail'].map(layer => `<path d="${path}" class="town-road-${layer}"/>`).join('')}</g>`;
  }).join('');
  const cells = TOWN.map((tile, index) => {
    const [x, y] = MAP_POINTS[index];
    return `<button type="button" class="town-cell${index === 1 ? ' selected' : ''}${FORKS[index] ? ' town-junction' : ''}" data-tile="${index}" aria-pressed="${index === 1}" style="left:${x / 10}%;top:${y / 7.6}%;--district:${GROUPS[tile.group] || '#b4bd9e'}"><span class="town-node-number">${String(index + 1).padStart(2, '0')}</span><img class="town-node-image" src="${terrainFor(index).image}" alt="" draggable="false"><span class="town-cell-band"></span><strong>${tile.name}</strong><small>${tile.price || MARKS[tile.type]}</small><span class="town-tokens"></span></button>`;
  }).join('');
  const initial = createMonopoly();
  const pawns = initial.players.map((player, id) => {
    const [x, y] = MAP_POINTS[player.position];
    return `<span class="town-map-pawn player-${id}${initial.turn === id ? ' current' : ''}" style="left:calc(${x / 10}% + ${(id - 1) * 16}px);top:${y / 7.6}%">${PAWNS[id]}</span>`;
  }).join('');
  const terrain = terrainFor(1);
  return `<main id="monopoly-view" class="main-content monopoly-view town-overview-mode"${hidden ? ' hidden' : ''}>
    <div class="page-heading"><div><p class="eyebrow">THE PLAYROOM · ${MONOPOLY_GAME.number}</p><div class="title-row"><h1>${MONOPOLY_GAME.name}</h1><span class="tag">小镇漫游</span></div><p class="page-description">从林间小径到海湾栈桥，每个转弯都有新的可能。</p></div><button class="button button-quiet town-rules">玩法说明</button></div>
      <div class="town-layout"><section class="town-play" aria-label="大富翁游戏区">
        <div class="town-topline"><span><i class="status-dot"></i> 20 轮快速局</span><strong class="town-round">第 ${initial.round} / ${ROUND_LIMIT} 轮</strong><button class="button button-quiet town-pause" disabled>暂停</button></div>
        <div class="town-map-tools"><div><strong>林间小镇</strong><span>24 个地点 · 2 处岔路</span></div><div class="town-map-tool-buttons"><button class="button button-quiet town-zoom-out" aria-label="缩小地图">−</button><button class="button button-quiet town-zoom-in" aria-label="放大地图">＋</button><button class="button button-secondary town-overview" aria-pressed="true">展开</button><button class="button button-secondary town-locate">定位角色</button></div></div>
        <div class="town-map-viewport" tabindex="0" role="region" aria-label="小镇地图，可拖动或滚动探索，点地点查看详情">
          <div class="town-board town-world" role="group" aria-label="曲折路线与分岔地图">
            <img class="town-map-image" src="/assets/monopoly/town-map.png" alt="森林、山丘、老街、河流和海湾组成的小镇地图" fetchpriority="high">
            <svg class="town-roads" viewBox="0 0 1000 760" aria-hidden="true">${roads}</svg>
            <span class="town-map-label" style="left:22%;top:4%">林间山谷</span><span class="town-map-label" style="left:67%;top:4%">河岸花园</span><span class="town-map-label" style="left:15%;top:72%">暖阳老街</span><span class="town-map-label" style="left:83%;top:91%">星光海湾</span>
            <div class="town-pawns" aria-hidden="true">${pawns}</div>${cells}
          </div>
        </div>
        <div class="town-map-legend"><span><i></i> 主路</span><span><i></i> 可选近路</span><span>拖动探索 · 点地点查看 · 经过起点 +200</span></div>
        <button class="town-open-details" type="button">${TOWN[1].name} · ${terrain.name}　查看详情 ↓</button>
        <div class="town-turn-panel"><div><span class="eyebrow">YOUR NEXT LITTLE ADVENTURE</span><p class="town-center-copy">${PLAYER_NAMES.join(' · ')}</p></div><div class="town-dice" aria-label="骰子点数"><span>·</span><span>·</span></div><button class="button button-primary town-start">开始经营</button></div>
        <div class="town-action"><p class="town-message" role="status" aria-live="polite">准备好了吗？用 1,200 金币开始经营。</p><div class="town-route-options"></div><div class="town-action-buttons"></div><p class="town-action-note">每次操作自动保存，随时离开，随时继续。</p></div>
        <div class="town-finish" hidden><h2></h2><ol></ol><button class="button button-primary town-again">再经营一座小镇</button></div>
        <div class="town-save-note" role="status">进度自动保存在当前浏览器 · 离开即暂停</div>
      </section>
      <aside class="town-aside"><section class="town-players"><div class="section-heading"><h2>小镇居民</h2><span class="small-label">TOWN PLAYERS</span></div><div class="town-player-list"></div></section>
        <section class="town-inspector"><div class="section-heading"><h2>地点手册</h2><span class="small-label">EXPLORE THE TOWN</span></div><img class="town-location-image" src="${terrain.image}" alt="${TOWN[1].name}所在的${terrain.name}街区插画"><p class="town-terrain-description">${terrain.name} · ${terrain.description}</p><div class="town-property-title"><span>02</span><h3>${TOWN[1].name}</h3></div><p class="town-property-owner">等待第一位主人</p><dl class="town-property-stats"></dl><p class="town-property-note"></p><div class="town-property-actions"></div><div class="town-owned"><h3>你的地产 <span>0</span></h3><div></div></div></section>
        <section class="town-journal"><div class="section-heading"><h2>小镇动态</h2><span class="small-label">TOWN JOURNAL</span></div><ol></ol></section>
        <div class="town-bottom-actions"><button class="button button-secondary town-restart">重新开始</button><a class="button button-quiet" href="/">← 游戏大厅</a></div>
      </aside></div><noscript><section class="rule-note"><h2>迷你大富翁玩法</h2>${RULES.map(rule => `<p>${rule}</p>`).join('')}</section></noscript><footer class="page-footer"><span>给快乐，留一点时间。</span><span>${MONOPOLY_GAME.name} · 片刻 Playroom</span></footer>
  </main>`;
}

export class MonopolyPanel {
  constructor() {
    this.definition = MONOPOLY_GAME; this.active = false; this.started = false; this.paused = false;
    this.timer = null; this.keys = new Set(); this.selected = 1; this.state = createMonopoly(); this.storageAvailable = true; this.restoreFailed = false; this.ownedNodes = new Map(); this.mapZoom = 1; this.mapOverview = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { const restored = restoreMonopoly(raw); this.state = restored.state; this.started = restored.started; this.paused = this.started && this.state.status === 'playing'; this.selected = this.state.players[this.state.turn].position; }
    } catch (error) { if (error.name === 'SecurityError') this.storageAvailable = false; else this.restoreFailed = true; }
    let root = document.getElementById('monopoly-view');
    if (!root) {
      const library = document.querySelector('#library-view');
      library.insertAdjacentHTML('beforebegin', renderMonopolyView({ hidden: true }));
      root = library.previousElementSibling;
    }
    this.root = root;
    const roads = root.querySelector('.town-roads').children;
    this.roadNodes = TOWN_ROADS.map((road, index) => ({ ...road, node: roads[index] }));
    this.pawns = [...root.querySelectorAll('.town-map-pawn')];
    this.cells = [...root.querySelectorAll('.town-cell')];
    this.cells.forEach((cell, index) => {
      cell.addEventListener('click', () => { if (this.dragMoved) return; this.selected = index; this.render(); });
    });
    this.mapViewport = root.querySelector('.town-map-viewport');
    root.querySelector('.town-open-details').onclick = () => root.querySelector('.town-inspector').scrollIntoView({ block: 'start', behavior: 'instant' });
    const returnToMap = button('↑ 返回地图', () => this.mapViewport.scrollIntoView({ block: 'start', behavior: 'instant' }), 'button-quiet town-return-map'); root.querySelector('.town-inspector .section-heading').append(returnToMap);
    root.querySelector('.town-zoom-in').onclick = () => this.zoomMap(.25);
    root.querySelector('.town-zoom-out').onclick = () => this.zoomMap(-.25);
    root.querySelector('.town-overview').onclick = () => { this.mapOverview = !this.mapOverview; this.sizeMap(); if (!this.mapOverview) this.locatePlayer(); };
    root.querySelector('.town-locate').onclick = () => { this.mapOverview = false; this.sizeMap(); this.locatePlayer(); };
    this.mapViewport.addEventListener('pointerdown', event => {
      this.dragMoved = false; if (event.pointerType !== 'mouse' || event.button !== 0) return;
      this.drag = { x: event.clientX, y: event.clientY, left: this.mapViewport.scrollLeft, top: this.mapViewport.scrollTop, id: event.pointerId };
    });
    this.mapViewport.addEventListener('pointermove', event => {
      if (!this.drag) return; const dx = event.clientX - this.drag.x, dy = event.clientY - this.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) { this.dragMoved = true; this.mapViewport.setPointerCapture(event.pointerId); this.mapViewport.scrollLeft = this.drag.left - dx; this.mapViewport.scrollTop = this.drag.top - dy; }
    });
    const release = event => { if (this.mapViewport.hasPointerCapture(event.pointerId)) this.mapViewport.releasePointerCapture(event.pointerId); this.drag = null; };
    this.mapViewport.addEventListener('pointerup', release); this.mapViewport.addEventListener('pointercancel', release);
    this.mapViewport.addEventListener('keydown', event => { this.dragMoved = false; if (event.target !== this.mapViewport) return; const movement = { ArrowLeft: [-100, 0], ArrowRight: [100, 0], ArrowUp: [0, -100], ArrowDown: [0, 100] }[event.key]; if (movement) { event.preventDefault(); this.mapViewport.scrollBy({ left: movement[0], top: movement[1] }); } });
    new ResizeObserver(() => { if (this.active) this.sizeMap(); }).observe(this.mapViewport);
    this.routeButtons = [0, 1].map(optionIndex => {
      const node = button('', () => { const option = FORKS[this.state.players[this.state.turn].position]?.[optionIndex]; if (option && this.canPlay() && this.state.turn === 0 && this.state.phase === 'route') this.commit(chooseMonopolyRoute(this.state, option.next)); });
      root.querySelector('.town-route-options').append(node); return node;
    });
    this.actionButtons = {};
    for (const [key, label, transition] of [
      ['roll', '掷骰子', rollMonopoly], ['buy', '买下这里', buyProperty], ['skip', '暂时不买', skipProperty],
      ['end', '结束回合', endMonopolyTurn], ['settle', '偿还欠款', settleDebt], ['bankrupt', '确认破产', declareBankruptcy],
    ]) {
      const node = button(label, () => { if (this.canPlay() && this.state.turn === 0) this.commit(transition(this.state)); }, ['skip', 'bankrupt'].includes(key) ? 'button-secondary' : 'button-primary');
      this.actionButtons[key] = node; root.querySelector('.town-action-buttons').append(node);
    }
    this.propertyButtons = {};
    for (const action of ['upgrade', 'sell', 'mortgage', 'redeem']) {
      const node = button('', () => { if (this.canPlay() && this.state.turn === 0) this.commit(manageProperty(this.state, this.selected, action)); });
      this.propertyButtons[action] = node; root.querySelector('.town-property-actions').append(node);
    }
    root.querySelector('.town-start').addEventListener('click', () => this.start());
    root.querySelector('.town-pause').addEventListener('click', () => this.paused ? this.start() : this.pause());
    root.querySelector('.town-restart').addEventListener('click', () => {
      if (!this.started || this.state.status === 'finished') this.reset();
      else { this.pause(); this.dialog('重新经营一座小镇？', '本局存档将被新的一局替换。', '重新开始', () => this.reset()); }
    });
    root.querySelector('.town-again').addEventListener('click', () => { this.reset(); this.start(); });
    root.querySelector('.town-rules').addEventListener('click', () => {
      this.pause(); this.dialog('迷你大富翁 · 玩法说明', RULES.join('\n\n'), '知道了');
    });
    this.render();
  }
  canPlay() { return this.active && this.started && !this.paused && this.state.status === 'playing' && !document.querySelector('dialog[open]'); }
  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, started: this.started, state: this.state })); this.storageAvailable = true; this.restoreFailed = false; }
    catch { this.storageAvailable = false; }
  }
  commit(state) {
    if (state === this.state) return;
    const focused = document.activeElement;
    if (state.players[state.turn].position !== this.state.players[this.state.turn].position || state.turn !== this.state.turn) this.selected = state.players[state.turn].position;
    const moved = state.turn !== this.state.turn || state.players[state.turn].position !== this.state.players[this.state.turn].position;
    this.state = state; this.save(); this.render(); this.schedule(); if (moved) this.locatePlayer();
    if (this.root.contains(focused) && focused.tagName === 'BUTTON' && (focused.hidden || focused.disabled)) this.focusAction();
  }
  focusAction() {
    const action = [...this.routeButtons, ...Object.values(this.actionButtons)].find(node => !node.hidden && !node.disabled);
    (action || this.cells[this.selected]).focus({ preventScroll: true });
  }
  schedule() {
    clearTimeout(this.timer); this.timer = null;
    if (!this.canPlay() || this.state.turn === 0) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.canPlay() || document.hidden) { this.pause(); return; }
      this.commit(stepMonopolyAI(this.state));
    }, this.state.players[0].bankrupt ? 450 : 1000);
  }
  start() {
    if (!this.active || document.hidden || this.state.status !== 'playing') return;
    if (!this.started) { this.mapOverview = false; this.sizeMap(); this.locatePlayer(); }
    this.started = true; this.paused = false; this.save(); this.render(); this.schedule(); this.focusAction();
  }
  pause() { clearTimeout(this.timer); this.timer = null; if (this.started && this.state.status === 'playing') this.paused = true; this.render(); }
  setActive(active) { this.active = active; this.root.hidden = !active; if (!active) this.pause(); else { this.render(); this.sizeMap(); this.locatePlayer(); } }
  sizeMap() {
    const world = this.root.querySelector('.town-world');
    world.style.width = this.mapOverview ? '100%' : `${Math.max(this.mapViewport.clientWidth, 800) * this.mapZoom}px`;
    this.root.classList.toggle('town-overview-mode', this.mapOverview);
    this.root.querySelector('.town-overview').textContent = this.mapOverview ? '展开' : '全图';
    this.root.querySelector('.town-overview').setAttribute('aria-pressed', String(this.mapOverview));
    this.root.querySelector('.town-zoom-out').disabled = !this.mapOverview && this.mapZoom <= .75;
    this.root.querySelector('.town-zoom-in').disabled = !this.mapOverview && this.mapZoom >= 1.75;
  }
  zoomMap(delta) { this.mapOverview = false; this.mapZoom = Math.min(1.75, Math.max(.75, this.mapZoom + delta)); this.sizeMap(); this.locatePlayer(); }
  locatePlayer() {
    if (!this.active || this.mapOverview) return;
    const world = this.root.querySelector('.town-world'), [x, y] = MAP_POINTS[this.state.players[this.state.turn].position];
    this.mapViewport.scrollTo({ left: x / 1000 * world.clientWidth - this.mapViewport.clientWidth / 2, top: y / 760 * world.clientHeight - this.mapViewport.clientHeight / 2, behavior: 'instant' });
  }
  reset() { clearTimeout(this.timer); this.timer = null; this.state = createMonopoly(); this.started = false; this.paused = false; this.selected = 1; this.mapOverview = true; this.mapZoom = 1; this.sizeMap(); this.save(); this.render(); }
  key(event) {
    if (!this.active || !this.started || event.repeat || event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]') || event.target.closest('input,select,textarea')) return;
    if (['p', 'escape'].includes(event.key.toLowerCase()) && this.state.status === 'playing') { event.preventDefault(); this.paused ? this.start() : this.pause(); }
    else if (event.key === ' ' && !event.target.closest('button,a') && this.canPlay() && this.state.turn === 0) { event.preventDefault(); this.commit(rollMonopoly(this.state)); }
  }
  render() {
    const root = this.root, s = this.state, current = s.players[s.turn], playing = this.canPlay(), human = s.turn === 0;
    root.querySelector('.town-round').textContent = `第 ${s.round} / ${ROUND_LIMIT} 轮`;
    const pause = root.querySelector('.town-pause'); pause.textContent = this.paused ? '继续' : '暂停'; pause.disabled = !this.started || s.status !== 'playing';
    const start = root.querySelector('.town-start'); start.hidden = this.started && !this.paused; start.textContent = this.paused ? '继续经营' : '开始经营';
    root.querySelector('.town-center-copy').textContent = s.status === 'finished' ? '这一站，满载而归。' : !this.started ? '你 · 小麦 · 阿橙' : this.paused ? '小镇已暂停，回来继续。' : `${current.name}${human ? '的回合' : '正在经营'}`;
    const dice = root.querySelector('.town-dice'); dice.setAttribute('aria-label', `骰子：${s.dice.join('、')}`);
    [...dice.children].forEach((node, i) => { node.textContent = s.dice[i] ? ['','⚀','⚁','⚂','⚃','⚄','⚅'][s.dice[i]] : '·'; });
    this.cells.forEach((cell, index) => {
      const tile = TOWN[index], property = s.properties[index]; cell.classList.toggle('selected', this.selected === index);
      cell.classList.toggle('mortgaged', property.mortgaged); cell.classList.toggle('town-junction', Boolean(FORKS[index])); cell.dataset.owner = property.owner ?? '';
      cell.setAttribute('aria-pressed', String(this.selected === index));
      cell.querySelector('small').textContent = property.mortgaged ? '已抵押' : property.owner !== null ? `${PLAYER_NAMES[property.owner]}${property.level ? ` · ${property.level} 级` : ''}` : tile.price ? `${tile.price}` : MARKS[tile.type];
      const tokens = cell.querySelector('.town-tokens'); tokens.replaceChildren();
      s.players.forEach((player, id) => { if (!player.bankrupt && player.position === index) { const token = document.createElement('i'); token.textContent = ['你', '麦', '橙'][id]; tokens.append(token); } });
      cell.setAttribute('aria-label', `${index + 1}，${tile.name}，${tile.price ? `售价 ${tile.price}，${property.owner === null ? '未出售' : `属于${PLAYER_NAMES[property.owner]}，${property.mortgaged ? '已抵押' : `租金 ${rentAt(s, index)}`}`}` : { start: '经过奖励 200', chance: '随机机会', park: '奖励 100', tax: '支付 150' }[tile.type]}${tokens.children.length ? `，${tokens.textContent}在这里` : ''}`);
    });
    this.pawns.forEach((pawn, id) => { const player = s.players[id], [x, y] = MAP_POINTS[player.position]; pawn.hidden = player.bankrupt; pawn.style.left = `calc(${x / 10}% + ${(id - 1) * 16}px)`; pawn.style.top = `${y / 7.6}%`; pawn.classList.toggle('current', s.turn === id); });
    this.roadNodes.forEach(edge => { edge.node.classList.toggle('travelled', (s.lastPath || []).some((id, i, path) => i > 0 && path[i - 1] === edge.from && id === edge.to)); edge.node.classList.toggle('available', s.phase === 'route' && current.position === edge.from); });
    this.routeButtons.forEach((node, i) => { node.hidden = !this.started || !human || s.phase !== 'route'; node.disabled = !playing; if (s.phase === 'route') { const option = FORKS[current.position][i]; node.textContent = `${option.shortcut ? '↗' : '↝'} ${option.name} · ${option.detail}`; } });
    root.querySelector('.town-message').textContent = !this.started ? '准备好了吗？用 1,200 金币开始经营。' : this.paused ? `已暂停 · ${s.message}` : s.message;
    const visible = { roll: s.phase === 'roll', buy: s.phase === 'buy', skip: s.phase === 'buy', end: s.phase === 'end', settle: s.phase === 'debt', bankrupt: s.phase === 'debt' && liquidCash(s, 0) < (s.debt?.amount || 0) };
    for (const [key, node] of Object.entries(this.actionButtons)) {
      node.hidden = !this.started || !human || !visible[key] || s.status !== 'playing';
      node.disabled = !playing || (key === 'buy' && current.cash < TOWN[current.position].price) || (key === 'settle' && current.cash < (s.debt?.amount || 0));
    }
    if (s.phase === 'buy') this.actionButtons.buy.textContent = `买下这里 · ${TOWN[current.position].price}`;
    if (s.phase === 'debt') this.actionButtons.settle.textContent = `偿还欠款 · ${s.debt.amount}`;
    root.querySelector('.town-action-note').textContent = s.status !== 'playing' ? '总资产包括现金、地产价值与房屋建造费。' : !this.started ? '每次操作自动保存，随时离开，随时继续。' : !human ? s.players[0].bankrupt ? '你已破产，正在观看电脑完成本局。' : '电脑会自动完成回合。' : s.phase === 'route' ? `剩余 ${s.journey.remaining} 步；选路不额外掷骰，最终停留处才触发事件。` : s.phase === 'debt' ? `还差 ${money(Math.max(0, s.debt.amount - current.cash))} 金币。点选“你的地产”卖房或抵押。` : s.phase === 'buy' ? current.cash < TOWN[current.position].price ? '现金不足购买，可以暂时跳过。' : '购买后，这处地产就会为你收租。' : '点选你的地产，可以升级、卖房或抵押。';
    const players = root.querySelector('.town-player-list'); players.replaceChildren();
    s.players.forEach((player, id) => {
      const row = document.createElement('div'); row.className = `town-player ${s.turn === id && s.status === 'playing' ? 'active' : ''} ${player.bankrupt ? 'out' : ''}`;
      row.innerHTML = `<span class="town-token player-${id}">${['你', '麦', '橙'][id]}</span><div><strong></strong><small></small></div><div class="town-balance"><strong></strong><small></small></div>`;
      row.children[1].firstChild.textContent = `${player.name}${id ? ' · 电脑' : ' · 玩家'}`;
      row.children[1].lastChild.textContent = player.bankrupt ? '已破产' : `${s.properties.filter(p => p.owner === id).length} 处地产`;
      row.children[2].firstChild.textContent = money(player.cash); row.children[2].lastChild.textContent = `资产 ${money(assets(s, id))}`; players.append(row);
    });
    this.renderProperty(playing && human);
    const journal = root.querySelector('.town-journal ol'); journal.replaceChildren(...s.log.slice(0, 8).map(line => { const node = document.createElement('li'); node.textContent = line; return node; }));
    const result = root.querySelector('.town-finish'); result.hidden = s.status !== 'finished';
    if (!result.hidden) {
      result.querySelector('h2').textContent = s.winners.includes(0) ? s.winners.length > 1 ? '并列第一，也是好生意。' : '小镇首富，就是你！' : `${s.winners.map(id => PLAYER_NAMES[id]).join('、')}赢得了这一局`;
      result.querySelector('ol').replaceChildren(...ranking(s).map(player => { const li = document.createElement('li'); li.textContent = `${player.name} · ${player.bankrupt ? '已破产' : `总资产 ${money(player.assets)}`}`; return li; }));
    }
    root.querySelector('.town-save-note').textContent = !this.storageAvailable ? '浏览器未允许保存，当前进度仅在本页有效。' : this.restoreFailed ? '旧存档无法读取，开始新局后会建立新存档。' : '进度自动保存在当前浏览器 · 离开即暂停';
  }
  renderProperty(enabled) {
    const root = this.root, index = this.selected, tile = TOWN[index], property = this.state.properties[index];
    const terrain = terrainFor(index), picture = root.querySelector('.town-location-image');
    root.querySelector('.town-open-details').textContent = `${tile.name} · ${terrain.name}　查看详情 ↓`;
    if (picture.getAttribute('src') !== terrain.image) picture.src = terrain.image;
    picture.alt = `${tile.name}所在的${terrain.name}街区插画`;
    root.querySelector('.town-terrain-description').textContent = `${terrain.name} · ${terrain.description}`;
    const title = root.querySelector('.town-property-title'); title.style.setProperty('--district', GROUPS[tile.group] || '#b4bd9e'); title.querySelector('span').textContent = String(index + 1).padStart(2, '0'); title.querySelector('h3').textContent = tile.name;
    root.querySelector('.town-property-owner').textContent = tile.price ? property.owner === null ? '等待第一位主人' : `属于${PLAYER_NAMES[property.owner]} · ${property.mortgaged ? '抵押中' : tile.type === 'station' ? '交通地产' : `${property.level} / 3 级房屋`}` : '小镇公共空间';
    const stats = root.querySelector('.town-property-stats'); stats.replaceChildren();
    const pairs = tile.price ? [['地价', tile.price], ['租金', property.owner === null ? tile.rent || 40 : rentAt(this.state, index)], ['抵押可得', mortgageValue(index)], ['升级费用', tile.type === 'land' ? upgradeCost(index) : '不可升级']] : [];
    pairs.forEach(([label, value]) => { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; stats.append(dt, dd); });
    root.querySelector('.town-property-note').textContent = !tile.price ? { start: '每次经过或落在这里，领取 200 金币。', chance: '随机抽取一张机会卡，有惊喜，也有小开销。', park: '歇一歇，领取 100 金币补给。', tax: '为小镇建设缴纳 150 金币。' }[tile.type] : property.owner === 0 ? '你的回合可管理；抵押前需卖出全部房屋。' : '点击地图或下方地产标签，查看经营详情。';
    const labels = { upgrade: `升级 −${upgradeCost(index)}`, sell: `卖房 +${Math.floor(upgradeCost(index) / 2)}`, mortgage: `抵押 +${mortgageValue(index)}`, redeem: `赎回 −${redeemCost(index)}` };
    for (const [action, node] of Object.entries(this.propertyButtons)) { node.textContent = labels[action]; node.hidden = property.owner !== 0 || (action === 'redeem' ? !property.mortgaged : property.mortgaged) || (['upgrade', 'sell'].includes(action) && tile.type !== 'land'); node.disabled = !enabled || !canManage(this.state, index, action); }
    const owned = this.state.properties.map((p, i) => p.owner === 0 ? i : -1).filter(i => i >= 0);
    root.querySelector('.town-owned h3 span').textContent = owned.length;
    const list = root.querySelector('.town-owned > div');
    for (const [i, node] of this.ownedNodes) if (!owned.includes(i)) { node.remove(); this.ownedNodes.delete(i); }
    if (!owned.length) {
      if (!list.querySelector('p')) { const empty = document.createElement('p'); empty.textContent = '第一处地产，在下一次掷骰之后。'; list.append(empty); }
    } else {
      list.querySelector('p')?.remove();
      owned.forEach(i => {
        let node = this.ownedNodes.get(i);
        if (!node) { node = button(TOWN[i].name, () => { this.selected = i; this.render(); }); node.classList.add('town-property-chip'); this.ownedNodes.set(i, node); list.append(node); }
        node.setAttribute('aria-pressed', String(i === index));
      });
    }
  }
  dialog(title, copy, label, callback) {
    const dialog = document.createElement('dialog'); dialog.className = 'dialog town-dialog'; dialog.setAttribute('aria-label', title);
    const heading = document.createElement('h2'); heading.textContent = title;
    const description = document.createElement('p'); description.className = 'dialog-description'; description.textContent = copy;
    const actions = document.createElement('div'); actions.className = 'dialog-actions';
    if (callback) actions.append(button('保留这一局', () => dialog.close()));
    actions.append(button(label, () => { dialog.close(); callback?.(); }, 'button-primary'));
    dialog.append(heading, description, actions); document.body.append(dialog); dialog.addEventListener('close', () => dialog.remove(), { once: true }); dialog.showModal();
  }
}
