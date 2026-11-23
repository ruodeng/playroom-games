import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { mkdtemp, readFile, writeFile, rename, mkdir, rmdir, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRecordsApi } from '../scripts/records-api.mjs';
import { RECORD_BOARDS } from '../src/record-catalog.js';
import { renderRecordsView } from '../src/records-view.js';

const BOARDS = [
  { id: 'arcade-score', game: 'arcade', name: '街机', label: '最高分', direction: 'desc', unit: '分', min: 0, max: 10000, minDurationMs: 100, step: 1 },
  { id: 'puzzle-time', game: 'puzzle', name: '拼图', label: '最快通关', direction: 'asc', unit: '秒', min: 1, max: 300, minDurationMs: 100, step: 1 },
];
const PASSWORD = 'correct horse battery';
const HIGH_LIMITS = {
  auth: { limit: 1000, windowMs: 60000 },
  start: { limit: 1000, windowMs: 60000 },
  write: { limit: 1000, windowMs: 60000 },
};

async function fixture(t, options = {}) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'playroom-records-'));
  // All cleanup is restricted to the temporary directory created by this test.
  assert.equal(path.dirname(path.resolve(dataDir)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(dataDir).startsWith('playroom-records-'));
  let now = Date.UTC(2026, 0, 1);
  let server;
  let api;
  const environment = {
    dataDir,
    origin: '',
    advance(milliseconds = 200) { now += milliseconds; },
    publicBoard(boardId) { return api.publicBoard(boardId); },
    async start() {
      api = await createRecordsApi({ dataDir, boards: BOARDS, clock: () => now, rateLimits: HIGH_LIMITS, ...options });
      server = createServer(async (req, res) => {
        if (!await api(req, res)) { res.writeHead(404); res.end('outside records'); }
      });
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
      environment.origin = `http://127.0.0.1:${server.address().port}`;
    },
    async stop() {
      if (server) {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        server = undefined;
      }
      if (api) { await api.close(); api = undefined; }
    },
  };
  t.after(async () => {
    await environment.stop();
    await rm(dataDir, { recursive: true, force: true });
  });
  await environment.start();
  return environment;
}

