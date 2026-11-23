export const WIDTH = 360;
export const TAU = Math.PI * 2;
export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function circle(ctx, x, y, radius, fill, stroke, width = 1) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

export function pill(ctx, x, y, w, h, radius, color) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = color;
  ctx.fill();
}

export function line(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
}

export function text(ctx, value, x, y, size = 13, color = '#fff9ea', align = 'center') {
  ctx.font = `600 ${size}px "Segoe UI", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

export function polygon(ctx, points, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
}

export function star(ctx, x, y, outer, inner, fill) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 ? inner : outer;
    return [x + Math.sin(i * Math.PI / 5) * radius, y - Math.cos(i * Math.PI / 5) * radius];
  });
  polygon(ctx, points, fill);
}

export function nearestPoint(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return { x: ax + t * dx, y: ay + t * dy };
}

export function reflect(value, low, high) {
  const width = high - low;
  const phase = ((value - low) % (width * 2) + width * 2) % (width * 2);
  return low + (phase <= width ? phase : width * 2 - phase);
}

export function screen(host, api, name, height, background) {
  const doc = host.ownerDocument;
  const section = doc.createElement('div');
  section.style.cssText = 'display:grid;gap:10px;width:min(100%,400px);margin-inline:auto;min-width:0';
  const stats = doc.createElement('div');
  stats.style.cssText = 'font-size:.88rem;font-weight:650;text-align:center;font-variant-numeric:tabular-nums';
  const canvas = doc.createElement('canvas');
  canvas.width = WIDTH * 2;
  canvas.height = height * 2;
  canvas.style.cssText = 'width:100%;height:auto;display:block;border-radius:14px;touch-action:none';
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', `${name}游戏场地。键盘操作参见玩法说明。`);
  canvas.textContent = `${name}游戏场地`;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  const controls = doc.createElement('div');
  controls.className = 'x-actions';
  controls.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:6px';
  section.append(stats, canvas, controls);
  host.replaceChildren(section);
  let done = false;
  let message;
  const on = (target, type, callback) => {
    target.addEventListener(type, event => {
      if (!done && !host.inert && !doc.querySelector('dialog[open]')) callback(event);
    }, { signal: api.signal });
  };
  const button = (label, action) => {
    const el = doc.createElement('button');
    el.type = 'button';
    el.className = 'button button-secondary';
    el.style.cssText = 'padding:7px 10px;min-width:44px;min-height:44px;touch-action:none';
    el.textContent = label;
    if (action) on(el, 'click', action);
    controls.append(el);
    return el;
  };
  const heldInputs = new Set();
  const keyDown = new Map();
  on(doc, 'keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    if (event.target.closest?.('input, textarea, select, [contenteditable]')) return;
    const key = event.key.toLowerCase();
    if ((key === ' ' || key === 'enter') && event.target.closest?.('button, a')) return;
    const callback = keyDown.get(key);
    if (!callback) return;
    event.preventDefault();
    if (!event.repeat) callback();
  });
  const release = new Map();
  doc.addEventListener('keyup', event => release.get(event.key.toLowerCase())?.(), { signal: api.signal });
  doc.defaultView?.addEventListener('blur', () => heldInputs.clear(), { signal: api.signal });
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) heldInputs.clear(); }, { signal: api.signal });
  const Observer = doc.defaultView?.MutationObserver;
  if (Observer) {
    const observer = new Observer(() => { if (host.inert) heldInputs.clear(); });
    observer.observe(host, { attributes: true, attributeFilter: ['inert'] });
    api.signal.addEventListener('abort', () => observer.disconnect(), { once: true });
  }
  return {
    ctx, canvas, controls, button, on,
    clear(color = background) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, WIDTH, height);
    },
    readout(value) { if (stats.textContent !== value) stats.textContent = value; },
    say(value) { if (message !== value) { message = value; api.status(value); } },
    end(value, metric) {
      if (done) return;
      done = true;
      heldInputs.clear();
      for (const control of controls.querySelectorAll('button')) control.disabled = true;
      api.end(value, metric);
    },
    run(update, draw) {
      draw();
      canvas.focus({ preventScroll: true });
      api.frame(delta => {
        if (done || api.signal.aborted) return;
        if (delta > 0) update(Math.min(delta, .1));
        draw();
      });
    },
    point(event) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * WIDTH / (rect.width || WIDTH),
        y: (event.clientY - rect.top) * height / (rect.height || height),
      };
    },
    keys(keys, callback) { for (const key of keys) keyDown.set(key, callback); },
    hold(label, keys) {
      const el = button(label);
      const pointerInput = Symbol();
      const keyboardInput = Symbol();
      for (const key of keys) {
        keyDown.set(key, () => heldInputs.add(key));
        release.set(key, () => heldInputs.delete(key));
      }
      on(el, 'pointerdown', event => {
        if (event.button !== 0) return;
        el.setPointerCapture(event.pointerId);
        heldInputs.add(pointerInput);
      });
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        el.addEventListener(event, () => heldInputs.delete(pointerInput), { signal: api.signal });
      }
      on(el, 'keydown', event => {
        if (event.key === ' ' || event.key === 'Enter') heldInputs.add(keyboardInput);
      });
      for (const event of ['keyup', 'blur']) {
        el.addEventListener(event, () => heldInputs.delete(keyboardInput), { signal: api.signal });
      }
      return () => heldInputs.has(pointerInput) || heldInputs.has(keyboardInput) || keys.some(key => heldInputs.has(key));
    },
  };
}

export function directions(view, move) {
  for (const [label, key, alias, x, y] of [
    ['↑', 'arrowup', 'w', 0, -1], ['←', 'arrowleft', 'a', -1, 0],
    ['↓', 'arrowdown', 's', 0, 1], ['→', 'arrowright', 'd', 1, 0],
  ]) {
    const action = () => move(x, y);
    const button = view.button(label, action);
    button.setAttribute('aria-label', ({ '↑': '向上', '←': '向左', '↓': '向下', '→': '向右' })[label]);
    view.keys([key, alias], action);
  }
}
