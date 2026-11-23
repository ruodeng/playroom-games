import { SITE_GAMES, renderGameCard, renderGameNav, renderGameTypes } from '../src/site-games.js';
import { renderArcadeView, renderInitialRecordLink } from '../src/arcade-panel.js';
import { renderExpansionView } from '../src/expansion-view.js';
import { renderMonopolyView } from '../src/monopoly-ui.js';
import { RECORD_BOARDS } from '../src/record-catalog.js';
import { SIZE, coordinate } from '../src/gomoku.js';
import { createSnakeGame } from '../src/snake.js';
import { createTetrisGame, landingPiece, pieceCells } from '../src/tetris.js';

const htmlEntities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => htmlEntities[char]);
const viewsSlot = /<!-- site-views -->\s*([\s\S]*?)\s*<!-- \/site-views -->/;
const gameById = new Map(SITE_GAMES.map(game => [game.id, game]));
const indices = Array.from({ length: SIZE }, (_, index) => index);
const columnLabels = indices.map(index => `<span>${String.fromCharCode(65 + index)}</span>`).join('');
const rowLabels = indices.map(index => `<span>${SIZE - index}</span>`).join('');
const boardLines = indices.map(index => {
  const position = 20 + index * 40;
  return `<path d="M20 ${position}H580M${position} 20V580"/>`;
}).join('') + [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]].map(([row, col]) =>
  `<circle class="star-point" cx="${20 + col * 40}" cy="${20 + row * 40}" r="3.6"/>`).join('');
const boardCells = indices.map(row => {
  const cells = indices.map(col => `<button class="cell" type="button" data-index="${row * SIZE + col}" data-player="0" role="gridcell" aria-colindex="${col + 1}" aria-label="${coordinate(row, col)}，空位" tabindex="${row === 7 && col === 7 ? 0 : -1}"></button>`).join('');
  return `<div class="board-row" role="row" aria-rowindex="${row + 1}">${cells}</div>`;
}).join('');

function renderSnakeField() {
  const { snake, direction, food } = createSnakeGame(() => 0.36);
  const segments = snake.map(({ x, y }, index) => `<span class="snake-segment${index === 0 ? ' snake-head' : ''}"${index === 0 ? ` data-direction="${direction}"` : ''} style="grid-area:${y + 1} / ${x + 1}"></span>`);
  return segments.join('') + `<span class="snake-food" style="grid-area:${food.y + 1} / ${food.x + 1}"></span>`;
}

function tetrisBlock(type, { x, y }, variant = '') {
  return `<span class="tetromino tetromino-${type} ${variant}" style="grid-area:${y + 1} / ${x + 1}"></span>`;
}

function renderTetris(view) {
  const game = createTetrisGame(() => 0.36);
  const { current, queue } = game;
  const field = pieceCells(landingPiece(game)).map(cell => tetrisBlock(current.type, cell, 'tetromino-ghost')).join('')
    + pieceCells(current).map(cell => tetrisBlock(current.type, cell, 'tetromino-active')).join('');
  const next = queue.slice(0, 3).map((type, index) => {
    const cells = pieceCells({ type, rotation: 0, x: 0, y: 0 });
    const minX = Math.min(...cells.map(cell => cell.x));
    const minY = Math.min(...cells.map(cell => cell.y));
    const width = Math.max(...cells.map(cell => cell.x)) - minX + 1;
    const height = Math.max(...cells.map(cell => cell.y)) - minY + 1;
    const blocks = cells.map(({ x, y }) => tetrisBlock(type, {
      x: x - minX + Math.floor((4 - width) / 2), y: y - minY + Math.floor((4 - height) / 2),
    })).join('');
    return `<div class="tetris-preview-grid" role="img" aria-label="接下来第 ${index + 1} 个：${type} 形方块">${blocks}</div>`;
  }).join('');
  return view.replace(/(id="tetris-field"[^>]*>)(<\/div>)/, `$1${field}$2`)
    .replace(/(id="tetris-next"[^>]*>)(<\/div>)/, `$1${next}$2`);
}

