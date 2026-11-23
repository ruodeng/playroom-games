export function stats(...entries) {
  return `<dl class="sim-stats">${entries.map(([label, value]) =>
    `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
}

export function button(key, label, { disabled = false, pressed, kind = '', title } = {}) {
  return `<button type="button" class="sim-button ${kind}" data-sim-action="${key}"${disabled ? ' disabled' : ''}${pressed === undefined ? '' : ` aria-pressed="${pressed}"`}${title ? ` aria-label="${title}"` : ''}>${label}</button>`;
}

export function actions(...items) {
  return `<div class="x-actions sim-actions">${items.join('')}</div>`;
}

export function note(text) {
  return `<p class="x-note sim-note">${text}</p>`;
}

export function grid(cols, content, kind = '', label = '') {
  return `<div class="x-grid sim-grid ${kind}" style="--cols:${cols}"${label ? ` role="group" aria-label="${label}"` : ''}>${content.join('')}</div>`;
}

export function int(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function station(host, api, theme, view, move) {
  const surface = host.ownerDocument.createElement('div');
  surface.className = `sim-station sim-${theme}`;
  host.replaceChildren(surface);
  let finished = false;

  const draw = () => {
    const active = host.ownerDocument.activeElement;
    const focused = active?.dataset?.simAction;
    const previousIndex = focused && surface.contains(active)
      ? Array.from(surface.querySelectorAll('button')).indexOf(active)
      : -1;
    surface.innerHTML = view(finished);
    if (previousIndex >= 0) {
      const controls = Array.from(surface.querySelectorAll('button'));
      const next = controls.find(control => control.dataset.simAction === focused && !control.disabled)
        ?? controls.slice(previousIndex).find(control => !control.disabled)
        ?? controls.slice(0, previousIndex).findLast(control => !control.disabled);
      (next ?? surface).focus({ preventScroll: true });
    }
  };

  surface.tabIndex = -1;
  surface.addEventListener('click', event => {
    const control = event.target.closest('[data-sim-action]');
    if (!control || control.disabled || finished || api.signal.aborted) return;
    const result = move(control.dataset.simAction);
    if (result?.end) finished = true;
    draw();
    if (result?.message) api.status(result.message);
    if (finished) api.end(result.end, result.metric ?? null);
  }, { signal: api.signal });
  draw();
}
