import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { DEFAULT_RECORD_BOARD_ID, RECORD_BOARDS } from '../src/record-catalog.js';
import { createRecordsStore } from './records-store.mjs';

const deriveKey = promisify(scrypt);
const SCRYPT = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const PREFIX = '/api/records';
const GUEST_COOKIE = 'playroom_guest';
const SESSION_COOKIE = 'playroom_session';
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const USERNAME = /^[a-z0-9][a-z0-9_-]{2,23}$/;
const BOARD_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const DAY = 24 * 60 * 60 * 1000;
const own = (object, key) => Object.hasOwn(object, key) ? object[key] : undefined;
const digest = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function normalizeUsername(value) {
  if (typeof value !== 'string') throw new ApiError(400, '用户名须为 3–24 位字母、数字、下划线或短横线，并以字母或数字开头');
  const result = value.trim().toLowerCase();
  if (!USERNAME.test(result)) throw new ApiError(400, '用户名须为 3–24 位字母、数字、下划线或短横线，并以字母或数字开头');
  return result;
}

function normalizeNickname(value) {
  if (typeof value !== 'string' || /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u.test(value)) throw new ApiError(400, '昵称须为 1–16 个字符，且不能含控制字符');
  const result = value.normalize('NFC').trim();
  if (Array.from(result).length < 1 || Array.from(result).length > 16) throw new ApiError(400, '昵称须为 1–16 个字符，且不能含控制字符');
  return result;
}

function validatePassword(value) {
  if (typeof value !== 'string' || !value.isWellFormed() || Array.from(value).length < 10 || Array.from(value).length > 128) throw new ApiError(400, '密码须为 10–128 个字符');
  return value;
}

function validateBoards(boards) {
  if (!Array.isArray(boards) || !boards.length) throw new Error('Records boards must be a nonempty array');
  const ids = new Set();
  for (const board of boards) {
    if (!object(board) || !BOARD_ID.test(board.id) || ids.has(board.id)
      || !['asc', 'desc'].includes(board.direction) || !['game', 'name', 'label', 'unit'].every(key => typeof board[key] === 'string')
      || !Number.isFinite(board.min) || !Number.isFinite(board.max) || board.min > board.max
      || !Number.isFinite(board.minDurationMs) || board.minDurationMs < 0
      || (board.step !== undefined && (!Number.isFinite(board.step) || board.step <= 0))) throw new Error('Invalid records board configuration');
    ids.add(board.id);
  }
}

function validateState(state) {
  const invalid = () => { throw new Error('Records storage is invalid; restore a valid backup before starting'); };
  if (!object(state) || state.version !== 1 || !Number.isSafeInteger(state.sequence) || state.sequence < 0
    || !['users', 'guests', 'sessions', 'runs', 'records'].every(key => object(state[key]))) invalid();
  const identities = new Set();
  const addIdentity = identity => { if (identities.has(identity)) invalid(); identities.add(identity); };
  const time = value => Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000;
  const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  const nickname = value => {
    try { return normalizeNickname(value) === value; } catch { return false; }
  };
  for (const [username, user] of Object.entries(state.users)) {
    if (!USERNAME.test(username) || !object(user) || user.username !== username || !TOKEN.test(user.id) || !nickname(user.nickname)
      || !time(user.createdAt) || !object(user.password) || !/^[A-Za-z0-9_-]{22}$/.test(user.password.salt)
      || !/^[A-Za-z0-9_-]{86}$/.test(user.password.hash)) invalid();
    addIdentity(`u:${user.id}`);
  }
  for (const [key, guest] of Object.entries(state.guests)) {
    if (!hash(key) || !object(guest) || !TOKEN.test(guest.id) || !time(guest.createdAt) || (guest.nickname !== '' && !nickname(guest.nickname))) invalid();
    addIdentity(`g:${guest.id}`);
  }
  for (const [key, session] of Object.entries(state.sessions)) {
    const user = object(session) && own(state.users, session.username);
    if (!hash(key) || !user || session.userId !== user.id || !time(session.expiresAt)) invalid();
  }
  for (const [boardId, recordBoard] of Object.entries(state.records)) {
    if (!BOARD_ID.test(boardId) || !object(recordBoard) || !['asc', 'desc'].includes(recordBoard.direction) || !object(recordBoard.entries)) invalid();
    for (const [identity, record] of Object.entries(recordBoard.entries)) {
      if (!identities.has(identity) || !object(record) || !Number.isFinite(record.value) || !time(record.at)
        || !Number.isSafeInteger(record.order) || record.order < 1 || record.order > state.sequence) invalid();
    }
  }
  for (const [key, run] of Object.entries(state.runs)) {
    if (!hash(key) || !object(run) || !identities.has(run.identity) || !BOARD_ID.test(run.boardId)
      || !time(run.startedAt) || !time(run.expiresAt) || run.expiresAt <= run.startedAt) invalid();
    if (run.finished !== null) {
      const finished = run.finished;
      const result = object(finished) && finished.result;
      if (!object(finished) || !Number.isFinite(finished.value) || !['won', 'lost', 'over'].includes(finished.outcome)
        || !object(result) || result.boardId !== run.boardId || result.value !== finished.value
        || !['eligible', 'improved', 'needsName'].every(key => typeof result[key] === 'boolean')
        || (result.rank !== null && (!Number.isSafeInteger(result.rank) || result.rank < 1))) invalid();
    }
  }
}