function enhanceBuiltIn(view, id) {
  const game = gameById.get(id);
  let updated = view.replace('<!-- record-link -->', () => renderInitialRecordLink(id));
  if (id === 'gomoku') {
    updated = updated.replace(/(id="column-labels"[^>]*>)(<\/div>)/, `$1${columnLabels}$2`)
      .replace(/(id="row-labels"[^>]*>)(<\/div>)/, `$1${rowLabels}$2`)
      .replace(/(id="board-lines"[^>]*>)(<\/svg>)/, `$1${boardLines}$2`)
      .replace(/(id="board"[^>]*>)(<\/div>)/, `$1${boardCells}$2`);
  }
  if (id === 'snake') updated = updated.replace(/(id="snake-field"[^>]*>)(<\/div>)/, `$1${renderSnakeField()}$2`);
  if (id === 'tetris') updated = renderTetris(updated);
  return updated.replace(/(<p class="page-description">).*?(<\/p>)/, `$1${game.description}$2`);
}

export function renderPage(template, page, { head = '', recordsHtml = '' } = {}) {
  const game = page.kind === 'game' ? gameById.get(page.id) : null;
  const board = page.kind === 'records' ? RECORD_BOARDS.find(item => item.id === page.id) : null;
  const breadcrumb = page.name ?? (game?.name || (board ? `${board.name} · ${board.label}排行榜` : page.kind === 'records' ? '片刻纪录榜' : '游戏大厅'));
  const selectedView = page.kind === 'home' ? 'library-view' : game?.viewId;
  const [, views] = template.match(viewsSlot);
  let visible = recordsHtml;
  const inactive = [];
  for (const [main, viewId] of views.matchAll(/<main id="([a-z-]+)"[^>]*>[\s\S]*?<\/main>/g)) {
    const view = main.replace(/^(<main[^>]*?)\s+hidden(?=>)/, '$1');
    if (viewId === selectedView) {
      visible = game ? enhanceBuiltIn(view, game.id) : view.replace('<!-- game-cards -->', () => SITE_GAMES.map(renderGameCard).join('\n        '));
    } else {
      inactive.push(view.replace(/^(<main[^>]*)(>)/, '$1 hidden$2'));
    }
  }
  if (game && !selectedView) {
    visible = game.id === 'monopoly' ? renderMonopolyView() : renderArcadeView(game, { preview: true });
  }
  if (game?.group) visible = renderExpansionView(game);
  const expansionPlaceholder = game?.group ? '' : '<section id="expansion-view" hidden></section>';
  const navigation = SITE_GAMES.filter(item => !item.group).map(item => renderGameNav(item, item.id === game?.id)).join('\n        ');
  return template.replace(/<title>.*?<\/title>/, () => `<title>${escapeHtml(page.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${escapeHtml(page.description)}">`)
    .replace('<!-- site-head -->', () => head)
    .replace('<body>', () => `<body data-page-kind="${escapeHtml(page.kind)}"${page.id ? ` data-page-id="${escapeHtml(page.id)}"` : ''}>`)
    .replace(/<strong id="breadcrumb-page">.*?<\/strong>/, () => `<strong id="breadcrumb-page">${escapeHtml(breadcrumb)}</strong>`)
    .replace('<!-- game-navigation -->', () => navigation)
    .replace('<a class="nav-link active" id="nav-library" href="/" aria-label="游戏大厅" aria-current="page">', () => page.kind === 'home'
      ? '<a class="nav-link active" id="nav-library" href="/" aria-label="游戏大厅" aria-current="page">'
      : '<a class="nav-link" id="nav-library" href="/" aria-label="游戏大厅">')
    .replace('<a class="nav-link" id="nav-records"', () => page.kind === 'records'
      ? '<a class="nav-link active" id="nav-records" aria-current="page"'
      : '<a class="nav-link" id="nav-records"')
    .replace(viewsSlot, () => `${visible}\n    ${expansionPlaceholder}\n    <template id="inactive-views">\n      ${inactive.join('\n      ')}\n    </template>`)
    .replace('<!-- game-types -->', () => renderGameTypes());
}
