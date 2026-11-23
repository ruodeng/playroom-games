import { SITE_GAMES } from './site-games.js';
import { RECORD_BOARDS } from './record-catalog.js';

export const SITE_ORIGIN = 'https://games.uutom.com';
const brand = '片刻 Playroom';
const pages = new Map();

function addPage(path, kind, id, name, description) {
  pages.set(path, { path, kind, id, name, title: `${name} · ${brand}`, description });
}

addPage('/', 'home', null, '游戏大厅', `片刻 Playroom 收录 ${SITE_GAMES.length} 款免费在线小游戏。选择五子棋、贪吃蛇、俄罗斯方块或大富翁，即可在浏览器开局。`);
for (const game of SITE_GAMES) {
  addPage(`/games/${game.id}`, 'game', game.id, game.name, `${game.name}在线小游戏。${game.description} 查看玩法，在浏览器开始游戏。`);
}
addPage('/records', 'records', null, '片刻纪录榜', `查看本站 ${RECORD_BOARDS.length} 个小游戏分榜。按得分、步数或用时挑战前十，为自己的纪录留下昵称。`);
for (const board of RECORD_BOARDS) {
  addPage(`/records/${board.id}`, 'records', board.id, `${board.name} · ${board.label}排行榜`, `查看${board.name}「${board.label}」本站前十名。每位玩家保留最佳纪录，同成绩按先达成者优先。`);
}

export const SITE_PATHS = Object.freeze([...pages.keys()]);
export function getPage(pathname) { return pages.get(pathname); }

export function legacyPath(hash) {
  if (!hash.startsWith('#/')) return null;
  const [id, query] = hash.slice(2).split('?');
  if (!id) return '/';
  if (id === 'records') {
    const board = new URLSearchParams(query).get('game');
    return pages.has(`/records/${board}`) ? `/records/${board}` : '/records';
  }
  return pages.has(`/games/${id}`) ? `/games/${id}` : null;
}