function readCookies(request) {
  const found = new Map();
  for (const part of (request.headers.cookie || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (![GUEST_COOKIE, SESSION_COOKIE].includes(name)) continue;
    const value = part.slice(separator + 1).trim();
    found.set(name, found.has(name) || !TOKEN.test(value) ? null : value);
  }
  return found;
}

function readJson(request, maxBytes, timeoutMs) {
  const contentType = request.headers['content-type'];
  if (typeof contentType !== 'string' || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)
    || (request.headers['content-encoding'] && request.headers['content-encoding'] !== 'identity')) {
    request.resume();
    throw new ApiError(415, '请使用 JSON 请求');
  }
  const length = request.headers['content-length'];
  if (length && Number(length) > maxBytes) { request.resume(); throw new ApiError(413, '请求内容过大'); }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const timer = setTimeout(() => fail(new ApiError(408, '请求超时，请重试')), timeoutMs);
    timer.unref?.();
    const clean = () => {
      clearTimeout(timer);
      request.off('data', data);
      request.off('end', end);
      request.off('aborted', aborted);
      request.off('error', aborted);
    };
    const fail = error => { clean(); request.resume(); reject(error); };
    const aborted = () => fail(new ApiError(400, '请求未完整接收'));
    const data = chunk => {
      size += chunk.length;
      if (size > maxBytes) { fail(new ApiError(413, '请求内容过大')); return; }
      chunks.push(chunk);
    };
    const end = () => {
      clean();
      try {
        const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
        if (!object(parsed)) throw new Error('Expected object');
        resolve(parsed);
      } catch { reject(new ApiError(400, 'JSON 请求格式不正确')); }
    };
    request.on('data', data);
    request.once('end', end);
    request.once('aborted', aborted);
    request.once('error', aborted);
  });
}

function createLimiter(options, consumeLimit) {
  const definitions = {
    auth: { limit: 10, windowMs: 10 * 60 * 1000 },
    start: { limit: 90, windowMs: 60 * 1000 },
    write: { limit: 120, windowMs: 60 * 1000 },
    ...options,
  };
  const buckets = new Map();
  const maxKeys = 4096;
  for (const definition of Object.values(definitions)) {
    if (!object(definition) || !Number.isSafeInteger(definition.limit) || definition.limit < 1
      || !Number.isSafeInteger(definition.windowMs) || definition.windowMs < 1) throw new Error('Invalid records rate limit');
  }
  if (consumeLimit) return (kind, key, now) => {
    if (!consumeLimit(digest(`${kind}:${key}`), now, definitions[kind], maxKeys)) throw new ApiError(429, '操作过于频繁，请稍后再试');
  };
  return (kind, key, now) => {
    const definition = definitions[kind];
    const id = `${kind}:${key}`;
    let bucket = buckets.get(id);
    if (!bucket || now >= bucket.expiresAt) {
      if (buckets.size >= maxKeys) {
        for (const [candidate, value] of buckets) if (now >= value.expiresAt) buckets.delete(candidate);
        if (!buckets.has(id) && buckets.size >= maxKeys) throw new ApiError(429, '操作过于频繁，请稍后再试');
      }
      bucket = { count: 0, expiresAt: now + definition.windowMs };
      buckets.set(id, bucket);
    }
    if (bucket.count >= definition.limit) throw new ApiError(429, '操作过于频繁，请稍后再试');
    bucket.count++;
  };
}

