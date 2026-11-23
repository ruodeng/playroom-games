import { gridButtons, setText } from './arcade-panel.js';
import { createLinkup, chooseLinkup, hintLinkup, shuffleLinkup, LINKUP_SYMBOLS } from './linkup.js';
import { createMatch, chooseMatch, hintMatch, MATCH_GOAL, MATCH_SYMBOLS } from './match.js';
import { createSokoban, moveSokoban, undoSokoban, resetSokoban, nextSokoban, SOKOBAN_LEVELS } from './sokoban.js';
import { createSliding, moveSliding, undoSliding, slidingNeighbors } from './sliding.js';
import { createWater, chooseWater, undoWater, resetWater, nextWater, WATER_LEVELS, WATER_LABELS } from './water.js';

const directions = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down' };
function cellControls(panel, cells, columns, select) {
  let focused = 0;
  const focus = index => {
    focused = index; cells.forEach((cell, i) => { cell.tabIndex = i === index ? 0 : -1; });
    cells[index].focus({ preventScroll: true });
  };
  cells.forEach((cell, i) => {
    cell.tabIndex = i ? -1 : 0;
    cell.addEventListener('click', () => { if (panel.canPlay()) { focus(i); select(i); } });
    cell.addEventListener('focus', () => { focused = i; });
  });
  return key => {
    if (['enter', ' '].includes(key) && document.activeElement === panel.surface) { focus(focused); select(focused); return true; }
    const index = cells.indexOf(document.activeElement), current = index < 0 ? focused : index;
    let target = current;
    if (key === 'arrowleft') target = Math.max(0, current - 1);
    else if (key === 'arrowright') target = Math.min(cells.length - 1, current + 1);
    else if (key === 'arrowup') target = Math.max(0, current - columns);
    else if (key === 'arrowdown') target = Math.min(cells.length - 1, current + columns);
    else if (key === 'home') target = 0;
    else if (key === 'end') target = cells.length - 1;
    else return false;
    focus(target); return true;
  };
}
function art(kind, values) { return `<div class="puzzle-art puzzle-art-${kind}">${values.map(value => `<b>${value}</b>`).join('')}</div>`; }
function levelTools(panel, undo, reset, next, count) {
  const undoButton = panel.button('撤回一步 · Z', () => { if (panel.canPlay()) panel.commit(undo(panel.state)); });
  const resetButton = panel.button('重置本关', () => { if (panel.canPlay()) panel.commit(reset(panel.state)); });
  const nextButton = panel.button('下一关 →', () => {
    if (panel.active && panel.started && !panel.paused && panel.state.status === 'won') { panel.commit(next(panel.state)); panel.surface.focus({ preventScroll: true }); }
  });
  return game => {
    undoButton.disabled = !panel.canPlay() || !game.history.length; resetButton.disabled = !panel.canPlay();
    nextButton.disabled = !panel.active || !panel.started || panel.paused || game.status !== 'won' || game.level >= count - 1;
    setText(nextButton, game.level >= count - 1 ? '最后一关' : '下一关 →');
  };
}

