import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

// One process owns a directory at a time. A crash deliberately leaves its lock
// behind: an operator must confirm that process has stopped before removing it.
export async function createRecordsStore({ dataDir, initialState, validateState }) {
  if (typeof dataDir !== 'string' || !dataDir) throw new Error('Records dataDir is required');
  const directory = path.resolve(dataDir);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const filename = path.join(directory, 'records.json');
  const lockPath = path.join(directory, 'records.lock');
  let lock;
  try {
    lock = await open(lockPath, 'wx', 0o600);
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('Records storage is locked; stop its owner before removing records.lock');
    throw error;
  }

  const nonce = randomUUID();
  let state;
  let serialized;
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, nonce }), 'utf8');
    await lock.sync();
    try {
      serialized = await readFile(filename, 'utf8');
      state = JSON.parse(serialized);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      state = structuredClone(initialState);
    }
    validateState(state);
    serialized = JSON.stringify(state);
  } catch (error) {
    await lock.close().catch(() => {});
    await unlink(lockPath).catch(() => {});
    throw error;
  }

  let pending = Promise.resolve();
  let closing = false;
  let closePromise;

  function transaction(work) {
    if (closing) return Promise.reject(new Error('Records storage is closed'));
    const operation = pending.then(async () => {
      const draft = structuredClone(state);
      const result = await work(draft);
      validateState(draft);
      const next = JSON.stringify(draft);
      if (next !== serialized) {
        const temporary = path.join(directory, `.records-${randomUUID()}.tmp`);
        let file;
        try {
          file = await open(temporary, 'wx', 0o600);
          await file.writeFile(next, 'utf8');
          await file.sync();
          await file.close();
          file = undefined;
          await rename(temporary, filename);
        } catch (error) {
          if (file) await file.close().catch(() => {});
          await unlink(temporary).catch(() => {});
          throw error;
        }
        state = draft;
        serialized = next;
      }
      return result;
    });
    // A failed write must not prevent later independent requests from running.
    pending = operation.catch(() => {});
    return operation;
  }

  function read(project) {
    if (closing) return Promise.reject(new Error('Records storage is closed'));
    return pending.then(() => project(state));
  }

  function close() {
    if (closePromise) return closePromise;
    closing = true;
    closePromise = pending.then(async () => {
      await lock.close();
      const current = JSON.parse(await readFile(lockPath, 'utf8'));
      if (current.nonce !== nonce) throw new Error('Records storage lock ownership changed');
      await unlink(lockPath);
    });
    return closePromise;
  }

  return { transaction, read, close };
}
