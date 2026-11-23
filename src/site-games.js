import { ARCADE_GAMES } from './arcade-games.js';
import { MONOPOLY_GAME } from './monopoly-ui.js';
import { PUZZLE_GAMES } from './puzzle-pack.js';
import { ACTION_GAMES } from './action-pack.js';
import { BOARD_GAMES } from './board-pack.js';
import { CLASSIC_GAMES } from './classic-pack.js';
import { EXPANSION_GAMES } from './expansion-catalog.js';

const snakeArt = [[5, 3], [5, 4], [5, 5], [4, 5], [3, 5], [3, 6]];
const tetrisArt = {
  T: [[2, 5], [3, 4], [3, 5], [3, 6]],
  I: [[8, 1], [8, 2], [8, 3], [8, 4]],
  L: [[7, 5], [8, 5], [8, 6], [8, 7]],
  O: [[7, 9], [7, 10], [8, 9], [8, 10]],
  S: [[6, 2], [6, 3], [7, 1], [7, 2]],
};

const builtInGames = [
  {
    id: 'gomoku', name: '五子棋', number: '001', category: '经典棋类', filter: 'strategy',
    description: '黑白之间，来一场思维的散步。', detail: '人机对战', symbol: 'stones', viewId: 'game-view',
    art: `<div class="mini-board">${['one', 'two', 'three', 'four', 'five'].map(piece => `<i class="mini-piece piece-${piece}"></i>`).join('')}</div>`,
  },
  {
    id: 'snake', name: '贪吃蛇', number: '002', category: '休闲街机', filter: 'arcade',
    description: '吃掉小点心，把快乐变长一点。', detail: '单人挑战 · 三档速度', symbol: 'snake', viewId: 'snake-view',
    artClass: 'snake-card-art', art: `<div class="mini-snake-board">${snakeArt.map(([row, col], i) => `<i${i === snakeArt.length - 1 ? ' class="mini-snake-head"' : ''} style="grid-area:${row} / ${col}"></i>`).join('')}<b style="grid-area:3 / 8"></b></div>`,
  },
  {
    id: 'tetris', name: '俄罗斯方块', number: '003', category: '益智街机', filter: 'puzzle',
    description: '转个方向，总有合适的位置。', detail: '单人挑战 · 消行升级', symbol: 'tetris', viewId: 'tetris-view',
    artClass: 'tetris-card-art', art: `<div class="mini-tetris-board">${Object.entries(tetrisArt).flatMap(([piece, cells]) => cells.map(([row, col]) => `<i class="tetromino tetromino-${piece}" style="grid-area:${row} / ${col}"></i>`)).join('')}</div>`,
  },
];

const navIcons = { monopoly: '⌂', merge: '2ⁿ', mines: '⚑', sudoku: '9', memory: '◇', breakout: '▤', tictactoe: '×', lights: '☼' };

export const EXTRA_GAMES = [...ARCADE_GAMES, MONOPOLY_GAME, ...PUZZLE_GAMES, ...ACTION_GAMES, ...BOARD_GAMES, ...CLASSIC_GAMES];
export const SITE_GAMES = [...builtInGames, ...EXTRA_GAMES, ...EXPANSION_GAMES];
export function renderGameTypes() {
  return [...new Set([...EXPANSION_GAMES, ...SITE_GAMES].map(game => game.category))]
    .map(category => `<option value="${category}">${category}</option>`).join('');
}

export function renderGameNav(game, active = false) {
  const icon = game.symbol
    ? `<svg class="icon" aria-hidden="true"><use href="#icon-${game.symbol}"/></svg>`
    : `<span class="arcade-nav-icon" aria-hidden="true">${game.icon || navIcons[game.id] || '◉'}</span>`;
  return `<a class="nav-link${active ? ' active' : ''}" id="nav-${game.id}" href="/games/${game.id}" title="${game.name}" aria-label="${game.name}"${active ? ' aria-current="page"' : ''}>${icon}<span>${game.name}</span><span class="active-dot"></span></a>`;
}

export function renderGameCard(game) {
  const artClass = game.group ? game.artClass : game.symbol ? game.artClass || '' : `arcade-card-art art-${game.id}-back`;
  const arrow = '<svg class="icon" aria-hidden="true"><use href="#icon-arrow"/></svg>';
  return `<a class="game-card" href="/games/${game.id}" data-category="${game.filter}" data-type="${game.category}" data-new="${Number(game.number) >= 33}"><div class="game-card-art ${artClass}" aria-hidden="true">${game.art}<span class="card-index">${game.number}</span></div><div class="game-card-content"><span class="tag">${game.category}</span><h2>${game.name}${arrow}</h2><p>${game.description}</p><div class="card-meta"><span>${game.detail}</span><span>即刻开玩 ↗</span></div></div></a>`;
}

export function mountStaticViews() {
  for (const template of document.querySelectorAll('#inactive-views, #game-dialogs')) {
    template.replaceWith(template.content);
  }
}