export const PUZZLE_GAMES = [
  {
    id: 'linkup', name: '连连看', number: '013', icon: '◇', category: '图案益智', filter: 'puzzle', description: '绕一个弯，把相同的小美好连起来。', welcome: '好事，成双。', hint: '两次转弯以内，就能相遇。', detail: '48 块 · 24 对图案', intro: '不赶时间，慢慢找齐二十四对。没有可消除的图案时会自动重排，也可以随时查看提示。',
    rules: ['依次点两个相同图案。连线只能横竖走，最多转弯两次，途中不能穿过其他图案。', '路线可以经过棋盘外侧。清空全部 24 对即通关，没有时间限制。', '“找一对”标出可消除的一对，“重新排列”保留剩余图案并打乱。无路可走时会自动重排。', '方向键选择图案，Enter / 空格确认；H 找一对。'],
    art: art('linkup', ['叶', '月', '花', '月', '叶', '花']),
    setup(panel) {
      const cells = gridButtons(panel.surface, 48, 'puzzle-linkup-grid');
      const select = index => panel.commit(chooseLinkup(panel.state, index));
      const key = cellControls(panel, cells, 8, select);
      const hint = panel.button('找一对 · H', () => { if (panel.canPlay()) panel.commit(hintLinkup(panel.state)); });
      const shuffle = panel.button('重新排列', () => { if (panel.canPlay()) panel.commit(shuffleLinkup(panel.state)); });
      return {
        create: createLinkup,
        stats: game => [['剩余图案', game.board.filter(Boolean).length], ['已配对', `${game.moves} / 24`], ['重排次数', game.shuffles]],
        message: game => game.status === 'won' ? '二十四对全部相遇，完成！' : game.notice || '选两个相同的图案，试着连起来',
        draw(game) {
          cells.forEach((cell, i) => {
            const value = game.board[i]; setText(cell, LINKUP_SYMBOLS[value]);
            cell.className = `puzzle-color-${value} ${!value ? 'puzzle-empty' : ''} ${game.selected === i ? 'puzzle-selected' : ''} ${game.hint.includes(i) ? 'puzzle-hint' : ''}`;
            cell.disabled = !panel.canPlay(); cell.setAttribute('aria-pressed', String(game.selected === i));
            cell.setAttribute('aria-label', `第 ${Math.floor(i / 8) + 1} 行第 ${i % 8 + 1} 列，${value ? LINKUP_SYMBOLS[value] : '已消除'}${game.hint.includes(i) ? '，提示配对' : ''}`);
          });
          hint.disabled = shuffle.disabled = !panel.canPlay();
        },
        key(value) { if (value === 'h') { panel.commit(hintLinkup(panel.state)); return true; } return key(value); },
      };
    },
  },
  {
    id: 'match', name: '宝石消消乐', number: '014', icon: '◆', category: '消除益智', filter: 'puzzle', description: '交换一点灵感，收获一串闪亮。', welcome: '让快乐，连成串。', hint: '三颗相连，闪亮消除。', detail: '7 × 7 · 25 步挑战', record: true,
    rules: ['先点一颗宝石，再点它上下左右相邻的宝石进行交换。横向或纵向至少三颗相同图案即可消除。', '只有形成消除的交换才扣一步；无效交换会自动换回。宝石落下后可继续形成连锁，每颗得 10 分。', `25 步内达到 ${MATCH_GOAL} 分即获胜。初始棋盘没有三连且一定有可行交换；后续没有可行交换会自动重排。`, '每种宝石都有独立图案。方向键选格，Enter / 空格确认，H 查看交换提示。'],
    art: art('match', ['◆', '●', '▲', '●', '●', '✦']),
    setup(panel) {
      const cells = gridButtons(panel.surface, 49, 'puzzle-match-grid');
      const key = cellControls(panel, cells, 7, index => panel.commit(chooseMatch(panel.state, index)));
      const hint = panel.button('交换提示 · H', () => { if (panel.canPlay()) panel.commit(hintMatch(panel.state)); });
      return {
        create: createMatch,
        stats: game => [['本局得分', game.score], ['剩余步数', game.moves], ['目标分数', MATCH_GOAL]],
        message: game => game.status === 'won' ? `闪亮达标！收获 ${game.score} 分` : game.status === 'lost' ? `步数用完了，本局 ${game.score} 分，再试一次吧` : game.notice || '交换相邻的两颗，连成三颗相同图案',
        draw(game) {
          cells.forEach((cell, i) => {
            setText(cell, MATCH_SYMBOLS[game.board[i]]);
            cell.className = `puzzle-color-${game.board[i]} ${game.selected === i ? 'puzzle-selected' : ''} ${game.hint.includes(i) ? 'puzzle-hint' : ''}`;
            cell.disabled = !panel.canPlay(); cell.setAttribute('aria-pressed', String(game.selected === i));
            cell.setAttribute('aria-label', `第 ${Math.floor(i / 7) + 1} 行第 ${i % 7 + 1} 列，${MATCH_SYMBOLS[game.board[i]]} 宝石${game.hint.includes(i) ? '，交换提示' : ''}`);
          }); hint.disabled = !panel.canPlay();
        },
        key(value) { if (value === 'h') { panel.commit(hintMatch(panel.state)); return true; } return key(value); },
      };
    },
  },
  {
    id: 'sokoban', name: '推箱子', number: '015', icon: '▣', category: '空间益智', filter: 'puzzle', description: '一步一步，把小箱子送回家。', welcome: '先想一步，再推一步。', hint: '箱子能推，不能拉。', detail: '3 关 · 支持撤回', intro: '圆点是箱子的家。留好转身的空间，别把箱子推进角落。每一步都可以撤回，卡住也能只重置当前关。',
    rules: ['用方向键 / WASD 或方向按钮走动，也可点人物相邻的地板。碰到箱子时会把它向前推一格。', '一次只能推一个箱子，不能拉箱子、穿墙或推动连在一起的两个箱子。把全部箱子推到圆点目标上即过关。', 'Z /“撤回一步”恢复上一步；“重置本关”保留当前关卡。通关后点“下一关”继续，共 3 个关卡。'],
    art: art('sokoban', ['·', '□', '·', '□', '●', '□']),
    setup(panel) {
      const board = document.createElement('div'); board.className = 'puzzle-sokoban-grid'; panel.surface.append(board);
      let cells = [], currentLevel = -1;
      const move = direction => { if (panel.canPlay()) panel.commit(moveSokoban(panel.state, direction)); };
      const arrows = [['←', 'left', '向左'], ['↑', 'up', '向上'], ['↓', 'down', '向下'], ['→', 'right', '向右']].map(([text, direction, label]) => { const button = panel.button(text, () => move(direction), 'puzzle-direction'); button.setAttribute('aria-label', label); return button; });
      const tools = levelTools(panel, undoSokoban, resetSokoban, nextSokoban, SOKOBAN_LEVELS.length);
      return {
        create: createSokoban,
        stats: game => [['当前关卡', `${game.level + 1} / 3`], ['行走步数', game.moves], ['推动次数', game.pushes]],
        message: game => game.status === 'won' ? game.level === 2 ? '三个小仓库都整理好了，全部通关！' : '全部箱子已归位，下一关见！' : '把标着“箱”的方块推到圆点上',
        draw(game) {
          if (currentLevel !== game.level) {
            board.replaceChildren(); cells = gridButtons(board, game.width * game.height, 'puzzle-sokoban-cells'); currentLevel = game.level;
            cells[0].parentElement.style.gridTemplateColumns = `repeat(${game.width}, minmax(0, 1fr))`;
            cells.forEach((cell, i) => cell.addEventListener('click', () => {
              const state = panel.state, delta = i - state.player;
              if (delta === -1 && i % state.width !== state.width - 1) move('left');
              if (delta === 1 && i % state.width !== 0) move('right');
              if (delta === -state.width) move('up'); if (delta === state.width) move('down');
            }));
          }
          cells.forEach((cell, i) => {
            const wall = game.walls.includes(i), goal = game.goals.includes(i), box = game.boxes.includes(i), player = game.player === i;
            cell.className = `${wall ? 'puzzle-wall' : ''} ${goal ? 'puzzle-goal' : ''} ${box ? 'puzzle-box' : ''} ${player ? 'puzzle-player' : ''}`;
            setText(cell, wall ? '' : player ? '人' : box ? '箱' : goal ? '·' : '');
            cell.disabled = !panel.canPlay() || wall; cell.tabIndex = !wall && i === game.player ? 0 : -1;
            cell.setAttribute('aria-label', `第 ${Math.floor(i / game.width) + 1} 行第 ${i % game.width + 1} 列，${wall ? '墙壁' : `${player ? '人物' : box ? '箱子' : '地板'}${goal ? '，目标点' : ''}`}`);
          }); arrows.forEach(button => { button.disabled = !panel.canPlay(); }); tools(game);
        },
        key(value) { if (value === 'z') { panel.commit(undoSokoban(panel.state)); return true; } if (directions[value]) { move(directions[value]); return true; } return false; },
      };
    },
  },
  {
    id: 'sliding', name: '数字华容道', number: '016', icon: '15', category: '数字益智', filter: 'puzzle', description: '让十五个数字，回到刚好的位置。', welcome: '慢慢来，顺起来。', hint: '从左到右，从上到下。', detail: '4 × 4 · 十五数码', intro: '打乱来自真实的合法移动，所以每一局都有答案。先排好第一行，再逐层推进，空格最终留在右下角。',
    rules: ['点击空格相邻的数字，把它滑进空格。只能上下左右移动一格，不能跨格或斜走。', '把 1–15 按从左到右、从上到下排好，空格位于右下角，即获胜。', '方向键 / WASD 移动空格，手机可点数字或方向按钮。Z /“撤回一步”可以恢复上一步。每一局都由合法移动打乱，保证可解。'],
    art: art('sliding', ['1', '2', '3', '4', '5', '']),
    setup(panel) {
      const cells = gridButtons(panel.surface, 16, 'puzzle-sliding-grid');
      cells.forEach((cell, i) => cell.addEventListener('click', () => { if (panel.canPlay()) panel.commit(moveSliding(panel.state, i)); }));
      const move = direction => {
        if (!panel.canPlay()) return;
        const empty = panel.state.board.indexOf(0), delta = { left: -1, right: 1, up: -4, down: 4 }[direction], index = empty + delta;
        if (slidingNeighbors(empty).includes(index)) panel.commit(moveSliding(panel.state, index));
      };
      const arrows = [['←', 'left'], ['↑', 'up'], ['↓', 'down'], ['→', 'right']].map(([label, direction]) => { const button = panel.button(label, () => move(direction), 'puzzle-direction'); button.setAttribute('aria-label', `空格向${{ left: '左', right: '右', up: '上', down: '下' }[direction]}移动`); return button; });
      const undo = panel.button('撤回一步 · Z', () => { if (panel.canPlay()) panel.commit(undoSliding(panel.state)); });
      return {
        create: createSliding,
        stats: game => [['移动步数', game.moves], ['已归位', `${game.board.filter((value, i) => value && value === i + 1).length} / 15`], ['棋盘大小', '4 × 4']],
        message: game => game.status === 'won' ? `十五个数字归位了，用了 ${game.moves} 步！` : '点空格旁的数字，或用方向键移动空格',
        draw(game) {
          const empty = game.board.indexOf(0), neighbors = slidingNeighbors(empty);
          cells.forEach((cell, i) => {
            const value = game.board[i]; setText(cell, value || '');
            cell.className = `${!value ? 'puzzle-empty' : ''} ${value === i + 1 ? 'puzzle-in-place' : ''} ${neighbors.includes(i) ? 'puzzle-movable' : ''}`;
            cell.disabled = !panel.canPlay(); cell.setAttribute('aria-disabled', String(!panel.canPlay() || !neighbors.includes(i)));
            cell.setAttribute('aria-label', `第 ${Math.floor(i / 4) + 1} 行第 ${i % 4 + 1} 列，${value || '空格'}${neighbors.includes(i) ? '，可滑动' : ''}`);
          }); arrows.forEach(button => { button.disabled = !panel.canPlay(); }); undo.disabled = !panel.canPlay() || !game.history.length;
        },
        key(value) { if (value === 'z') { panel.commit(undoSliding(panel.state)); return true; } if (directions[value]) { move(directions[value]); return true; } return false; },
      };
    },
  },
  {
    id: 'water', name: '水排序', number: '017', icon: '▥', category: '色彩益智', filter: 'puzzle', description: '给纷杂的颜色，一点清澈的秩序。', welcome: '让每种颜色，住一瓶。', hint: '同色相接，一瓶一色。', detail: '4 关 · 支持撤回', intro: '青、桃、金、紫，每一格都有文字标记。善用空瓶作为中转，把每种颜色整理到自己的瓶子里。',
    rules: ['先点来源瓶，再点目标瓶。只能往空瓶或顶层同色且未满的瓶子里倒水。每瓶容量 4 格。', '一次会倒出顶部连续同色的一段，直到这段倒完或目标瓶满。每格标有颜色名称，瓶内从下向上堆叠。', '所有非空瓶都满 4 格且各自只有一种颜色，即过关。共 4 关，通关后点“下一关”。', '方向键选瓶，Enter / 空格确认。Z /“撤回一步”恢复上一步；“重置本关”重新整理当前关。'],
    art: '<div class="puzzle-art-water"><b><i>青</i><i>桃</i><i>青</i></b><b><i>桃</i><i>青</i><i>桃</i></b><b></b></div>',
    setup(panel) {
      const board = document.createElement('div'); board.className = 'puzzle-water-grid'; panel.surface.append(board);
      let cells = [], currentLevel = -1, cellKey = () => false;
      const tools = levelTools(panel, undoWater, resetWater, nextWater, WATER_LEVELS.length);
      return {
        create: createWater,
        stats: game => [['当前关卡', `${game.level + 1} / 4`], ['倒水次数', game.moves], ['已整理', game.tubes.filter(tube => tube.length === 4 && tube.every(color => color === tube[0])).length]],
        message: game => game.status === 'won' ? game.level === 3 ? '每种颜色都有了自己的家，四关完成！' : '一瓶一色，整理完成！可以进入下一关' : game.notice || '先选来源瓶，再选一瓶同色或空瓶',
        draw(game) {
          if (currentLevel !== game.level) {
            board.replaceChildren(); cells = gridButtons(board, game.tubes.length, 'puzzle-water-bottles');
            currentLevel = game.level; cellKey = cellControls(panel, cells, 4, index => panel.commit(chooseWater(panel.state, index)));
          }
          cells.forEach((cell, i) => {
            const tube = game.tubes[i]; cell.className = `puzzle-bottle ${game.selected === i ? 'puzzle-selected' : ''} ${tube.length === 4 && tube.every(color => color === tube[0]) ? 'puzzle-sorted' : ''}`;
            const content = `<span class="puzzle-bottle-number">${i + 1}</span><span class="puzzle-water-glass">${Array.from({ length: 4 }, (_, row) => { const color = tube[3 - row] || 0; return `<span class="puzzle-water-layer puzzle-color-${color}">${WATER_LABELS[color]}</span>`; }).join('')}</span>`;
            if (cell.innerHTML !== content) cell.innerHTML = content;
            cell.disabled = !panel.canPlay(); cell.setAttribute('aria-pressed', String(game.selected === i));
            cell.setAttribute('aria-label', `第 ${i + 1} 瓶，${tube.length ? `从底到顶：${tube.map(color => WATER_LABELS[color]).join('、')}` : '空瓶'}${game.selected === i ? '，已选为来源瓶' : ''}`);
          }); tools(game);
        },
        key(value) { if (value === 'z') { panel.commit(undoWater(panel.state)); return true; } return cellKey(value); },
      };
    },
  },
];
