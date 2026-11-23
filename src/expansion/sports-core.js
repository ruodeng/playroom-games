const TAU = Math.PI * 2;

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const radians = degrees => degrees * Math.PI / 180;
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const speed = body => Math.hypot(body.vx, body.vy);
export const disk = (x, y, radius) => ({ x, y, radius, vx: 0, vy: 0 });
export const position = ([x, y]) => ({ x, y });
export const inside = (body, [x, y, w, h]) =>
  body.x >= x && body.x <= x + w && body.y >= y && body.y <= y + h;

export function throwDisk(body, angle, force) {
  body.vx = Math.cos(angle) * force;
  body.vy = Math.sin(angle) * force;
}

export function moveDisk(body, time, drag) {
  body.x += body.vx * time;
  body.y += body.vy * time;
  const slow = Math.exp(-drag * time);
  body.vx *= slow;
  body.vy *= slow;
}

export function containDisk(body, [left, top, right, bottom], bounce) {
  const x = clamp(body.x, left + body.radius, right - body.radius);
  const y = clamp(body.y, top + body.radius, bottom - body.radius);
  if (x !== body.x) body.vx *= -bounce;
  if (y !== body.y) body.vy *= -bounce;
  body.x = x;
  body.y = y;
}

export function hitWall(body, [x, y, w, h], bounce) {
  const nearX = clamp(body.x, x, x + w);
  const nearY = clamp(body.y, y, y + h);
  const dx = body.x - nearX;
  const dy = body.y - nearY;
  const gap = Math.hypot(dx, dy);
  if (gap >= body.radius) return;
  let nx = dx / gap;
  let ny = dy / gap;
  let correction = body.radius - gap;
  if (!gap) {
    const sides = [[body.x - x, -1, 0], [x + w - body.x, 1, 0], [body.y - y, 0, -1], [y + h - body.y, 0, 1]];
    const [edgeGap, dirX, dirY] = sides.reduce((a, b) => a[0] < b[0] ? a : b);
    nx = dirX;
    ny = dirY;
    correction = edgeGap + body.radius;
  }
  body.x += nx * correction;
  body.y += ny * correction;
  const normalSpeed = body.vx * nx + body.vy * ny;
  if (normalSpeed < 0) {
    body.vx -= (1 + bounce) * normalSpeed * nx;
    body.vy -= (1 + bounce) * normalSpeed * ny;
  }
}

export function collideDisks(a, b, bounce = .9) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const gap = Math.hypot(dx, dy);
  const overlap = a.radius + b.radius - gap;
  if (overlap <= 0) return;
  const nx = gap ? dx / gap : 1;
  const ny = gap ? dy / gap : 0;
  a.x -= nx * overlap / 2;
  a.y -= ny * overlap / 2;
  b.x += nx * overlap / 2;
  b.y += ny * overlap / 2;
  const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (closing <= 0) return;
  const impulse = closing * (1 + bounce) / 2;
  a.vx -= impulse * nx;
  a.vy -= impulse * ny;
  b.vx += impulse * nx;
  b.vy += impulse * ny;
}

export function substeps(dt, update, resolution = 160) {
  const steps = Math.ceil(dt * resolution);
  for (let i = 0; i < steps; i++) if (update(dt / steps) === false) break;
}

