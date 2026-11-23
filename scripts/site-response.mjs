import { getPage, SITE_ORIGIN, SITE_PATHS } from '../src/site-pages.js';
import { renderRecordsView } from '../src/records-view.js';
import { renderPage } from './render-page.mjs';

export function sitemapXml() {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + SITE_PATHS.map(path => `  <url><loc>${SITE_ORIGIN}${path}</loc></url>`).join('\n') + '\n</urlset>\n';
}

export function robotsTxt() {
  return `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;
}

export async function serveSiteRequest(request, { template, records, gaMeasurementId, verificationToken }) {
  const url = new URL(request.url);
  const path = url.pathname;
  const publicSite = url.origin === SITE_ORIGIN;
  const headers = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' };
  if (!publicSite) headers['X-Robots-Tag'] = 'noindex';
  function reply(body, contentType, status = 200) {
    return new Response(request.method === 'HEAD' ? null : body, { status, headers: { ...headers, 'Content-Type': contentType } });
  }
  const cleanPath = path === '/index.html' ? '/' : path.replace(/\/+$/, '') || '/';
  const page = getPage(cleanPath);
  if (!page && path !== '/sitemap.xml' && path !== '/robots.txt') return null;
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  if (page && (path !== cleanPath || (path === '/records' && url.searchParams.has('game')))) {
    const boardPath = '/records/' + url.searchParams.get('game');
    let to = cleanPath + url.search;
    if (cleanPath === '/records' && url.searchParams.has('game')) to = getPage(boardPath)?.path ?? '/records';
    return new Response(null, { status: 308, headers: { Location: to } });
  }
  if (path === '/sitemap.xml') return reply(sitemapXml(), 'application/xml; charset=utf-8');
  if (path === '/robots.txt') return reply(publicSite ? robotsTxt() : 'User-agent: *\nDisallow: /\n', 'text/plain; charset=utf-8');
  const tags = [`<link rel="canonical" href="${SITE_ORIGIN}${page.path}">`];
  if (publicSite && /^G-[A-Z0-9]+$/.test(gaMeasurementId ?? '')) {
    tags.push(`<meta name="ga-measurement-id" content="${gaMeasurementId}">`);
    // Count the SSR page even while the browser is still downloading game modules.
    // A legacy bookmark gets its real title and canonical URL during hydration.
    tags.push('<script type="module" async>import { initAnalytics } from "/src/site-analytics.js"; if (!location.hash.startsWith("#/")) initAnalytics();</script>');
  }
  if (publicSite && verificationToken && /^[A-Za-z0-9_-]+$/.test(verificationToken)) {
    tags.push(`<meta name="google-site-verification" content="${verificationToken}">`);
  }
  let recordsHtml = '';
  if (page.kind === 'records') {
    const leaderboard = await records.publicBoard(page.id);
    recordsHtml = renderRecordsView(page.id, leaderboard);
  }
  return reply(renderPage(template, page, { head: tags.join('\n  '), recordsHtml }), 'text/html; charset=utf-8');
}
