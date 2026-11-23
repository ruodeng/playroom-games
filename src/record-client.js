let sessionPromise;
const attempts = new WeakMap();

export function invalidateRecordAttempt(root) {
  attempts.delete(root);
}

async function request(endpoint, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`/api/records${endpoint}`, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw new Error(data?.error || '纪录榜暂时连接不上，请稍后重试。');
    return data;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('纪录榜连接中断，请检查网络后重试。');
    throw error;
  } finally { clearTimeout(timeout); }
}

export function getRecordSession(refresh = false) {
  if (refresh || !sessionPromise) sessionPromise = request('/session').catch(error => { sessionPromise = null; throw error; });
  return sessionPromise;
}

export async function recordsRequest(endpoint, body) {
  await getRecordSession();
  const result = await request(endpoint, body);
  if (['/login', '/register', '/logout', '/nickname'].includes(endpoint)) {
    sessionPromise = Promise.resolve(result);
    document.dispatchEvent(new CustomEvent('playroom:identity', { detail: result }));
  }
  return result;
}

export function startRecordAttempt(boardId, root) {
  const generation = {};
  attempts.set(root, generation);
  const isCurrent = () => attempts.get(root) === generation;
  let startError;
  const ticket = recordsRequest('/start', { game: boardId }).catch(error => { startError = error; return null; });
  let inFlight = null, complete = false;
  const notice = (message, retry) => {
    if (!isCurrent()) return;
    let box = root.querySelector('.record-feedback');
    if (!box) {
      box = document.createElement('div'); box.className = 'record-feedback'; box.setAttribute('role', 'status');
      (root.querySelector('.arcade-panel') || root.querySelector('.snake-panel') || root.querySelector('.tetris-panel') || root).append(box);
    }
    box.replaceChildren(document.createTextNode(message));
    if (retry) {
      const button = document.createElement('button'); button.className = 'text-button'; button.textContent = '重试上传';
      button.addEventListener('click', retry, { once: true }); box.append(button);
    }
  };
  root.querySelector('.record-feedback')?.remove();
  return {
    finish(value, outcome) {
      if (complete) return Promise.resolve();
      if (inFlight) return inFlight;
      inFlight = (async () => {
        notice('正在提交本局纪录…');
        const run = await ticket;
        if (!run) { notice(`本局未上传：${startError?.message || '开始时未连接纪录榜。'} 下一局再来挑战。`); complete = true; return; }
        try {
          const result = await recordsRequest('/finish', { runId: run.runId, value, outcome });
          complete = true;
          notice(result.rank ? result.improved ? `本局纪录已保存 · 本站第 ${result.rank} 名` : `本局已结算 · 最佳成绩为本站第 ${result.rank} 名` : '本局已结算，继续挑战更好的成绩。');
          document.dispatchEvent(new CustomEvent('playroom:record-result', { detail: { ...result, boardId, root, isCurrent } }));
        } catch (error) {
          notice(`纪录未确认：${error.message}`, () => { inFlight = null; this.finish(value, outcome); });
        }
      })().catch(error => { notice(`本局未上传：${error.message}`); }).finally(() => { inFlight = null; });
      return inFlight;
    },
  };
}
