const left = ['left', '← 左', ['arrowleft', 'a'], true];
const right = ['right', '右 →', ['arrowright', 'd'], true];
const up = ['up', '↑ 上', ['arrowup', 'w'], true];
const down = ['down', '↓ 下', ['arrowdown', 's'], true];
export const horizontal = [left, right];
export const directions = [left, up, down, right];
export const actionButton = (label, keys = [' '], held = false) => ['action', label, keys, held];
export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
export const sign = (negative, positive) => Number(positive) - Number(negative);
export const duration = api => Math.max(1, Math.ceil(api.elapsed()));

export function createScene(host, api, { width = 360, height = 300, label, controls }) {
  const root = document.createElement('div');
  root.className = 'exp-action';
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label);
  canvas.textContent = `${label}。游戏进度显示在状态栏。`;
  const toolbar = document.createElement('div');
  toolbar.className = 'x-actions exp-action-controls';
  toolbar.setAttribute('role', 'group');
  toolbar.setAttribute('aria-label', '游戏操作');
  root.append(canvas, toolbar);
  host.replaceChildren(root);

  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  const buttons = new Map();
  const keyMap = new Map();
  const keyboard = new Map();
  const pointers = new Map();
  const pending = new Set();
  const pulse = new Set();
  const listen = (element, event, fn) => element.addEventListener(event, fn, { signal: api.signal });
  let ended = false;
  let lastStatus;
  let lastStatusTime = -Infinity;

  function held(action) {
    for (const pressed of keyboard.values()) if (pressed === action) return true;
    for (const pressed of pointers.values()) if (pressed === action) return true;
    return false;
  }
  function updateButtons() {
    for (const [action, button] of buttons) {
      if (button.hasAttribute('aria-pressed')) button.setAttribute('aria-pressed', String(held(action)));
    }
  }
  for (const [action, title, keys, continuous] of controls) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = title;
    if (continuous) button.setAttribute('aria-pressed', 'false');
    const shortcuts = keys.map(key => key === ' ' ? 'Space' : key.length === 1 ? key.toUpperCase() : `Arrow${key[5].toUpperCase()}${key.slice(6)}`);
    if (shortcuts.length) button.setAttribute('aria-keyshortcuts', shortcuts.join(' '));
    for (const key of keys) keyMap.set(key, action);
    buttons.set(action, button);
    toolbar.append(button);
    listen(button, 'pointerdown', event => {
      if (ended || event.button !== 0) return;
      pending.add(action);
      pointers.set(event.pointerId, action);
      button.setPointerCapture(event.pointerId);
      updateButtons();
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      listen(button, name, event => {
        pointers.delete(event.pointerId);
        updateButtons();
      });
    }
    listen(button, 'click', event => {
      if (!ended && event.detail === 0) pending.add(action);
    });
  }
  listen(window, 'keydown', event => {
    const key = event.key.toLowerCase();
    const action = keyMap.get(key);
    const editable = event.target?.closest?.('input,select,textarea,[contenteditable="true"]');
    const externalButton = event.target?.closest?.('button,a') && !root.contains(event.target);
    if (ended || host.inert || !action || editable || event.ctrlKey || event.metaKey || event.altKey || (key === ' ' && externalButton)) return;
    event.preventDefault();
    if (keyboard.has(key)) return;
    pending.add(action);
    keyboard.set(key, action);
    updateButtons();
  });
  listen(window, 'keyup', event => {
    if (keyboard.delete(event.key.toLowerCase())) updateButtons();
  });
  function releaseInputs() {
    keyboard.clear();
    pointers.clear();
    pending.clear();
    pulse.clear();
    updateButtons();
  }
  listen(window, 'blur', releaseInputs);
  listen(host, 'playroom:round-pause', releaseInputs);

  return {
    ctx, width, height,
    down: action => pulse.has(action) || held(action),
    press: action => pending.delete(action),
    axis: (negative, positive) => sign(pulse.has(negative) || held(negative), pulse.has(positive) || held(positive)),
    status(message, interval = 0) {
      if (ended || message === lastStatus) return;
      const now = api.elapsed();
      if (now - lastStatusTime < interval) return;
      lastStatus = message;
      lastStatusTime = now;
      api.status(message);
    },
    end(message, metric = null) {
      if (ended) return;
      ended = true;
      for (const button of buttons.values()) button.disabled = true;
      keyboard.clear();
      pointers.clear();
      pending.clear();
      updateButtons();
      api.end(message, metric);
    },
    start(step, draw) {
      draw();
      api.frame(delta => {
        if (ended || delta <= 0) return;
        for (const action of pending) pulse.add(action);
        const elapsed = Math.min(delta, .06);
        const count = Math.ceil(elapsed * 120);
        for (let index = 0; index < count && !ended; index++) step(elapsed / count);
        pending.clear();
        pulse.clear();
        draw();
      });
    },
  };
}

export function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

export function pill(ctx, x, y, w, h, radius, color) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = color;
  ctx.fill();
}

export function disk(ctx, x, y, radius, color) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

export function path(ctx, points, color) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export function line(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

export function caption(ctx, value, x, y, color = '#fff6df', size = 12, align = 'left') {
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}

export function gem(ctx, x, y, color, highlight, radius = 7) {
  path(ctx, [[x - radius, y - radius * .3], [x, y - radius], [x + radius, y - radius * .3], [x, y + radius]], color);
  path(ctx, [[x - radius, y - radius * .3], [x, y - radius], [x + radius * .35, y - radius * .3], [x, y + radius]], highlight);
}

export function backdrop(ctx, width, height, top, bottom) {
  const shade = ctx.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(0, top);
  shade.addColorStop(1, bottom);
  rect(ctx, 0, 0, width, height, shade);
}
