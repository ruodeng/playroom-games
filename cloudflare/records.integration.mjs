// Run against a Wrangler --dry-run --outdir bundle with an existing Wrangler 4 /
// Miniflare 5 install: node cloudflare/records.integration.mjs [wrangler/package.json] [outdir]
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const wrangler = process.argv[2] ? path.resolve(process.argv[2]) : require.resolve('wrangler');
const { Miniflare } = createRequire(wrangler)('miniflare');
const bundleDir = path.resolve(process.argv[3] || path.join(root, '.artifacts/cloudflare-build'));
const modules = { 'worker.js': { type: 'esm', contents: await readFile(path.join(bundleDir, 'worker.js'), 'utf8') } };
for (const name of await readdir(bundleDir)) {
  if (/^[a-f0-9]+-index\.html$/.test(name)) modules[name] = { type: 'text', contents: await readFile(path.join(bundleDir, name), 'utf8') };
}
const config = JSON.parse(await readFile(path.join(root, 'wrangler.json'), 'utf8'));
const origin = 'https://games.uutom.com';
await mkdir(path.join(root, '.artifacts'), { recursive: true });
const scratchRoot = await realpath(path.join(root, '.artifacts'));
const scratch = await mkdtemp(path.join(scratchRoot, 'workerd-records-'));
// Miniflare presents its loopback listener as Host even for dispatches to a
// canonical URL. Supply the browser-facing Host through a local service binding.
const edgeFixture = `export default { fetch(request, env) {
  const headers = new Headers(request.headers);
  headers.set('Host', new URL(request.url).host);
  if (headers.has('X-Fixture-Origin')) headers.set('Origin', headers.get('X-Fixture-Origin'));
  headers.delete('X-Fixture-Origin');
  return env.APP.fetch(new Request(request, { headers }));
} };`;

function start() {
  const name = 'playroom-records-test';
  return new Miniflare({
    host: '127.0.0.1', cf: false, enableDevRegistry: false, telemetry: { enabled: false },
    resourcePersistencePath: scratch, isolatedResourcePersistencePath: scratch,
    workers: [{
      config: {
        name, compatibilityDate: config.compatibility_date, compatibilityFlags: config.compatibility_flags,
        manifest: { mainModule: 'worker.js', modulesRoot: bundleDir, modules },
        env: {
          RECORDS: { type: 'durable-object', worker: name, exportName: 'GameRecords' },
          ASSETS: { type: 'fetcher', handler: () => new Response('local-test-asset') },
        },
        exports: { GameRecords: { type: 'durable-object', storage: 'sqlite' } },
      },
      dev: { stripCfConnectingIp: false, outboundService: { type: 'fetcher', handler: () => new Response(null, { status: 502 }) } },
    }, {
      config: {
        name: 'edge-fixture', compatibilityDate: config.compatibility_date,
        manifest: { mainModule: 'edge.mjs', modules: { 'edge.mjs': { type: 'esm', contents: edgeFixture } } },
        env: { APP: { type: 'worker', worker: name } },
      },
    }],
  });
}

