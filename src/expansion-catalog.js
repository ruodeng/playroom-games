import { games as paper } from './expansion/paper-catalog.js';
import { games as spatial } from './expansion/spatial-catalog.js';
import { games as arcade } from './expansion/arcade-catalog.js';
import { games as action } from './expansion/action-catalog.js';
import { games as sports } from './expansion/sports-catalog.js';
import { games as boards } from './expansion/boards-catalog.js';
import { games as cards } from './expansion/cards-catalog.js';
import { games as sim } from './expansion/sim-catalog.js';
import { games as strategy } from './expansion/strategy-catalog.js';
import { games as words } from './expansion/words-catalog.js';

const groups = [
  ['paper', '纸笔逻辑', 'puzzle', paper], ['spatial', '空间解谜', 'puzzle', spatial],
  ['arcade', '经典街机', 'arcade', arcade], ['action', '动作闯关', 'arcade', action],
  ['sports', '体育竞技', 'arcade', sports], ['boards', '棋盘对弈', 'strategy', boards],
  ['cards', '纸牌与骰子', 'strategy', cards], ['sim', '轻经营', 'strategy', sim],
  ['strategy', '策略调度', 'strategy', strategy], ['words', '文字与数字', 'puzzle', words],
];

export const EXPANSION_GAMES = groups.flatMap(([group, category, filter, games], groupIndex) => games.map((game, index) => ({
  ...game, group, category, filter, viewId: 'expansion-view',
  number: String(33 + groupIndex * 10 + index).padStart(3, '0'),
  detail: '单人挑战', artClass: `expansion-art expansion-art-${group}`,
  art: `<div class="expansion-card-board"><span${[...game.icon].length > 1 ? ' class="expansion-card-word"' : ''}>${game.icon}</span><i></i><i></i><i></i></div>`,
})));
