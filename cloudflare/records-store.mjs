import { Buffer } from 'node:buffer';
import { ApiError } from '../scripts/records-api.mjs';

// The records API validates and ranks a complete snapshot. Bound that working set
// independently of the larger SQLite quota and leave room for scrypt in the isolate.
const MAX_STATE_BYTES = 6 * 1024 * 1024;
const DAY = 24 * 60 * 60 * 1000;
const GUEST_LIFETIME = 365 * DAY;
const collections = new Set(['users', 'guests', 'sessions', 'runs']);

function encode(state) {
  const rows = new Map();
  let bytes = 0;
  function put(key, value) {
    const json = JSON.stringify(value);
    bytes += Buffer.byteLength(key) + Buffer.byteLength(json);
    if (bytes > MAX_STATE_BYTES) throw new ApiError(503, '记录存储容量已满，暂时无法保存新数据');
    rows.set(key, json);
  }
  put('meta', { version: state.version, sequence: state.sequence });
  for (const name of collections) {
    for (const [id, value] of Object.entries(state[name])) put(`${name}/${id}`, value);
  }
  for (const [id, board] of Object.entries(state.records)) {
    put(`board/${id}`, board.direction);
    for (const [identity, record] of Object.entries(board.entries)) put(`score/${id}/${identity}`, record);
  }
  return rows;
}

function load(sql, initialState) {
  const state = structuredClone(initialState);
  const exists = sql.exec("SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'records_state'").toArray().length !== 0;
  if (!exists) return { state, exists };
  let metadata = false;
  // Board definitions sort before scores. Each row is small, including on a large board.
  for (const { key, value } of sql.exec('SELECT key, value FROM records_state ORDER BY key')) {
    const parts = key.split('/');
    const [group, id, identity] = parts;
    const entry = JSON.parse(value);
    if (key === 'meta') {
      state.version = entry.version;
      state.sequence = entry.sequence;
      metadata = true;
    } else if (parts.length === 2 && collections.has(group) && id !== '__proto__') {
      state[group][id] = entry;
    } else if (parts.length === 2 && group === 'board' && id !== '__proto__') {
      state.records[id] = { direction: entry, entries: {} };
    } else if (parts.length === 3 && group === 'score' && Object.hasOwn(state.records, id) && identity !== '__proto__') {
      state.records[id].entries[identity] = entry;
    } else {
      throw new Error('Invalid records storage row');
    }
  }
  if (!metadata) throw new Error('Missing records storage metadata');
  return { state, exists };
}

function removeExpired(state, now) {
  const active = new Set();
  for (const [key, run] of Object.entries(state.runs)) {
    if (run.expiresAt <= now) delete state.runs[key];
    else active.add(run.identity);
  }
  for (const [key, session] of Object.entries(state.sessions)) {
    if (session.expiresAt <= now) delete state.sessions[key];
  }
  for (const board of Object.values(state.records)) {
    for (const identity of Object.keys(board.entries)) active.add(identity);
  }
  // A guest cookie expires one year after issuance. Keep every guest with a score
  // or an unexpired run so rankings and active submissions retain their identity.
  for (const [key, guest] of Object.entries(state.guests)) {
    if (guest.createdAt + GUEST_LIFETIME <= now && !active.has(`g:${guest.id}`)) delete state.guests[key];
  }
}

export function sqliteRecordsPersistence(storage) {
  const sql = storage.sql;
  let bucketCount = null;

  function createStore({ initialState, validateState }) {
    let { state, exists } = load(sql, initialState);
    validateState(state);
    let rows = encode(state);
    let nextCleanup = 0;

    function transaction(work) {
      const draft = structuredClone(state);
      const now = Date.now();
      if (now >= nextCleanup) removeExpired(draft, now);
      const result = work(draft);
      if (result && typeof result.then === 'function') throw new Error('Durable record transactions must be synchronous');
      validateState(draft);
      const next = encode(draft);
      const writes = new Map();
      for (const [key, value] of next) if (rows.get(key) !== value) writes.set(key, value);
      const removed = [];
      for (const key of rows.keys()) if (!next.has(key)) removed.push(key);
      if (!writes.size && !removed.length) {
        if (now >= nextCleanup) nextCleanup = now + DAY;
        return result;
      }
      storage.transactionSync(() => {
        if (!exists) {
          sql.exec('CREATE TABLE records_state (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID');
          writes.set('meta', next.get('meta'));
        }
        for (const [key, value] of writes) sql.exec('INSERT OR REPLACE INTO records_state (key, value) VALUES (?, ?)', key, value);
        for (const key of removed) sql.exec('DELETE FROM records_state WHERE key = ?', key);
      });
      // Publish memory only after every row of the transaction has committed.
      state = draft;
      rows = next;
      exists = true;
      if (now >= nextCleanup) nextCleanup = now + DAY;
      return result;
    }
    return { transaction, read: project => project(state), close() {} };
  }

  function consumeLimit(key, now, { limit, windowMs }, maxKeys) {
    let count = bucketCount;
    const allowed = storage.transactionSync(() => {
      if (count === null) {
        sql.exec('CREATE TABLE IF NOT EXISTS records_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires INTEGER NOT NULL) WITHOUT ROWID');
        count = sql.exec('SELECT COUNT(*) AS n FROM records_limits').one().n;
      }
      const row = sql.exec('SELECT attempts, expires FROM records_limits WHERE key = ?', key).toArray()[0];
      if (row && row.expires > now) {
        if (row.attempts >= limit) return false;
        sql.exec('UPDATE records_limits SET attempts = attempts + 1 WHERE key = ?', key);
        return true;
      }
      if (!row) {
        if (count >= maxKeys) {
          sql.exec('DELETE FROM records_limits WHERE expires <= ?', now);
          count -= sql.exec('SELECT changes() AS n').one().n;
          if (count >= maxKeys) return false;
        }
        count++;
      }
      sql.exec('INSERT OR REPLACE INTO records_limits (key, attempts, expires) VALUES (?, 1, ?)', key, now + windowMs);
      return true;
    });
    bucketCount = count;
    return allowed;
  }

  return { createStore, consumeLimit };
}
