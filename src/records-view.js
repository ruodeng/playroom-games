import { DEFAULT_RECORD_BOARD_ID, RECORD_BOARDS, getRecordBoardById } from './record-catalog.js';

const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export const recordsPath = boardId => boardId ? `/records/${encodeURIComponent(boardId)}` : '/records';
export const formatRecordValue = (board, value) => `${Number(value).toLocaleString('zh-CN')} ${board.unit}`;
export const recordBoardLabel = board => `${board.name} · ${board.label}`;
export const recordBoardRule = board => `${recordBoardLabel(board)} ｜ ${board.direction === 'asc' ? '越少越好' : '越高越好'}，每位玩家保留最佳一局。`;

export function renderRecordRows(board, entries) {
  if (!entries.length) return '<p class="records-empty">这一页还没有名字。去玩一局，成为第一位纪录保持者。</p>';
  return entries.map(entry => {
    const rank = escape(entry.rank);
    const date = new Date(entry.at).toLocaleDateString('zh-CN');
    return `<div class="record-row${entry.mine ? ' record-mine' : ''}">
      <span class="record-rank record-rank-${rank}">${rank.padStart(2, '0')}</span>
      <div class="record-player"><strong>${escape(entry.name)}</strong><small>${entry.mine ? '这是你 · ' : ''}${escape(date)}</small></div>
      <strong class="record-value">${escape(formatRecordValue(board, entry.value))}</strong>
    </div>`;
  }).join('');
}

export function renderRecordsView(boardId = null, publicBoard = null) {
  const board = getRecordBoardById(boardId ?? DEFAULT_RECORD_BOARD_ID);
  if (!board) throw new RangeError('Unknown records board');
  const options = RECORD_BOARDS.map(item => `<option value="${item.id}"${item.id === board.id ? ' selected' : ''}>${escape(recordBoardLabel(item))}</option>`).join('');
  const links = RECORD_BOARDS.map(item => `<li><a href="${recordsPath(item.id)}"${item.id === boardId ? ' aria-current="page"' : ''}>${escape(recordBoardLabel(item))}</a></li>`).join('');
  const rows = publicBoard ? renderRecordRows(board, publicBoard.entries) : '<p class="records-empty record-load-error">纪录榜暂时连接不上，请稍后重试。</p>';
  return `<main id="records-view" class="main-content records-view" data-board-id="${board.id}"${publicBoard ? ' data-records-ready' : ''}>
    <div class="page-heading"><div><p class="eyebrow">THE PLAYROOM · HALL OF FAME</p><div class="title-row"><h1>片刻纪录榜</h1><span class="tag">本站 TOP 10</span></div><p class="page-description">认真玩一局，给自己的名字留个位置。</p></div><button type="button" class="button button-quiet records-account" disabled>登录 / 注册</button></div>
    <section class="records-hero"><div><span class="records-laurel" aria-hidden="true">✦</span><p class="eyebrow">A LITTLE MOMENT. A LITTLE RECORD.</p><h2>你的小小纪录，<br>也值得被记住。</h2><p>游客也能挑战。进入前 10，就为纪录留下名字。</p></div><div class="records-identity"><span class="small-label">YOUR PLAYER CARD</span><strong>游客挑战者</strong><p>每个榜单只保留你的最佳成绩。</p><button type="button" class="button button-secondary records-profile" disabled>我的玩家名片 ↗</button></div></section>
    <div class="records-board-heading"><div><p class="eyebrow">THE LEADERBOARD</p><h2>${escape(recordBoardLabel(board))}</h2></div><button type="button" class="button button-quiet records-refresh" disabled>刷新榜单 ↻</button></div>
    <div class="records-picker"><label for="records-game">选择游戏与挑战</label><select id="records-game" disabled>${options}</select><a class="button button-primary records-play" href="/games/${board.game}">去挑战 →</a></div>
    <p class="records-rule">${escape(recordBoardRule(board))}</p><p class="records-own" hidden></p>
    <section class="records-board" aria-label="本站前十名"><div class="records-board-labels" aria-hidden="true"><span>名次</span><span>玩家</span><span>最佳纪录</span></div><div class="records-rows" aria-live="polite">${rows}</div></section>
    <p class="records-status record-load-error" role="status" hidden></p>
    <p class="records-footnote">站内休闲挑战榜 · 同分按先取得纪录者优先 · 不同难度、关卡分别排名。<br>成绩来自玩家游戏结果，用于交流与挑战。</p>
    <details class="records-index"><summary>全部榜单</summary><ul>${links}</ul></details>
    <footer class="page-footer"><span>下一次，也许就是你的名字。</span><a href="/">返回游戏大厅 ↗</a></footer>
  </main>`;
}