export function box(ctx, x, y, width, height, fill, radius = 0) {
  ctx.fillStyle = fill;
  if (!radius) {
    ctx.fillRect(x, y, width, height);
    return;
  }
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

export function circle(ctx, x, y, radius, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
}

export function ellipse(ctx, x, y, rx, ry, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}

export function line(ctx, points, color, width = 1, dash = []) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function lettering(ctx, value, x, y, color = '#35472c', size = 12) {
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
}

export function guide(ctx, ball, angle, length, color = '#eaf6d6') {
  const end = [ball.x + Math.cos(angle) * length, ball.y + Math.sin(angle) * length];
  line(ctx, [[ball.x, ball.y], end], color, 2, [4, 4]);
  circle(ctx, ...end, 3, color);
}

export function stage(host, api, name, width, height, stats) {
  const doc = host.ownerDocument;
  const listen = (node, type, handler) => node.addEventListener(type, handler, { signal: api.signal });
  function element(tag, className, parent, value) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    parent.append(node);
    return node;
  }
  host.replaceChildren();
  const root = element('div', 'sports-game', host);
  const list = element('dl', 'sports-stats', root);
  const values = stats.map(([label, value]) => {
    const item = element('div', '', list);
    element('dt', '', item, label);
    return element('dd', '', item, value);
  });
  const canvas = element('canvas', 'sports-board', root, `${name}场地。可使用下方按钮和键盘操作。`);
  canvas.width = width * 2;
  canvas.height = height * 2;
  canvas.tabIndex = -1;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${name}场地`);
  const ctx = canvas.getContext('2d');
  ctx?.scale(2, 2);
  const instruments = element('div', '', root);
  instruments.hidden = true;
  const controls = element('div', 'x-actions sports-controls', root);
  let finished = false;
  const interactive = [];
  const keys = new Map();
  const released = new Map();
  const activeKeys = new Set();
  const resetControls = [];
  function finish(message, metric) {
    if (finished || api.signal.aborted) return;
    finished = true;
    for (const node of interactive) node.disabled = true;
    api.end(message, metric);
  }
  function button(name, action, primary = false) {
    const node = element('button', `button${primary ? ' sports-primary' : ''}`, controls, name);
    node.type = 'button';
    interactive.push(node);
    listen(node, 'click', action);
    return node;
  }
  function slider(label, min, max, value, change, step = 1) {
    const wrapper = element('label', 'sports-slider', controls);
    const caption = element('span', '', wrapper);
    const input = element('input', '', wrapper);
    input.type = 'range';
    input.min = min;
    input.max = max;
    input.step = step;
    input.setAttribute('aria-label', label);
    const set = next => {
      input.value = clamp(next, min, max);
      caption.textContent = `${label} ${input.value}`;
      change(Number(input.value));
    };
    set(value);
    listen(input, 'input', () => set(Number(input.value)));
    interactive.push(input);
    return set;
  }
  function key(keyName, action, release) {
    keys.set(keyName, action);
    if (release) released.set(keyName, release);
  }
  function releaseAll() {
    for (const name of activeKeys) released.get(name)?.();
    activeKeys.clear();
  }
  listen(doc, 'keydown', event => {
    if (finished || host.inert || event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
    const action = keys.get(event.key);
    if (!action || event.target?.matches?.('input, textarea, select, [contenteditable]')) return;
    if (event.key === ' ' && event.target?.closest?.('button, a')) return;
    event.preventDefault();
    if (!event.repeat && !activeKeys.has(event.key)) {
      activeKeys.add(event.key);
      action();
    } else if (event.repeat && !released.has(event.key) && event.key.startsWith('Arrow')) {
      action();
    }
  });
  listen(doc, 'keyup', event => {
    if (activeKeys.delete(event.key)) released.get(event.key)?.();
  });
  listen(doc.defaultView, 'blur', releaseAll);
  listen(doc, 'visibilitychange', () => { if (doc.hidden) releaseAll(); });
  function hold(name, keyName, primary = false) {
    let pointer = null;
    let keyboard = false;
    let clicked = false;
    const node = button(name, event => {
      if (event.detail === 0 && !keyboard) {
        clicked = !clicked;
        update();
      }
    }, primary);
    node.dataset.hold = '';
    const active = () => pointer !== null || keyboard || clicked;
    const update = () => node.setAttribute('aria-pressed', String(active()));
    const clear = () => { pointer = null; keyboard = false; clicked = false; update(); };
    listen(node, 'pointerdown', event => {
      if (node.disabled || pointer !== null || event.button !== 0) return;
      clicked = false;
      pointer = event.pointerId;
      node.setPointerCapture(event.pointerId);
      update();
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      listen(node, type, event => { if (pointer === event.pointerId) { pointer = null; update(); } });
    }
    listen(doc.defaultView, 'blur', clear);
    listen(doc, 'visibilitychange', () => { if (doc.hidden) clear(); });
    resetControls.push(clear);
    key(keyName, () => { clicked = false; keyboard = true; update(); }, () => { keyboard = false; update(); });
    update();
    return active;
  }
  function pointer(action, release) {
    canvas.dataset.pointer = '';
    let current = null;
    function point(event) {
      const rect = canvas.getBoundingClientRect();
      return { x: (event.clientX - rect.left) * width / rect.width, y: (event.clientY - rect.top) * height / rect.height };
    }
    listen(canvas, 'pointerdown', event => {
      if (finished || current !== null || event.button !== 0) return;
      current = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
      action(point(event));
    });
    listen(canvas, 'pointermove', event => { if (current === event.pointerId && !finished) action(point(event)); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      listen(canvas, type, event => {
        if (current !== event.pointerId) return;
        current = null;
        release?.();
      });
    }
    const clear = () => { current = null; release?.(); };
    listen(doc.defaultView, 'blur', clear);
    listen(doc, 'visibilitychange', () => { if (doc.hidden) clear(); });
    resetControls.push(clear);
  }
  function meter(label) {
    instruments.hidden = false;
    const track = element('div', 'sports-meter', instruments);
    track.setAttribute('role', 'meter');
    track.setAttribute('aria-label', label);
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    const range = element('span', 'sports-meter-range', track);
    const fill = element('span', 'sports-meter-fill', track);
    const marker = element('span', 'sports-meter-marker', track);
    return (value, band, valueText) => {
      const percent = Math.round(clamp(value, 0, 1) * 100);
      if (track.getAttribute('aria-valuenow') !== String(percent)) track.setAttribute('aria-valuenow', percent);
      if (valueText && track.getAttribute('aria-valuetext') !== valueText) track.setAttribute('aria-valuetext', valueText);
      range.hidden = !band;
      fill.hidden = !!band;
      marker.hidden = !band;
      if (band) {
        range.style.left = `${clamp(band[0], 0, 1) * 100}%`;
        range.style.width = `${(clamp(band[1], 0, 1) - clamp(band[0], 0, 1)) * 100}%`;
        marker.style.left = `${percent}%`;
      } else {
        fill.style.width = `${percent}%`;
      }
    };
  }
  function frame(update, draw) {
    if (ctx) draw(ctx);
    canvas.focus?.({ preventScroll: true });
    let started = false;
    api.frame(dt => {
      if (finished || api.signal.aborted) return;
      if (started && dt === 0) {
        releaseAll();
        for (const reset of resetControls) reset();
      }
      started = true;
      update(dt);
      if (ctx) draw(ctx);
    });
  }
  function stat(...next) {
    next.forEach((value, index) => {
      if (value !== undefined && String(value) !== values[index].textContent) values[index].textContent = String(value);
    });
  }
  return { button, finish, frame, hold, key, meter, pointer, slider, stat, status: message => api.status(message) };
}

export function aimControls(ui, origin, ready, fire, initialPower, fireLabel, initialAngle = -90) {
  let angle;
  let power;
  const setAngle = ui.slider('方向', -180, 180, initialAngle, next => { angle = next; }, .1);
  const setPower = ui.slider('力度', 5, 100, initialPower, next => { power = next; });
  const fireButton = ui.button(fireLabel, launch, true);
  function launch() {
    if (ready()) fire(radians(angle), power);
  }
  function turn(step) {
    setAngle((angle + step + 540) % 360 - 180);
  }
  ui.pointer(point => {
    if (!ready()) return;
    const ball = origin();
    if (distance(ball, point) >= 4) setAngle(Math.round(Math.atan2(point.y - ball.y, point.x - ball.x) / Math.PI * 1800) / 10);
  });
  ui.key('ArrowLeft', () => turn(-3));
  ui.key('ArrowRight', () => turn(3));
  ui.key('ArrowUp', () => setPower(power + 3));
  ui.key('ArrowDown', () => setPower(power - 3));
  ui.key(' ', launch);
  return { get angle() { return radians(angle); }, get power() { return power; }, fireButton, setAngle };
}