function validateOrigins(origins) {
  if (origins === undefined) return null;
  if (!Array.isArray(origins) || origins.length === 0) throw new Error('allowedOrigins must contain an explicit origin');
  return origins.map(origin => {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin || url.username || url.password) throw new Error('Invalid allowed records origin');
    return url;
  });
}

function checkOrigin(request, configured) {
  const host = request.headers.host;
  if (typeof host !== 'string') throw new ApiError(403, '请求来源不受信任');
  const allowed = configured || [new URL(`http://localhost:${request.socket.localPort}`), new URL(`http://127.0.0.1:${request.socket.localPort}`)];
  const matches = allowed.filter(url => url.host === host.toLowerCase());
  if (matches.length === 0) throw new ApiError(403, '请求来源不受信任');
  if (request.method === 'POST') {
    const origin = request.headers.origin;
    if (typeof origin !== 'string' || !matches.some(url => url.origin === origin)
      || request.headers['sec-fetch-site'] === 'cross-site') throw new ApiError(403, '请从本站页面提交请求');
    return origin.startsWith('https:');
  }
  return Boolean(request.socket.encrypted) || matches.every(url => url.protocol === 'https:');
}

function compareRecords(direction, a, b) {
  return (direction === 'asc' ? a.value - b.value : b.value - a.value) || a.at - b.at || a.order - b.order;
}

function ranking(state, boardId) {
  const board = own(state.records, boardId);
  return board ? Object.entries(board.entries).sort(([, a], [, b]) => compareRecords(board.direction, a, b)) : [];
}

function readBoardRanking(state, boardId) {
  const ordered = ranking(state, boardId);
  const names = new Map();
  for (const user of Object.values(state.users)) names.set(`u:${user.id}`, user.nickname);
  for (const guest of Object.values(state.guests)) names.set(`g:${guest.id}`, guest.nickname || '匿名玩家');
  const entries = ordered.slice(0, 10).map(([identity, record], index) => ({
    rank: index + 1, name: names.get(identity), value: record.value, at: new Date(record.at).toISOString(),
  }));
  return { ordered, entries, players: ordered.length };
}

function mergeGuest(state, guest, user, now) {
  const from = `g:${guest.id}`;
  const to = `u:${user.id}`;
  for (const board of Object.values(state.records)) {
    const source = own(board.entries, from);
    const target = own(board.entries, to);
    if (source && (!target || compareRecords(board.direction, source, target) < 0)) board.entries[to] = source;
    delete board.entries[from];
  }
  for (const [key, run] of Object.entries(state.runs)) {
    if (run.identity !== from) continue;
    if (!run.finished && run.expiresAt > now) run.identity = to;
    else delete state.runs[key];
  }
}

