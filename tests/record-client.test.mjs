import test from 'node:test';
import assert from 'node:assert/strict';

function page() {
  class Element {
    constructor(text = '') { this.textContent = text; this.children = []; }
    setAttribute() {}
    append(child) { this.children.push(child); }
    replaceChildren(...children) { this.children = children; }
    remove() {}
    addEventListener() {}
    get text() { return this.textContent + this.children.map(child => child.text || child.textContent || '').join(''); }
  }
  const document = Object.assign(new EventTarget(), { createElement: () => new Element(), createTextNode: text => new Element(text) });
  const root = { feedback: null, querySelector(selector) {
    if (selector === '.record-feedback') return this.feedback;
    return { append: box => { this.feedback = box; } };
  } };
  return { document, root };
}
const response = data => new Response(JSON.stringify(data), { status: 200 });

test('late completion is persisted without replacing the next game feedback or qualifying as its prompt', async () => {
  const original = { fetch: globalThis.fetch, document: globalThis.document };
  const { document, root } = page(); globalThis.document = document;
  let release; const pending = new Promise(resolve => { release = resolve; });
  let tickets = 0, sessions = 0; const events = [];
  document.addEventListener('playroom:record-result', event => events.push(event.detail));
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/session')) { sessions++; return response({ user: null, nickname: '' }); }
    if (url.endsWith('/start')) return response({ runId: String(++tickets) });
    const payload = JSON.parse(options.body);
    if (payload.runId === '1') await pending;
    return response({ rank: Number(payload.runId), value: payload.value, improved: true });
  };
  try {
    const { startRecordAttempt } = await import('../src/record-client.js?late-run');
    const first = startRecordAttempt('lights', root); const firstFinish = first.finish(9, 'won');
    await new Promise(resolve => setImmediate(resolve));
    const second = startRecordAttempt('lights', root); await second.finish(10, 'won');
    const currentFeedback = root.feedback.text;
    release(); await firstFinish;
    assert.match(currentFeedback, /第 2 名/); assert.equal(root.feedback.text, currentFeedback);
    assert.equal(events.length, 2); assert.equal(events[0].isCurrent(), true); assert.equal(events[1].isCurrent(), false);
    assert.equal(sessions, 1, 'concurrent starts share one guest session bootstrap');
  } finally { release(); globalThis.fetch = original.fetch; globalThis.document = original.document; }
});

test('simultaneous and repeated finish calls submit only one terminal result', async () => {
  const original = { fetch: globalThis.fetch, document: globalThis.document };
  const { document, root } = page(); globalThis.document = document;
  let finishes = 0;
  globalThis.fetch = async url => {
    if (url.endsWith('/session')) return response({ user: null, nickname: '' });
    if (url.endsWith('/start')) return response({ runId: 'unique' });
    finishes++; return response({ rank: 1, improved: true });
  };
  try {
    const { startRecordAttempt } = await import('../src/record-client.js?single-finish');
    const attempt = startRecordAttempt('lights', root);
    await Promise.all([attempt.finish(9, 'won'), attempt.finish(9, 'won')]); await attempt.finish(9, 'won');
    assert.equal(finishes, 1);
  } finally { globalThis.fetch = original.fetch; globalThis.document = original.document; }
});