function client(environment, initialCookies = {}) {
  const cookies = new Map(Object.entries(initialCookies));
  return {
    cookies,
    async call(route, options = {}) {
      const method = options.method || (options.body === undefined && options.raw === undefined ? 'GET' : 'POST');
      const payload = options.raw ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
      const headers = { ...(cookies.size ? { Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ') } : {}) };
      if (method === 'POST') {
        headers['Content-Type'] = 'application/json';
        if (options.origin !== null) headers.Origin = options.origin || environment.origin;
      }
      if (payload !== undefined && !options.chunked) headers['Content-Length'] = Buffer.byteLength(payload);
      Object.assign(headers, options.headers);
      return new Promise((resolve, reject) => {
        const req = request(environment.origin, { method, path: options.target || `/api/records${route}`, headers, agent: false }, res => {
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('error', reject);
          res.on('end', () => {
            for (const cookie of res.headers['set-cookie'] || []) {
              const [pair] = cookie.split(';');
              const separator = pair.indexOf('=');
              const name = pair.slice(0, separator);
              const value = pair.slice(separator + 1);
              if (value) cookies.set(name, value); else cookies.delete(name);
            }
            const text = Buffer.concat(chunks).toString('utf8');
            let json;
            try { json = JSON.parse(text); } catch { /* The outside-API sentinel is plain text. */ }
            resolve({ status: res.statusCode, json, text, headers: res.headers });
          });
        });
        req.on('error', reject);
        if (options.chunked && payload !== undefined) {
          req.write(payload.slice(0, 10));
          req.end(payload.slice(10));
        } else req.end(payload);
      });
    },
  };
}

async function start(player, board = 'arcade-score') {
  const response = await player.call('/start', { body: { game: board } });
  assert.equal(response.status, 200, response.text);
  assert.match(response.json.runId, /^[A-Za-z0-9_-]{43}$/);
  return response.json.runId;
}

async function score(environment, player, value, board = 'arcade-score', outcome = 'over') {
  const runId = await start(player, board);
  environment.advance();
  const response = await player.call('/finish', { body: { runId, value, outcome } });
  assert.equal(response.status, 200, response.text);
  return response.json;
}

async function register(player, username, nickname = '棋手') {
  return player.call('/register', { body: { username, nickname, password: PASSWORD } });
}

test('server-rendered ranks are public, escaped and read without creating or changing identities', async t => {
  const environment = await fixture(t, { boards: RECORD_BOARDS });
  const filename = path.join(environment.dataDir, 'records.json');
  assert.deepEqual(await environment.publicBoard(), { entries: [], players: 0 });
  await assert.rejects(readFile(filename), { code: 'ENOENT' });

  const player = client(environment);
  assert.equal((await register(player, 'private-user', '<svg/onload=x>')).status, 200);
  environment.advance(1000);
  const runId = await start(player, 'lights');
  environment.advance(1000);
  assert.equal((await player.call('/finish', { body: { runId, value: 7, outcome: 'won' } })).status, 200);
  const previous = await readFile(filename, 'utf8');
  const publicBoard = await environment.publicBoard('lights');
  const { entries, players } = (await player.call('/board?game=lights')).json;
  assert.deepEqual(publicBoard, { entries: entries.map(({ mine, ...entry }) => entry), players });
  assert.equal(await readFile(filename, 'utf8'), previous);

  const html = renderRecordsView(null, publicBoard);
  assert.match(html, /<main id="records-view"/);
  assert.match(html, /href="\/games\/lights"/);
  assert.match(html, /&lt;svg\/onload=x&gt;/);
  assert.doesNotMatch(html, /<svg|private-user|record-mine|这是你/);
  assert.deepEqual([...html.matchAll(/href="\/records\/([a-z\d-]+)"/g)].map(match => match[1]), RECORD_BOARDS.map(board => board.id));
});

test('session cookies, board metadata, nickname updates and public fields', async t => {
  const environment = await fixture(t);
  const player = client(environment);
  assert.equal((await player.call('', { target: '/ordinary-file' })).status, 404);
  const metadata = await player.call('/boards');
  assert.deepEqual(metadata.json, { boards: BOARDS });
  assert.equal(metadata.headers['set-cookie'], undefined);
  const session = await player.call('/session');
  assert.equal(session.status, 200);
  assert.deepEqual(session.json, { user: null, nickname: '' });
  assert.match(session.headers['set-cookie'][0], /Path=\/api\/records; HttpOnly; SameSite=Strict; Max-Age=/);
  const guestCookie = player.cookies.get('playroom_guest');
  assert.deepEqual((await player.call('/session')).json, session.json);
  assert.equal(player.cookies.get('playroom_guest'), guestCookie);
  assert.equal((await player.call('/session')).headers['set-cookie'], undefined);
  const empty = await player.call('/board?game=arcade-score');
  assert.deepEqual(empty.json, { board: BOARDS[0], entries: [], myBest: null, players: 0 });
  const finish = await score(environment, player, 10);
  assert.deepEqual(finish, { eligible: true, rank: 1, improved: true, needsName: true, boardId: 'arcade-score', value: 10 });
  assert.equal((await player.call('/board?game=arcade-score')).json.entries[0].name, '匿名玩家');
  const nickname = '棋'.repeat(15) + '🦊';
  assert.equal((await player.call('/nickname', { body: { nickname } })).status, 200);
  const board = await player.call('/board?game=arcade-score');
  assert.deepEqual(Object.keys(board.json.entries[0]).sort(), ['at', 'mine', 'name', 'rank', 'value']);
  assert.equal(board.json.entries[0].name, nickname);
  assert.equal(board.json.entries[0].mine, true);
  assert.deepEqual(board.json.myBest, { rank: 1, value: 10 });
  assert.equal(board.headers['cache-control'], 'no-store');
  assert.equal(board.headers['access-control-allow-origin'], undefined);
  assert.equal((await player.call('/nickname', { body: { nickname: `${nickname}长` } })).status, 400);
  assert.equal((await player.call('/nickname', { body: { nickname: '隐藏\u0000' } })).status, 400);
  assert.equal((await player.call('/nickname', { body: { nickname: '   ' } })).status, 400);
  assert.equal((await player.call('/board?game=absent')).status, 404);
});

test('top ten, personal bests, stable tie order and ascending victory records', async t => {
  const environment = await fixture(t);
  const players = [];
  const tickets = [];
  for (let i = 0; i < 12; i++) {
    const player = client(environment);
    await player.call('/nickname', { body: { nickname: `玩家${i + 1}` } });
    players.push(player);
    tickets.push(await start(player));
  }
  environment.advance();
  for (let i = 0; i < players.length; i++) {
    const response = await players[i].call('/finish', { body: { runId: tickets[i], value: 100, outcome: 'over' } });
    assert.equal(response.status, 200);
    assert.equal(response.json.rank, i + 1);
    assert.equal(response.json.eligible, i < 10);
  }
  const initial = (await players[11].call('/board?game=arcade-score')).json;
  assert.equal(initial.players, 12);
  assert.equal(initial.entries.length, 10);
  assert.deepEqual(initial.entries.map(entry => entry.name), players.slice(0, 10).map((_, i) => `玩家${i + 1}`));
  assert.deepEqual(initial.myBest, { rank: 12, value: 100 });
  assert.ok(initial.entries.every(entry => !entry.mine));
  assert.equal(new Set(initial.entries.map(entry => entry.at)).size, 1);
  assert.equal((await score(environment, players[11], 99)).improved, false);
  assert.equal((await score(environment, players[0], 100)).improved, false);
  const tied = (await players[0].call('/board?game=arcade-score')).json;
  assert.equal(tied.entries[0].at, initial.entries[0].at);
  const improved = await score(environment, players[11], 101);
  assert.equal(improved.rank, 1);
  assert.equal(improved.improved, true);
  assert.equal(improved.needsName, false);
  assert.equal((await players[11].call('/board?game=arcade-score')).json.players, 12);
  assert.equal((await score(environment, players[0], 30, 'puzzle-time', 'won')).improved, true);
  assert.equal((await score(environment, players[0], 40, 'puzzle-time', 'won')).improved, false);
  assert.equal((await score(environment, players[0], 20, 'puzzle-time', 'won')).improved, true);
  assert.equal((await score(environment, players[1], 0, 'puzzle-time', 'lost')).rank, null);
  assert.deepEqual((await players[0].call('/board?game=puzzle-time')).json.myBest, { rank: 1, value: 20 });
  assert.equal((await players[1].call('/board?game=puzzle-time')).json.players, 1);
});

test('tickets enforce ownership, duration, bounds, expiration and idempotent retry', async t => {
  const environment = await fixture(t, { runTtlMs: 2000 });
  const player = client(environment);
  const other = client(environment);
  const runId = await start(player);
  assert.equal((await other.call('/finish', { body: { runId, value: 20, outcome: 'over' } })).status, 403);
  assert.equal((await player.call('/finish', { body: { runId, value: 20, outcome: 'over' } })).status, 422);
  environment.advance();
  for (const value of [-1, 10001, 1.5]) assert.equal((await player.call('/finish', { body: { runId, value, outcome: 'over' } })).status, 422);
  assert.equal((await player.call('/finish', { body: { runId, value: 20, outcome: 'invalid' } })).status, 400);
  assert.equal((await player.call('/finish', { body: { runId: {}, value: 20, outcome: 'over' } })).status, 400);
  const first = await player.call('/finish', { body: { runId, value: 20, outcome: 'over' } });
  assert.equal(first.status, 200);
  assert.deepEqual((await player.call('/finish', { body: { runId, value: 20, outcome: 'over' } })).json, first.json);
  assert.equal((await player.call('/finish', { body: { runId, value: 21, outcome: 'over' } })).status, 409);
  assert.equal((await player.call('/finish', { body: { runId, value: 20, outcome: 'won' } })).status, 409);
  assert.equal((await player.call('/finish', { body: { runId: 'A'.repeat(43), value: 20, outcome: 'over' } })).status, 410);
  const expired = await start(player);
  environment.advance(2001);
  assert.equal((await player.call('/finish', { body: { runId: expired, value: 50, outcome: 'over' } })).status, 410);
  const lostRun = await start(player, 'puzzle-time');
  const lost = await player.call('/finish', { body: { runId: lostRun, value: 0, outcome: 'lost' } });
  assert.deepEqual(lost.json, { eligible: false, rank: null, improved: false, needsName: false, boardId: 'puzzle-time', value: 0 });
  assert.equal((await player.call('/finish', { body: { runId: lostRun, value: 10, outcome: 'won' } })).status, 409);
});

test('registration and login migrate guests, rotate credentials, persist and expire sessions', async t => {
  const environment = await fixture(t, { sessionTtlMs: 10000 });
  const player = client(environment);
  await score(environment, player, 100);
  await score(environment, player, 20, 'puzzle-time', 'won');
  const guestRun = await start(player);
  const oldGuest = client(environment, Object.fromEntries(player.cookies));
  const beforeRegistration = player.cookies.get('playroom_guest');
  const registration = await register(player, '  ALICE-01  ', '阿狸');
  assert.equal(registration.status, 200, registration.text);
  assert.deepEqual(registration.json, { user: { username: 'alice-01', nickname: '阿狸' }, nickname: '阿狸' });
  assert.notEqual(player.cookies.get('playroom_guest'), beforeRegistration);
  const firstSession = player.cookies.get('playroom_session');
  assert.ok(firstSession);
  assert.equal((await player.call('/board?game=arcade-score')).json.players, 1);
  assert.deepEqual((await player.call('/board?game=arcade-score')).json.myBest, { rank: 1, value: 100 });
  assert.equal((await oldGuest.call('/session')).json.user, null);
  assert.equal((await oldGuest.call('/board?game=arcade-score')).json.myBest, null);
  environment.advance();
  assert.equal((await oldGuest.call('/finish', { body: { runId: guestRun, value: 80, outcome: 'over' } })).status, 403);
  assert.equal((await player.call('/finish', { body: { runId: guestRun, value: 80, outcome: 'over' } })).status, 200);
  const oldSession = client(environment, Object.fromEntries(player.cookies));
  const logout = await player.call('/logout', { body: {} });
  assert.deepEqual(logout.json, { user: null, nickname: '' });
  assert.equal(player.cookies.has('playroom_session'), false);
  assert.equal((await oldSession.call('/session')).json.user, null);
  assert.equal((await player.call('/board?game=arcade-score')).json.myBest, null);
  await score(environment, player, 150);
  await score(environment, player, 30, 'puzzle-time', 'won');
  const secondGuestRun = await start(player);
  const secondGuestToken = player.cookies.get('playroom_guest');
  const secondOldGuest = client(environment, Object.fromEntries(player.cookies));
  const login = await player.call('/login', { body: { username: 'ALICE-01', password: PASSWORD } });
  assert.equal(login.status, 200);
  assert.notEqual(player.cookies.get('playroom_session'), firstSession);
  assert.notEqual(player.cookies.get('playroom_guest'), secondGuestToken);
  assert.deepEqual((await player.call('/board?game=arcade-score')).json.myBest, { rank: 1, value: 150 });
  assert.equal((await player.call('/board?game=arcade-score')).json.players, 1);
  assert.deepEqual((await player.call('/board?game=puzzle-time')).json.myBest, { rank: 1, value: 20 });
  environment.advance();
  assert.equal((await secondOldGuest.call('/finish', { body: { runId: secondGuestRun, value: 140, outcome: 'over' } })).status, 403);
  assert.equal((await player.call('/finish', { body: { runId: secondGuestRun, value: 140, outcome: 'over' } })).status, 200);
  const accountRun = await start(player);
  environment.advance();
  const accountFinish = await player.call('/finish', { body: { runId: accountRun, value: 200, outcome: 'won' } });
  const storedText = await readFile(path.join(environment.dataDir, 'records.json'), 'utf8');
  const stored = JSON.parse(storedText);
  assert.equal(stored.users['alice-01'].password.salt.length, 22);
  assert.equal(stored.users['alice-01'].password.hash.length, 86);
  for (const secret of [PASSWORD, firstSession, beforeRegistration, player.cookies.get('playroom_session'), accountRun]) assert.equal(storedText.includes(secret), false);
  assert.deepEqual(Object.keys(stored.sessions).map(key => key.length), [64]);
  assert.equal(registration.text.includes('password'), false);
  await environment.stop();
  await environment.start();
  assert.equal((await player.call('/session')).json.user.username, 'alice-01');
  assert.deepEqual((await player.call('/finish', { body: { runId: accountRun, value: 200, outcome: 'won' } })).json, accountFinish.json);
  assert.deepEqual((await player.call('/board?game=arcade-score')).json.myBest, { rank: 1, value: 200 });
  const wrongPassword = await player.call('/login', { body: { username: 'alice-01', password: 'incorrect password' } });
  const absentUser = await player.call('/login', { body: { username: 'absent-user', password: PASSWORD } });
  assert.equal(wrongPassword.status, 401);
  assert.equal(absentUser.status, 401);
  assert.deepEqual(wrongPassword.json, absentUser.json);
  environment.advance(10001);
  assert.equal((await player.call('/session')).json.user, null);
  assert.equal((await player.call('/board?game=arcade-score')).json.myBest, null);
  assert.equal((await player.call('/board?game=arcade-score')).json.entries[0].value, 200);
});

test('switching accounts does not migrate account records or authorize another account ticket', async t => {
  const environment = await fixture(t);
  const alice = client(environment);
  const bob = client(environment);
  assert.equal((await register(alice, 'alice')).status, 200);
  assert.equal((await register(bob, 'bob')).status, 200);
  await score(environment, alice, 80);
  const runId = await start(alice);
  environment.advance();
  const priorSession = client(environment, Object.fromEntries(alice.cookies));
  assert.equal((await alice.call('/login', { body: { username: 'bob', password: PASSWORD } })).status, 200);
  assert.equal((await alice.call('/finish', { body: { runId, value: 90, outcome: 'over' } })).status, 403);
  assert.equal((await alice.call('/board?game=arcade-score')).json.myBest, null);
  assert.equal((await alice.call('/board?game=arcade-score')).json.players, 1);
  assert.equal((await priorSession.call('/session')).json.user, null);
  assert.equal((await register(alice, 'third')).status, 409);
});

test('concurrent registration and submission remain consistent', async t => {
  const environment = await fixture(t);
  const left = client(environment);
  const right = client(environment);
  await left.call('/session');
  await right.call('/session');
  const results = await Promise.all([register(left, 'Concurrent'), register(right, ' concurrent ')]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  assert.equal(Object.keys(JSON.parse(await readFile(path.join(environment.dataDir, 'records.json'), 'utf8')).users).length, 1);
  const player = results[0].status === 200 ? left : right;
  const tickets = await Promise.all(Array.from({ length: 5 }, () => start(player)));
  environment.advance();
  const finishes = await Promise.all(tickets.map((runId, i) => player.call('/finish', { body: { runId, value: i + 1, outcome: 'over' } })));
  assert.ok(finishes.every(result => result.status === 200));
  assert.deepEqual((await player.call('/board?game=arcade-score')).json.myBest, { rank: 1, value: 5 });
  assert.equal((await player.call('/board?game=arcade-score')).json.players, 1);
  const sameRun = await start(player);
  environment.advance();
  const identical = await Promise.all([1, 2].map(() => player.call('/finish', { body: { runId: sameRun, value: 10, outcome: 'over' } })));
  assert.ok(identical.every(result => result.status === 200));
  assert.deepEqual(identical[0].json, identical[1].json);
  const contested = await start(player);
  environment.advance();
  const competing = await Promise.all([20, 30].map(value => player.call('/finish', { body: { runId: contested, value, outcome: 'over' } })));
  assert.deepEqual(competing.map(result => result.status).sort(), [200, 409]);
  assert.equal((await player.call('/board?game=arcade-score')).json.myBest.value, competing.find(result => result.status === 200).json.value);
});

test('origin, Host, malformed targets, JSON bounds and credentials fail safely', async t => {
  const environment = await fixture(t);
  const player = client(environment);
  assert.equal((await player.call('/session', { headers: { Host: 'untrusted.test' } })).status, 403);
  assert.equal((await player.call('/nickname', { body: { nickname: '玩家' }, origin: 'https://attacker.test' })).status, 403);
  assert.equal((await player.call('/nickname', { body: { nickname: '玩家' }, origin: null })).status, 403);
  assert.equal((await player.call('/nickname', { body: { nickname: '玩家' }, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await player.call('/nickname', { body: { nickname: '玩家' }, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await player.call('/nickname', { raw: '{' })).status, 400);
  assert.equal((await player.call('/nickname', { raw: '[]' })).status, 400);
  assert.equal((await player.call('/nickname', { raw: ' '.repeat(4097) })).status, 413);
  assert.equal((await player.call('/nickname', { raw: ' '.repeat(4097), chunked: true })).status, 413);
  assert.equal((await player.call('/nickname', { method: 'GET' })).status, 405);
  assert.equal((await player.call('/absent')).status, 404);
  for (const target of ['//[', '//[/']) {
    const malformed = await player.call('', { target });
    assert.equal(malformed.status, 400);
    assert.deepEqual(malformed.json, { error: '请求地址格式不正确' });
    assert.equal((await player.call('/session')).status, 200);
  }
  for (const password of ['123456789', 'x'.repeat(129)]) {
    const invalid = await player.call('/register', { body: { username: 'valid-user', nickname: '玩家', password } });
    assert.equal(invalid.status, 400);
    assert.deepEqual(invalid.json, { error: '密码须为 10–128 个字符' });
  }
  for (const username of ['ab', '中文名字', '-badname', 'a'.repeat(25)]) assert.equal((await register(player, username)).status, 400);
  assert.equal((await player.call('/register', { body: { username: 'valid-user', password: PASSWORD } })).status, 400);
  const port = new URL(environment.origin).port;
  const localhost = await player.call('/nickname', { body: { nickname: '同源' }, headers: { Host: `localhost:${port}` }, origin: `http://localhost:${port}` });
  assert.equal(localhost.status, 200);
  assert.equal((await player.call('/nickname', { body: { nickname: '跨源' }, headers: { Host: `localhost:${port}` } })).status, 403);
});

test('explicit production origin uses Secure cookies and rejects all other Hosts', async t => {
  const environment = await fixture(t, { allowedOrigins: ['https://playroom.test'] });
  const player = client(environment);
  assert.equal((await player.call('/session')).status, 403);
  const session = await player.call('/session', { headers: { Host: 'playroom.test' } });
  assert.equal(session.status, 200);
  assert.match(session.headers['set-cookie'][0], /; Secure$/);
  const nickname = await player.call('/nickname', { body: { nickname: '安全来源' }, headers: { Host: 'playroom.test' }, origin: 'https://playroom.test' });
  assert.equal(nickname.status, 200);
  assert.equal((await player.call('/nickname', { body: { nickname: '错误协议' }, headers: { Host: 'playroom.test' }, origin: 'http://playroom.test' })).status, 403);
});

test('auth, start, guest creation and write rates are bounded and recover after their window', async t => {
  const limits = Object.fromEntries(['auth', 'start', 'write'].map(kind => [kind, { limit: 2, windowMs: 1000 }]));
  const environment = await fixture(t, { rateLimits: limits });
  const player = client(environment);
  assert.equal((await player.call('/session')).status, 200);
  await start(player);
  await start(player);
  assert.equal((await player.call('/start', { body: { game: 'arcade-score' } })).status, 429);
  assert.equal((await player.call('/nickname', { body: { nickname: '一次' } })).status, 200);
  assert.equal((await player.call('/nickname', { body: { nickname: '二次' } })).status, 429);
  for (let i = 0; i < 2; i++) assert.equal((await player.call('/login', { body: { username: 'nobody', password: 'short' } })).status, 400);
  assert.equal((await player.call('/login', { body: { username: 'nobody', password: 'short' } })).status, 429);
  assert.equal((await client(environment).call('/session')).status, 429);
  environment.advance(1001);
  assert.equal((await player.call('/start', { body: { game: 'arcade-score' } })).status, 200);
  assert.equal((await player.call('/nickname', { body: { nickname: '恢复' } })).status, 200);
  assert.equal((await player.call('/login', { body: { username: 'nobody', password: 'short' } })).status, 400);
});

test('exclusive storage, failed writes and corrupt data never report false success', async t => {
  const environment = await fixture(t);
  await assert.rejects(createRecordsApi({ dataDir: environment.dataDir, boards: BOARDS }), /storage is locked/);
  const player = client(environment);
  const runId = await start(player);
  environment.advance();
  const filename = path.join(environment.dataDir, 'records.json');
  const backup = path.join(environment.dataDir, 'records.test-backup');
  await rename(filename, backup);
  await mkdir(filename);
  const failure = await player.call('/finish', { body: { runId, value: 42, outcome: 'over' } });
  assert.equal(failure.status, 500);
  assert.deepEqual(failure.json, { error: '记录服务暂时不可用，请稍后重试' });
  assert.equal(failure.headers['set-cookie'], undefined);
  const unchanged = JSON.parse(await readFile(backup, 'utf8'));
  assert.equal(unchanged.sequence, 0);
  assert.equal(Object.values(unchanged.runs)[0].finished, null);
  assert.equal((await readdir(environment.dataDir)).filter(name => name.endsWith('.tmp')).length, 0);
  await rmdir(filename);
  await rename(backup, filename);
  const recovered = await player.call('/finish', { body: { runId, value: 44, outcome: 'over' } });
  assert.equal(recovered.status, 200);
  assert.deepEqual((await player.call('/board?game=arcade-score')).json.myBest, { rank: 1, value: 44 });
  await environment.stop();
  const valid = await readFile(filename, 'utf8');
  await writeFile(filename, '{invalid json', 'utf8');
  await assert.rejects(createRecordsApi({ dataDir: environment.dataDir, boards: BOARDS }));
  assert.equal(await readFile(filename, 'utf8'), '{invalid json');
  await writeFile(filename, '{"version":1}', 'utf8');
  await assert.rejects(createRecordsApi({ dataDir: environment.dataDir, boards: BOARDS }), /storage is invalid/);
  assert.equal(await readFile(filename, 'utf8'), '{"version":1}');
  await writeFile(filename, valid, 'utf8');
  await environment.start();
  assert.deepEqual((await player.call('/board?game=arcade-score')).json.myBest, { rank: 1, value: 44 });
});
