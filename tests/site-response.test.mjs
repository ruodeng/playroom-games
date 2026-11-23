import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { serveSiteRequest } from '../scripts/site-response.mjs';
import { legacyPath, SITE_ORIGIN } from '../src/site-pages.js';

const template = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const opts = { template, records: { publicBoard: () => ({ entries: [], players: 0 }) }, gaMeasurementId: 'G-TEST' };
const fetchPage = (path, method = 'GET', origin = SITE_ORIGIN) => serveSiteRequest(new Request(origin + path, { method }), opts);

test('every sitemap location is unique and serves its own canonical HTML', async () => {
  const response = await fetchPage('/sitemap.xml');
  assert.match(response.headers.get('content-type'), /application\/xml/);
  const urls = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.equal(urls.length, 227);
  assert.equal(new Set(urls).size, urls.length);
  for (const url of urls) {
    assert.equal(new URL(url).origin, SITE_ORIGIN);
    const page = await serveSiteRequest(new Request(url), opts);
    assert.equal(page.status, 200, url);
    const body = await page.text();
    assert.ok(body.includes(`<link rel="canonical" href="${url}">`), url);
    assert.ok(body.includes('name="ga-measurement-id"'), url);
  }
});

test('normalizes historical entry points and leaves static/unknown routes to the host', async () => {
  for (const [from, to] of [['/index.html', '/'], ['/games/snake/', '/games/snake'], ['/records?game=water-2', '/records/water-2']]) {
    const page = await fetchPage(from);
    assert.equal(page.status, 308);
    assert.equal(page.headers.get('location'), to);
  }
  assert.equal(legacyPath('#/records?game=lights'), '/records/lights');
  assert.equal(legacyPath('#/snake'), '/games/snake');
  assert.equal(await fetchPage('/games/missing'), null);
  assert.equal((await fetchPage('/games/snake', 'POST')).status, 405);
  assert.equal(await (await fetchPage('/', 'HEAD')).text(), '');
  const local = await fetchPage('/', 'GET', 'http://127.0.0.1:5173');
  assert.equal(local.headers.get('x-robots-tag'), 'noindex');
  assert.doesNotMatch(await local.text(), /name="ga-measurement-id"/);
  assert.match(await (await fetchPage('/robots.txt')).text(), /Sitemap: https:\/\/games\.uutom\.com\/sitemap\.xml/);
});
