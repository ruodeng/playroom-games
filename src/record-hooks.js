import { getRecordBoard, getRecordResult } from './record-catalog.js';
import { startRecordAttempt } from './record-client.js';
import { recordsPath } from './records-view.js';

// The injected transport and clock keep lifecycle checks independent of the DOM.
export function createRecordTracker(gameId, { startAttempt = startRecordAttempt, now = () => performance.now(), root = null, updateLink = () => {} } = {}) {
  let run = null;
  const pause = () => {
    if (run?.clock !== null && run?.clock !== undefined) { run.elapsed += Math.max(0, now() - run.clock); run.clock = null; }
  };
  function begin(state, variant) {
    const board = getRecordBoard(gameId, state, variant);
    updateLink(board);
    if (!board || !['playing', 'running'].includes(state.status)) return;
    if (run && run.boardId !== board.id) { pause(); run = null; }
    if (!run) {
      run = { boardId: board.id, variant, elapsed: 0, clock: now(), finished: false, ticket: null };
      try { run.ticket = startAttempt(board.id, root); } catch { /* Gameplay remains available offline. */ }
      return;
    }
    if (!run.finished && run.clock === null) run.clock = now();
  }
  function observe(state, variant) {
    const board = getRecordBoard(gameId, state, variant);
    updateLink(board);
    if (!run || run.finished || board?.id !== run.boardId) return;
    if (!['won', 'lost', 'over'].includes(state.status)) return;
    pause();
    // Seal before invoking transport: renders, undo and asynchronous UI cannot
    // submit this attempt again or read the state of a later run.
    run.finished = true;
    const result = getRecordResult(gameId, state, run.elapsed, run.variant);
    if (!result || !run.ticket) return;
    try { Promise.resolve(run.ticket.finish(result.value, result.outcome)).catch(() => {}); } catch { /* Transport owns its error UI. */ }
  }
  return { begin, observe, pause, reset() { pause(); run = null; }, updateLink(state, variant) { updateLink(getRecordBoard(gameId, state, variant)); } };
}

export function createGameRecordTracker(gameId, root) {
  let link = root.querySelector('.game-aside .settings-panel .record-game-link');
  return createRecordTracker(gameId, { root, updateLink(board) {
    if (!board) { if (link) link.hidden = true; return; }
    if (!link) {
      const aside = root.querySelector('.game-aside .settings-panel');
      if (!aside) return;
      link = document.createElement('a'); link.className = 'record-game-link';
      aside.append(link);
    }
    link.hidden = false; link.href = recordsPath(board.id);
    link.textContent = '查看社区纪录 Top 10 →';
    link.setAttribute('aria-label', `${board.name} · ${board.label} · 查看社区纪录前十名`);
  } });
}
