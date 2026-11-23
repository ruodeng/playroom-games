import { getPage, legacyPath } from './site-pages.js';

let renderRoute;

function showCurrentPage() {
  const oldPath = legacyPath(location.hash);
  if (oldPath) history.replaceState(history.state, '', oldPath);
  const page = getPage(location.pathname);
  if (!page) { location.reload(); return; }
  renderRoute(page);
  window.dispatchEvent(new Event('playroom:navigate'));
}

export function navigate(path) {
  const url = new URL(path, location.href);
  if (url.origin !== location.origin || !getPage(url.pathname)) { location.assign(url.href); return; }
  if (url.href === location.href) return;
  history.pushState(null, '', url.pathname + url.search + url.hash);
  showCurrentPage();
}

export function startNavigation(render) {
  renderRoute = render;
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const link = event.target.closest?.('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.hash || !getPage(url.pathname)) return;
    event.preventDefault();
    navigate(url.href);
  });
  window.addEventListener('popstate', showCurrentPage);
  window.addEventListener('hashchange', () => { if (legacyPath(location.hash)) showCurrentPage(); });
  showCurrentPage();
}
