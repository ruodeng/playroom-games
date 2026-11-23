import assert from 'node:assert/strict';
import test from 'node:test';
import { initAnalytics } from '../src/site-analytics.js';

test('GA4 loads only for a configured same-origin HTTPS page and records each canonical route transition once', t => {
  const origin = 'https://playroom.example.test';
  const measurementId = 'G-UNITTEST';
  const window = Object.assign(new EventTarget(), { location: new URL(origin) });
  const scripts = [];
  let canonical = origin;
  let measurement = null;
  const document = {
    title: '游戏大厅',
    referrer: 'https://search.example.test/user/sample?query=private#details',
    head: {
      querySelector(selector) {
        if (selector === 'meta[name="ga-measurement-id"]') return measurement;
        if (selector === 'link[rel="canonical"]') return { getAttribute: () => canonical };
        return null;
      },
      append(script) { scripts.push(script); },
    },
    createElement() { return {}; },
  };
  const original = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document });
  t.after(() => Object.assign(globalThis, original));

  initAnalytics();
  measurement = { content: 'UA-123' };
  initAnalytics();
  measurement.content = measurementId;
  canonical = 'https://other.example.test/';
  initAnalytics();
  window.location = new URL('http://playroom.example.test/');
  canonical = window.location.href;
  initAnalytics();
  assert.equal(window.dataLayer, undefined);
  assert.equal(scripts.length, 0);

  window.location = new URL(origin);
  canonical = `${origin}/?query=private#unknown`;
  initAnalytics();
  initAnalytics();
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].referrerPolicy, 'no-referrer');
  assert.equal(new URL(scripts[0].src).searchParams.get('id'), measurementId);

  function navigate(path, title) {
    canonical = origin + path;
    document.title = title;
    window.dispatchEvent(new Event('playroom:navigate'));
  }

  navigate('/games/snake/?secret=private', '贪吃蛇');
  navigate('/games/snake/#rules', '贪吃蛇');
  navigate('/', '游戏大厅');
  navigate('/games/snake/', '贪吃蛇');

  const configs = window.dataLayer.filter(([command]) => command === 'config');
  assert.equal(configs.length, 1);
  assert.equal(configs[0][2].send_page_view, false);
  const pageViews = window.dataLayer
    .filter(([command, event]) => command === 'event' && event === 'page_view')
    .map(([, , page]) => page);
  assert.deepEqual(pageViews, [
    { page_location: `${origin}/`, page_title: '游戏大厅', page_referrer: 'https://search.example.test', send_to: measurementId },
    { page_location: `${origin}/games/snake/`, page_title: '贪吃蛇', page_referrer: `${origin}/`, send_to: measurementId },
    { page_location: `${origin}/`, page_title: '游戏大厅', page_referrer: `${origin}/games/snake/`, send_to: measurementId },
    { page_location: `${origin}/games/snake/`, page_title: '贪吃蛇', page_referrer: `${origin}/`, send_to: measurementId },
  ]);
});
