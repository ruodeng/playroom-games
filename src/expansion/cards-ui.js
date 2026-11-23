export function shuffled(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const range = count => Array.from({ length: count }, (_, i) => i);
export const sum = values => values.reduce((total, value) => total + value, 0);
export const suits = ['♣', '♦', '♥', '♠'];
export const suitNames = ['梅花', '方块', '红心', '黑桃'];
export const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const suit = card => Math.floor(card / 13);
export const pip = card => card % 13;
export const face = card => suits[suit(card)] + ranks[pip(card)];
export const faceName = card => suitNames[suit(card)] + ranks[pip(card)];
export const red = card => [1, 2].includes(suit(card)) ? ' xc-red' : '';

export function action(id, label, { disabled = false, selected, className = '', name } = {}) {
  return `<button type="button" data-xc="${id}" class="xc-key ${className}"${disabled ? ' disabled' : ''}${selected === undefined ? '' : ` aria-pressed="${selected}"`}${name ? ` aria-label="${name}"` : ''}>${label}</button>`;
}

export function zone(title, content, className = 'xc-hand') {
  return `<section class="xc-zone"><h3>${title}</h3><div class="${className}">${content}</div></section>`;
}

export function facts(items) {
  return `<div class="xc-facts">${items.map(([key, value]) => `<div><small>${key}</small><strong>${value}</strong></div>`).join('')}</div>`;
}

export function deckButton(card, options = {}) {
  return action('card-' + card, face(card), { ...options, className: 'xc-card' + red(card), name: faceName(card) });
}

export function table(host, api, dispatch) {
  const root = document.createElement('div');
  root.className = 'xc-table';
  host.replaceChildren(root);
  let ended = false;
  root.addEventListener('click', event => {
    const button = event.target.closest('button[data-xc]');
    if (!ended && button && !button.disabled && root.contains(button)) dispatch(button.dataset.xc);
  }, { signal: api.signal });
  return {
    paint(markup) {
      const focused = root.contains(document.activeElement) ? document.activeElement.dataset.xc : null;
      root.innerHTML = markup;
      if (focused) {
        const next = root.querySelector(`button[data-xc="${focused}"]:not(:disabled)`) || root.querySelector('button:not(:disabled)');
        next?.focus({ preventScroll: true });
      }
    },
    end(message, metric = null) {
      if (ended) return;
      ended = true;
      root.querySelectorAll('button').forEach(button => { button.disabled = true; });
      api.end(message, metric);
    },
  };
}
