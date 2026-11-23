import { ArcadePanel } from './arcade-panel.js';
import { MonopolyPanel } from './monopoly-ui.js';
import { EXTRA_GAMES, SITE_GAMES, renderGameCard, renderGameNav } from './site-games.js';

export function createArcadeController() {
  const panels = new Map();
  const definitions = new Map(EXTRA_GAMES.map(game => [game.id, game]));
  const library = document.querySelector('.library-grid');
  const nav = document.querySelector('.sidebar nav');
  if (!nav.querySelector('#nav-gomoku')) nav.insertAdjacentHTML('beforeend', SITE_GAMES.filter(game => !game.group).map(game => renderGameNav(game)).join(''));
  if (!library.children.length) library.innerHTML = SITE_GAMES.map(renderGameCard).join('');
  let current = null;
  document.addEventListener('keydown', event => current?.key(event));
  document.addEventListener('keyup', event => current?.keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => current?.pause());
  window.addEventListener('pagehide', () => current?.pause());
  document.addEventListener('visibilitychange', () => { if (document.hidden) current?.pause(); });
  return {
    has: id => definitions.has(id),
    title: id => definitions.get(id)?.name,
    setActive(id) {
      if (definitions.has(id) && !panels.has(id)) {
        panels.set(id, id === 'monopoly' ? new MonopolyPanel() : new ArcadePanel(definitions.get(id)));
      }
      current = panels.get(id) || null;
      for (const [key, panel] of panels) panel.setActive(key === id);
      for (const key of definitions.keys()) {
        const link = document.querySelector(`#nav-${key}`); link.classList.toggle('active', key === id);
        if (key === id) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
      }
    },
  };
}
