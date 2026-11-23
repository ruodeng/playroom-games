const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => entities[char]);

export function renderExpansionView(game) {
  const safe = escapeHtml;
  return `<section id="expansion-view" class="main-content expansion-view" data-game-id="${safe(game.id)}">
    <div class="page-heading"><div><p class="eyebrow">THE PLAYROOM · ${safe(game.number)}</p><div class="title-row"><h1>${safe(game.name)}</h1><span class="tag">${safe(game.category)}</span></div><p class="page-description">${safe(game.description)}</p></div></div>
    <div class="game-layout"><div class="arcade-panel x-panel"><div class="x-toolbar"><p data-x-status role="status" aria-live="polite">准备就绪，开始这一局</p><button class="button button-quiet" type="button" data-x-pause disabled>暂停游戏</button></div><div class="x-host" data-x-host><div class="x-preview ${safe(game.artClass)}" aria-hidden="true">${game.art}</div></div><div class="x-actions"><button class="button button-primary" type="button" data-x-start>开始游戏</button></div><p class="x-note" data-x-result role="status" aria-live="polite"></p></div>
    <aside class="game-aside"><section class="rule-note"><h2>怎么玩，都在这里。</h2>${game.rules.map(rule => `<p>${safe(rule)}</p>`).join('')}${game.metric ? `<p>纪录榜：${safe(game.metric.label)}。固定挑战可计入榜单；练习模式和使用提示的对局不计入排名。</p><a class="record-game-link" href="/records/${safe(game.id)}">查看社区纪录 Top 10 →</a>` : ''}<a class="arcade-back" href="/">← 返回游戏大厅</a></section></aside></div>
    <footer class="page-footer"><span>给快乐，留一点时间。</span><span>${safe(game.name)} · 片刻 Playroom</span></footer>
  </section>`;
}
