import { EXPANSION_GAMES } from './expansion-catalog.js';

// Submission limits are generous service limits, not claims of theoretical maxima.
export const DEFAULT_RECORD_BOARD_ID = 'lights';

const score = (id, name, max = 1000000000, step = 1, minDurationMs = 1000) => ({ id, game: id, name, label: '最高得分', direction: 'desc', unit: '分', min: 0, max, minDurationMs, step });
const moves = (id, name, label = '最少步数', min = 1, max = 100000) => ({ id, game: id, name, label, direction: 'asc', unit: '步', min, max, minDurationMs: 1000 });
const time = (id, name) => ({ id, game: id, name, label: '最快通关', direction: 'asc', unit: '秒', min: 1, max: 604800, minDurationMs: 1000 });

export const RECORD_BOARDS = Object.freeze([
  ...[['easy', '慢慢来'], ['normal', '刚刚好'], ['fast', '手速派']].map(([speed, label]) => ({ ...score('snake', '贪吃蛇', 3970, 10), id: `snake-${speed}`, label: `${label} · 最高得分` })),
  score('tetris', '俄罗斯方块'), score('merge', '2048', 1000000000, 4),
  time('mines', '扫雷'), moves('sudoku', '数独', '最少操作'),
  { ...moves('memory', '记忆翻牌', '最少尝试', 8), unit: '次' },
  score('breakout', '打砖块', 300, 10), moves('lights', '点灯'),
  score('moles', '打地鼠', 1000, 5, 29000), time('linkup', '连连看'),
  score('match', '宝石消消乐', 1000000, 10),
  ...Array.from({ length: 3 }, (_, index) => ({ ...moves('sokoban', '推箱子'), id: `sokoban-${index + 1}`, label: `第 ${index + 1} 关 · 最少步数` })),
  moves('sliding', '数字华容道'),
  ...Array.from({ length: 4 }, (_, index) => ({ ...moves('water', '水排序'), id: `water-${index + 1}`, label: `第 ${index + 1} 关 · 最少倒水`, unit: '次' })),
  score('bubbles', '泡泡龙', 1000000, 10), score('flappy', '飞跃小鸟', 20),
  score('pong', '乒乓球', 700, 100), score('invaders', '太空射击', 1560, 10),
  score('maze', '迷宫吃豆', 1000000, 10),
  ...[4, 5, 6].map(disks => ({ ...moves('hanoi', '汉诺塔', '最少步数', 2 ** disks - 1), id: `hanoi-${disks}`, label: `${disks} 层 · 最少步数` })),
  moves('solitaire', '纸牌接龙'),
  { ...moves('word', '猜单词', '最少尝试', 1, 6), unit: '次' },
  { ...moves('code', '猜色密码', '最少尝试', 1, 10), unit: '次' },
  score('simon', '记忆节奏', 800, 100), score('runner', '恐龙跑酷'),
  ...EXPANSION_GAMES.filter(game => game.metric).map(({ id, name, metric }) => ({
    id, game: id, name, label: metric.label, unit: metric.unit, direction: metric.direction,
    min: metric.min ?? 0, max: metric.max ?? 1000000000, step: 1, minDurationMs: 250,
  })),
].map(board => Object.freeze(board)));

const boards = new Map(RECORD_BOARDS.map(board => [board.id, board]));

export function getRecordBoardById(id) {
  return boards.get(id) ?? null;
}

export function getRecordBoard(gameId, state = {}, variant) {
  let id = gameId;
  if (gameId === 'snake') id = `snake-${variant ?? state.speed ?? 'normal'}`;
  else if (gameId === 'sokoban' || gameId === 'water') id = `${gameId}-${state.level + 1}`;
  else if (gameId === 'hanoi') id = `hanoi-${state.disks}`;
  return getRecordBoardById(id);
}

export function getRecordResult(gameId, state, elapsedMs = 0, variant) {
  const board = getRecordBoard(gameId, state, variant);
  if (!board) return null;
  const eligible = board.direction === 'asc' ? state.status === 'won' : ['won', 'lost', 'over'].includes(state.status);
  if (!eligible) return null;
  const value = board.unit === '秒' ? Math.max(1, Math.ceil(elapsedMs / 1000))
    : gameId === 'word' || gameId === 'code' ? state.guesses?.length
      : board.direction === 'asc' ? state.moves : state.score;
  if (!Number.isSafeInteger(value) || value < board.min || value > board.max || (board.step && value % board.step !== 0)) return null;
  return { boardId: board.id, value, outcome: state.status };
}

// Level resets create fresh geometry. Undo retains geometry / the original tubes,
// so returning to zero moves through undo never creates another submission.
export function isFreshRecordState(gameId, previous, state) {
  if (!previous || previous === state) return false;
  if (gameId === 'sokoban') return previous.walls !== state.walls;
  if (gameId === 'water') return previous.level !== state.level || (previous.moves > 0 && state.moves === 0 && state.tubes !== previous.history?.[0]);
  return false;
}