let runtime;
let worker;
const cookies = new Map();
const cookieHeader = () => [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
function remember(response) {
  for (const header of response.headers.getSetCookie()) {
    const [pair] = header.split(';');
    const [name, value] = pair.split('=');
    if (value) cookies.set(name, value); else cookies.delete(name);
  }
}

async function api(route, body, extraHeaders = {}) {
  const headers = { 'CF-Connecting-IP': '192.0.2.10', Cookie: cookieHeader(), ...extraHeaders };
  const options = body === undefined ? { headers } : {
    method: 'POST', body: JSON.stringify(body), headers: { 'X-Fixture-Origin': origin, 'Content-Type': 'application/json', ...headers },
  };
  const response = await worker.fetch(`${origin}/api/records/${route}`, options);
  return { response, json: await response.json(), status: response.status };
}

try {
  runtime = start();
  worker = await runtime.getWorker('edge-fixture');
  const initial = await worker.fetch(`${origin}/records/lights`);
  assert.equal(initial.status, 200, 'public board renders without a guest');
  assert.deepEqual(initial.headers.getSetCookie(), []);
  await initial.text();
  assert.equal((await worker.fetch(`${origin}/.data/records.json`)).status, 404);
  assert.equal(await (await worker.fetch(`${origin}/styles.css`)).text(), 'local-test-asset');
  assert.equal((await worker.fetch('https://alternate.invalid/api/records/boards')).status, 404);
  assert.equal((await api('register', {}, { 'X-Fixture-Origin': 'https://other.invalid' })).status, 403);
  assert.equal((await api('nickname', { nickname: 'x'.repeat(4100) })).status, 413);

  const guest = await api('session');
  assert.equal(guest.status, 200);
  remember(guest.response);
  const originalGuest = cookies.get('playroom_guest');
  assert.ok(originalGuest);
  const opened = await api('start', { game: 'lights' });
  assert.equal(opened.status, 200);
  await delay(1100);
  const result = { runId: opened.json.runId, value: 14, outcome: 'won' };
  const finishes = await Promise.all([api('finish', result), api('finish', result)]);
  assert.deepEqual(finishes.map(finish => finish.status), [200, 200]);
  assert.equal(finishes[0].json.rank, 1);
  assert.deepEqual(finishes[1].json, finishes[0].json);
  assert.equal((await api('finish', { ...result, value: 15 })).status, 409);

  const user = { username: 'local_fixture', nickname: '本地验证棋手', password: 'local-fixture-password' };
  const attempts = await Promise.all([api('register', user), api('register', user)]);
  assert.deepEqual(attempts.map(item => item.status).sort(), [200, 409], 'scrypt and unique registration');
  const registered = attempts.find(item => item.status === 200);
  const issued = registered.response.headers.getSetCookie();
  assert.equal(issued.length, 2, 'issue separate session and rotated guest cookies');
  assert.ok(issued.every(header => /; HttpOnly; SameSite=Strict;.*; Secure$/.test(header)));
  remember(registered.response);
  assert.notEqual(cookies.get('playroom_guest'), originalGuest);
  const logout = await api('logout', {});
  assert.equal(logout.status, 200);
  remember(logout.response);
  assert.ok(!cookies.has('playroom_session'));
  assert.equal((await api('login', { ...user, password: 'incorrect-local-password' })).status, 401);
  const login = await api('login', user);
  assert.equal(login.status, 200);
  remember(login.response);

  // Two registrations and two logins used four of the ten per-IP auth attempts.
  for (let i = 0; i < 6; i++) assert.equal((await api('login', {})).status, 400);
  await runtime.dispose();
  runtime = start();
  worker = await runtime.getWorker('edge-fixture');
  const restored = await api('session');
  assert.deepEqual(restored.json.user, { username: user.username, nickname: user.nickname });
  const board = await api('board?game=lights');
  assert.equal(board.status, 200);
  assert.deepEqual(board.json.myBest, { rank: 1, value: 14 });
  assert.equal(board.json.players, 1);
  const document = await worker.fetch(`${origin}/records/lights`);
  assert.equal(document.status, 200);
  assert.deepEqual(document.headers.getSetCookie(), []);
  assert.ok((await document.text()).includes(user.nickname));
  assert.equal((await api('login', {}, { 'X-Playroom-Client-IP': '192.0.2.22' })).status, 429);
  assert.equal((await api('login', {}, { 'CF-Connecting-IP': '192.0.2.22' })).status, 400);
  console.log('workerd passed: routing, public SSR, scrypt, cookies, concurrent writes, SQLite restart, per-IP rate limits');
} finally {
  try { await runtime?.dispose(); } finally {
    const target = await realpath(scratch);
    if (path.dirname(target) !== scratchRoot || !path.basename(target).startsWith('workerd-records-')) throw new Error('Unexpected test storage path');
    await rm(target, { recursive: true, force: true, maxRetries: 3 });
  }
}
