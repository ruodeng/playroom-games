export function setup(host, api, id) {
  const document = host.ownerDocument;
  const actions = new WeakMap();

  function element(tag, className = '', text = '') {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== '') node.textContent = text;
    return node;
  }

  const root = element('section', `words-game words-${id}`);
  root.tabIndex = -1;
  host.replaceChildren(root);
  root.addEventListener('click', event => {
    const control = event.target.closest('button');
    if (control && !control.disabled && !api.signal.aborted) actions.get(control)?.();
  }, { signal: api.signal });

  function button(key, text, action, { label, pressed, disabled = false, style = '' } = {}) {
    const node = element('button', `words-button ${style}`, text);
    node.type = 'button';
    node.dataset.wordKey = key;
    node.disabled = disabled;
    if (label) node.setAttribute('aria-label', label);
    if (pressed !== undefined) node.setAttribute('aria-pressed', String(pressed));
    actions.set(node, action);
    return node;
  }

  function group(className, children, label) {
    const node = element('div', className);
    if (label) {
      node.setAttribute('role', 'group');
      node.setAttribute('aria-label', label);
    }
    node.append(...children);
    return node;
  }

  function grid(columns, children, label, style = '') {
    const node = group(`x-grid words-grid ${style}`, children, label);
    node.style.setProperty('--cols', columns);
    return node;
  }

  function paint(...children) {
    const previous = document.activeElement;
    const wasInside = root.contains(previous);
    root.replaceChildren(...children);
    if (wasInside && previous !== root) {
      const next = [...root.querySelectorAll('[data-word-key]:not(:disabled)')];
      const focus = next.find(node => node.dataset.wordKey === previous.dataset.wordKey) ?? next[0] ?? root;
      focus.focus({ preventScroll: true });
    }
  }

  return {
    element, button, grid, paint,
    actions: (...children) => group('x-actions words-actions', children),
    toolbar: (...labels) => group('x-toolbar words-toolbar', labels.map(label => element('span', '', label))),
    note: text => element('p', 'x-note words-note', text),
    prompt: text => element('p', 'words-prompt', text),
    message: text => element('p', 'words-message', text),
    next: (advance, text = '下一题') => button('advance', text, advance, { style: 'words-primary' }),
  };
}

export function scoreTime(api, penalty = 0) {
  return Math.max(1, Math.ceil(api.elapsed())) + penalty;
}