export async function createRecordsApi({
  dataDir,
  createStore = createRecordsStore,
  consumeLimit,
  boards,
  clock = Date.now,
  allowedOrigins,
  runTtlMs = 6 * 60 * 60 * 1000,
  sessionTtlMs = 30 * DAY,
  maxBodyBytes = 4096,
  bodyTimeoutMs = 5000,
  maxRuns = 20000,
  maxAuthConcurrency = 2,
  rateLimits,
} = {}) {
  boards ??= RECORD_BOARDS;
  validateBoards(boards);
  const catalog = structuredClone(boards);
  const boardMap = new Map(catalog.map(board => [board.id, board]));
  const configuredOrigins = validateOrigins(allowedOrigins);
  const limit = createLimiter(rateLimits, consumeLimit);
  for (const value of [runTtlMs, sessionTtlMs, maxBodyBytes, bodyTimeoutMs, maxRuns, maxAuthConcurrency]) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid records API limit');
  }
  const store = await createStore({
    dataDir,
    initialState: { version: 1, sequence: 0, users: {}, guests: {}, sessions: {}, runs: {}, records: {} },
    validateState,
  });
  try {
    await store.read(state => {
      for (const [id, stored] of Object.entries(state.records)) {
        if (boardMap.has(id) && boardMap.get(id).direction !== stored.direction) throw new Error(`Stored records direction differs for ${id}`);
      }
    });
  } catch (error) { await store.close(); throw error; }
  const dummySalt = randomBytes(16);
  const dummyHash = randomBytes(64);
  let authInProgress = 0;

  function currentTime() {
    const now = clock();
    if (!Number.isSafeInteger(now) || now < 0 || now + Math.max(runTtlMs, sessionTtlMs) > 8640000000000000) throw new Error('Invalid records clock');
    return now;
  }

  function setCookie(cookies, name, value, maxAge) { cookies.set(name, { value, maxAge }); }

  function newGuest(state, now, cookies) {
    const credential = token();
    const guest = { id: token(), nickname: '', createdAt: now };
    state.guests[digest(credential)] = guest;
    setCookie(cookies, GUEST_COOKIE, credential, 365 * DAY);
    return guest;
  }

  function identify(state, credentials, now, cookies, ip) {
    const sessionToken = credentials.get(SESSION_COOKIE);
    const sessionKey = sessionToken && digest(sessionToken);
    const session = sessionKey && own(state.sessions, sessionKey);
    if (session && session.expiresAt > now) {
      const user = own(state.users, session.username);
      if (user && user.id === session.userId) return { identity: `u:${user.id}`, person: user, user };
    }
    if (sessionToken) {
      if (session) delete state.sessions[sessionKey];
      setCookie(cookies, SESSION_COOKIE, '', 0);
    }
    const guestToken = credentials.get(GUEST_COOKIE);
    let guest = guestToken && own(state.guests, digest(guestToken));
    if (!guest) {
      limit('write', `ip:${ip}`, now);
      guest = newGuest(state, now, cookies);
    }
    return { identity: `g:${guest.id}`, person: guest, user: null };
  }

  function sessionResult(context) {
    return { user: context.user ? { username: context.user.username, nickname: context.user.nickname } : null, nickname: context.person.nickname };
  }

  function sweep(state, now) {
    for (const [key, session] of Object.entries(state.sessions)) if (session.expiresAt <= now) delete state.sessions[key];
    for (const [key, run] of Object.entries(state.runs)) if (run.expiresAt <= now) delete state.runs[key];
  }

  function signIn(state, credentials, context, user, now, cookies) {
    if (!context.user) {
      mergeGuest(state, context.person, user, now);
      for (const [key, guest] of Object.entries(state.guests)) if (guest.id === context.person.id) delete state.guests[key];
    }
    const previous = credentials.get(SESSION_COOKIE);
    if (previous) delete state.sessions[digest(previous)];
    sweep(state, now);
    // Never let a former guest credential resolve to an authenticated identity.
    newGuest(state, now, cookies);
    const credential = token();
    state.sessions[digest(credential)] = { username: user.username, userId: user.id, expiresAt: now + sessionTtlMs };
    setCookie(cookies, SESSION_COOKIE, credential, sessionTtlMs);
    return sessionResult({ user, person: user });
  }

  async function passwordWork(work) {
    if (authInProgress >= maxAuthConcurrency) throw new ApiError(429, '登录请求较多，请稍后再试');
    authInProgress++;
    try { return await work(); } finally { authInProgress--; }
  }

  function findBoard(id) {
    const board = boardMap.get(id);
    if (!board) throw new ApiError(404, '未找到该榜单');
    return board;
  }

  const handler = async (request, response) => {
    const cookies = new Map();
    let secure = false;
    try {
      let url;
      try { url = new URL(request.url, 'http://records.invalid'); } catch { throw new ApiError(400, '请求地址格式不正确'); }
      if (url.pathname !== PREFIX && !url.pathname.startsWith(`${PREFIX}/`)) return false;
      secure = checkOrigin(request, configuredOrigins);
      const route = url.pathname.slice(PREFIX.length);
      const getRoutes = ['/session', '/boards', '/board'];
      const postRoutes = ['/start', '/finish', '/nickname', '/register', '/login', '/logout'];
      if (!getRoutes.includes(route) && !postRoutes.includes(route)) throw new ApiError(404, '未找到该接口');
      if ((getRoutes.includes(route) && request.method !== 'GET') || (postRoutes.includes(route) && request.method !== 'POST')) throw new ApiError(405, '不支持该请求方法');
      const now = currentTime();
      const credentials = readCookies(request);
      const ip = request.socket.remoteAddress || 'unknown';
      let body;
      if (request.method === 'POST') {
        limit(route === '/register' || route === '/login' ? 'auth' : route === '/start' ? 'start' : 'write', `ip:${ip}`, now);
        body = await readJson(request, maxBodyBytes, bodyTimeoutMs);
      }
      let result;
      if (route === '/boards') {
        result = { boards: catalog };
      } else if (route === '/register') {
        const username = normalizeUsername(body.username);
        const nickname = normalizeNickname(body.nickname);
        const password = validatePassword(body.password);
        limit('auth', `user:${username}`, now);
        const salt = randomBytes(16);
        const key = await passwordWork(() => deriveKey(password, salt, 64, SCRYPT));
        result = await store.transaction(state => {
          const context = identify(state, credentials, currentTime(), cookies, ip);
          if (context.user) throw new ApiError(409, '请先退出当前账号');
          if (own(state.users, username)) throw new ApiError(409, '该用户名已被使用');
          const user = { id: token(), username, nickname, createdAt: now, password: { salt: salt.toString('base64url'), hash: key.toString('base64url') } };
          state.users[username] = user;
          return signIn(state, credentials, context, user, currentTime(), cookies);
        });
      } else if (route === '/login') {
        const username = normalizeUsername(body.username);
        const password = validatePassword(body.password);
        limit('auth', `user:${username}`, now);
        const saved = await store.read(state => own(state.users, username)?.password);
        const key = await passwordWork(() => deriveKey(password, saved ? Buffer.from(saved.salt, 'base64url') : dummySalt, 64, SCRYPT));
        if (!timingSafeEqual(key, saved ? Buffer.from(saved.hash, 'base64url') : dummyHash) || !saved) throw new ApiError(401, '用户名或密码不正确');
        result = await store.transaction(state => {
          const user = own(state.users, username);
          if (!user || user.password.hash !== saved.hash) throw new ApiError(401, '用户名或密码不正确');
          const context = identify(state, credentials, currentTime(), cookies, ip);
          return signIn(state, credentials, context, user, currentTime(), cookies);
        });
      } else {
        if (route === '/nickname') body.nickname = normalizeNickname(body.nickname);
        if (route === '/start') findBoard(body.game);
        if (route === '/finish' && (typeof body.runId !== 'string' || !TOKEN.test(body.runId) || typeof body.value !== 'number' || !Number.isFinite(body.value) || !['won', 'lost', 'over'].includes(body.outcome))) throw new ApiError(400, '成绩提交格式不正确');
        if (route === '/board') findBoard(url.searchParams.get('game'));
        result = await store.transaction(state => {
          const requestTime = currentTime();
          const context = identify(state, credentials, requestTime, cookies, ip);
          if (route === '/session') return sessionResult(context);
          if (route === '/nickname') {
            context.person.nickname = body.nickname;
            return sessionResult(context);
          }
          if (route === '/logout') {
            const previous = credentials.get(SESSION_COOKIE);
            if (previous) delete state.sessions[digest(previous)];
            setCookie(cookies, SESSION_COOKIE, '', 0);
            if (!context.user) return sessionResult(context);
            const guest = newGuest(state, requestTime, cookies);
            return sessionResult({ user: null, person: guest });
          }
          if (route === '/board') {
            const board = findBoard(url.searchParams.get('game'));
            const { ordered, entries, players } = readBoardRanking(state, board.id);
            const position = ordered.findIndex(([identity]) => identity === context.identity);
            return {
              board,
              entries: entries.map((entry, index) => ({ ...entry, mine: index === position })),
              myBest: position < 0 ? null : { rank: position + 1, value: ordered[position][1].value },
              players,
            };
          }
          if (route === '/start') {
            sweep(state, requestTime);
            if (Object.keys(state.runs).length >= maxRuns) throw new ApiError(429, '当前对局较多，请稍后再试');
            const runId = token();
            state.runs[digest(runId)] = { identity: context.identity, boardId: body.game, startedAt: requestTime, expiresAt: requestTime + runTtlMs, finished: null };
            return { runId };
          }
          const run = own(state.runs, digest(body.runId));
          if (!run || run.expiresAt <= requestTime) throw new ApiError(410, '对局凭证已失效，请重新开始');
          if (run.identity !== context.identity) throw new ApiError(403, '该对局不属于当前玩家');
          if (run.finished) {
            if (run.finished.value !== body.value || run.finished.outcome !== body.outcome) throw new ApiError(409, '该对局已提交其他成绩');
            return run.finished.result;
          }
          const board = findBoard(run.boardId);
          let finish = { eligible: false, rank: null, improved: false, needsName: false, boardId: board.id, value: body.value };
          if (board.direction !== 'asc' || body.outcome === 'won') {
            const steps = board.step === undefined ? 0 : (body.value - board.min) / board.step;
            if (body.value < board.min || body.value > board.max || Math.abs(steps - Math.round(steps)) > 1e-8) throw new ApiError(422, '成绩超出该榜单允许的范围');
            if (requestTime - run.startedAt < board.minDurationMs) throw new ApiError(422, '对局时间过短，请完成对局后提交');
            const recordBoard = own(state.records, board.id) || (state.records[board.id] = { direction: board.direction, entries: {} });
            const previous = own(recordBoard.entries, context.identity);
            const improved = !previous || (board.direction === 'asc' ? body.value < previous.value : body.value > previous.value);
            if (improved) recordBoard.entries[context.identity] = { value: body.value, at: requestTime, order: ++state.sequence };
            const rank = ranking(state, board.id).findIndex(([identity]) => identity === context.identity) + 1;
            finish = { ...finish, eligible: rank <= 10, rank, improved, needsName: rank <= 10 && !context.person.nickname };
          }
          run.finished = { value: body.value, outcome: body.outcome, result: finish };
          return finish;
        });
      }
      const setCookies = [...cookies].map(([name, cookie]) => `${name}=${cookie.value}; Path=${PREFIX}; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(cookie.maxAge / 1000)}${secure ? '; Secure' : ''}`);
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(setCookies.length ? { 'Set-Cookie': setCookies } : {}) });
      response.end(JSON.stringify(result));
    } catch (error) {
      if (!response.destroyed && !response.headersSent) {
        const status = error instanceof ApiError ? error.status : 500;
        response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(request.method === 'POST' ? { Connection: 'close' } : {}) });
        response.end(JSON.stringify({ error: error instanceof ApiError ? error.message : '记录服务暂时不可用，请稍后重试' }));
      }
    }
    return true;
  };
  handler.publicBoard = async (boardId = null) => {
    const board = findBoard(boardId ?? (boardMap.has(DEFAULT_RECORD_BOARD_ID) ? DEFAULT_RECORD_BOARD_ID : catalog[0].id));
    return store.read(state => {
      const { entries, players } = readBoardRanking(state, board.id);
      return { entries, players };
    });
  };
  handler.close = () => store.close();
  return handler;
}
