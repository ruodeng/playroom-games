import { gridButtons, setText } from './arcade-panel.js';
import { createMerge, moveMerge, undoMerge } from './merge.js';
import { createMines, revealMine, flagMine, MINE_COUNT } from './mines.js';
import { createSudoku, writeSudoku, hintSudoku, sudokuConflicts } from './sudoku.js';
import { createMemory, flipMemory, tickMemory, MEMORY_SYMBOLS } from './memory.js';
import { createBreakout, steerBreakout, launchBreakout, stepBreakout } from './breakout.js';
import { createTic, playTic, tickTic } from './tictactoe.js';
import { createLights, toggleLight, solveLights } from './lights.js';
import { createMoles, hitMole, tickMoles } from './moles.js';

function focusCell(cells, index) {
  cells.forEach((cell, i) => { cell.tabIndex = i === index ? 0 : -1; });
  cells[index].focus({ preventScroll: true });
}
function gridKey(panel, cells, columns, key, onSelect) {
  const current = cells.indexOf(document.activeElement);
  const index = Math.max(0, current);
  let next = index;
  if (key === 'arrowleft') next = Math.max(0, index - 1);
  else if (key === 'arrowright') next = Math.min(cells.length - 1, index + 1);
  else if (key === 'arrowup') next = Math.max(0, index - columns);
  else if (key === 'arrowdown') next = Math.min(cells.length - 1, index + columns);
  else if (key === 'home') next = 0;
  else if (key === 'end') next = cells.length - 1;
  else if (current < 0 && ['enter', ' '].includes(key) && document.activeElement === panel.surface) { cells[0].click(); return true; }
  else return false;
  focusCell(cells, next); onSelect?.(next); return true;
}
function prepareCells(cells, callback) {
  cells.forEach((cell, i) => { cell.tabIndex = i === 0 ? 0 : -1; cell.addEventListener('click', () => { focusCell(cells, i); callback(i); }); });
}
const directionKeys = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down' };

export const ARCADE_GAMES = [
  {
    id: 'merge', name: '2048', number: '004', category: '数字益智', filter: 'puzzle', description: '把小小的数字，拼成大大的惊喜。', welcome: '从 2 开始。', hint: '相同数字，碰出新可能。', detail: '4 × 4 · 数字合并', record: true,
    rules: ['方向键、WASD 或在棋盘上滑动，让所有数字向同一方向移动。手机也可以点方向按钮。', '相同数字相遇会合并，每次移动每块最多合并一次。有效移动后会出现一个 2 或 4。', '拼出 2048 后仍可继续挑战。棋盘满且无法合并时结束，可撤回最近一步。'],
    art: '<div class="art-merge"><b>2</b><b>8</b><b>32</b><b>2048</b></div>',
    setup(panel) {
      const board = document.createElement('div'); board.className = 'merge-grid'; board.setAttribute('role', 'img'); panel.surface.append(board);
      const cells = Array.from({ length: 16 }, () => { const tile = document.createElement('span'); board.append(tile); return tile; });
      const move = direction => { if (panel.canPlay()) panel.commit(moveMerge(panel.state, direction)); };
      const arrows = [['←', 'left'], ['↑', 'up'], ['↓', 'down'], ['→', 'right']].map(([label, direction]) => { const button = panel.button(label, () => move(direction), 'merge-direction'); button.setAttribute('aria-label', `向${{ left: '左', up: '上', down: '下', right: '右' }[direction]}移动数字`); return button; });
      const undo = panel.button('撤回一步', () => { if (panel.started && !panel.paused) panel.commit(undoMerge(panel.state)); });
      let touch = null;
      board.addEventListener('pointerdown', event => { if (panel.canPlay()) { touch = { x: event.clientX, y: event.clientY }; board.setPointerCapture(event.pointerId); } });
      board.addEventListener('pointercancel', () => { touch = null; });
      board.addEventListener('pointerup', event => { if (!touch) return; const dx = event.clientX - touch.x, dy = event.clientY - touch.y; touch = null; if (Math.max(Math.abs(dx), Math.abs(dy)) > 18) move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); });
      return {
        create: createMerge,
        stats: game => [['本局得分', game.score], ['最大数字', Math.max(...game.board)], ['移动步数', game.moves]],
        message: game => game.status === 'lost' ? '没有可移动的位置了，再挑战一次吧' : game.reached ? '已拼出 2048！继续创造更大的数字' : '移动数字，向 2048 出发',
        draw(game) {
          cells.forEach((cell, i) => { setText(cell, game.board[i] || ''); cell.dataset.value = game.board[i]; cell.style.setProperty('--tile-level', Math.min(12, Math.log2(game.board[i] || 1))); });
          board.setAttribute('aria-label', `2048 棋盘：${game.board.map(value => value || '空').join('，')}`);
          arrows.forEach(button => { button.disabled = !panel.canPlay(); }); undo.disabled = !panel.started || panel.paused || !game.previous;
        },
        key(key) { if (!directionKeys[key]) return false; move(directionKeys[key]); return true; },
      };
    },
  },
  {
    id: 'mines', name: '扫雷', number: '005', category: '逻辑推理', filter: 'puzzle', description: '每一个数字，都藏着一条线索。', welcome: '小心，也要大胆。', hint: '第一步，放心点。', detail: '9 × 9 · 10 颗雷', intro: '从一片空白开始，用线索排除危险。第一格和周围八格都不会埋雷。',
    rules: ['点格子翻开，数字表示周围八格的地雷数量。第一步及相邻格安全。', '右键插旗，或切换“插旗模式”后点格子。再次操作可取消旗子，最多放 10 面旗。', '已翻开的数字格，周围旗数等于数字时，再点可快速展开其他邻格。旗子标错也可能踩雷。', '翻开全部 71 个安全格即可获胜。方向键选择格子，Enter 翻开，F 插旗。'],
    art: '<div class="art-mines"><b>1</b><b></b><b></b><b>2</b><b>⚑</b><b></b><b>1</b><b>2</b><b>1</b></div>',
    setup(panel) {
      const cells = gridButtons(panel.surface, 81, 'mines-grid'); let flagMode = false;
      const choose = index => { if (panel.canPlay()) panel.commit(flagMode ? flagMine(panel.state, index) : revealMine(panel.state, index)); };
      prepareCells(cells, choose);
      cells.forEach((cell, index) => cell.addEventListener('contextmenu', event => { event.preventDefault(); if (panel.canPlay()) panel.commit(flagMine(panel.state, index)); }));
      const flag = panel.button('⚑ 插旗模式', () => { if (panel.canPlay()) { flagMode = !flagMode; panel.render(); } });
      return {
        create: createMines, reset() { flagMode = false; },
        stats: game => [['剩余旗子', MINE_COUNT - game.flags.filter(Boolean).length], ['已翻安全格', game.revealed.filter((value, i) => value && !game.mines.includes(i)).length], ['目标', '71 格']],
        message: game => game.status === 'won' ? '所有安全格都找到了，排雷成功！' : game.status === 'lost' ? '碰到地雷了，再试一次吧' : flagMode ? '插旗模式：点格子标记或取消' : '翻开模式：点格子寻找线索',
        draw(game) {
          cells.forEach((cell, i) => {
            const exposed = game.revealed[i], mine = exposed && game.mines.includes(i), flagged = game.flags[i];
            setText(cell, mine ? '✹' : flagged ? '⚑' : exposed ? game.counts[i] || '' : '');
            cell.className = `${exposed ? 'revealed' : ''} ${flagged ? 'flagged' : ''} ${i === game.exploded ? 'exploded' : ''}`; cell.dataset.number = exposed ? game.counts[i] : 0;
            cell.setAttribute('aria-label', `第 ${Math.floor(i / 9) + 1} 行第 ${i % 9 + 1} 列，${mine ? '地雷' : flagged ? '已插旗' : exposed ? `周围 ${game.counts[i]} 颗雷` : '未翻开'}`);
            cell.disabled = !panel.canPlay();
          });
          flag.disabled = !panel.canPlay(); flag.setAttribute('aria-pressed', String(flagMode)); flag.classList.toggle('selected', flagMode);
        },
        key(key) {
          if (key === 'f') { const index = cells.indexOf(document.activeElement); if (index >= 0) panel.commit(flagMine(panel.state, index)); return true; }
          return gridKey(panel, cells, 9, key);
        },
      };
    },
  },
  {
    id: 'sudoku', name: '数独', number: '006', category: '数字益智', filter: 'puzzle', description: '九个数字，刚刚好的秩序。', welcome: '让思绪，归位。', hint: '每一局，都只有一个答案。', detail: '9 × 9 · 唯一解', intro: '按自己的节奏找线索。拿不准的数字先记成小笔记，每局还可以使用 3 次提示。',
    rules: ['让每一行、每一列、每个 3×3 宫都包含 1 到 9，且不重复。深色数字是题目，不能修改。', '点空格后选数字，也可直接按键盘 1–9。Backspace / Delete 清除，方向键移动选择。', '“笔记”可记录候选数字，再点同一个数字取消。红色提示当前行、列或宫存在重复。', '每局可用 3 次提示填入所选空格的正确答案。新棋盘会检查唯一解，填完所有空格即通关。'],
    art: '<div class="art-sudoku"><b>1</b><b></b><b>9</b><b></b><b>5</b><b></b><b>7</b><b></b><b>3</b></div>',
    setup(panel) {
      const cells = gridButtons(panel.surface, 81, 'sudoku-grid'); let selected = 0, noteMode = false;
      prepareCells(cells, index => { if (panel.canPlay()) { selected = index; panel.render(); } });
      const enter = value => { if (panel.canPlay()) panel.commit(writeSudoku(panel.state, selected, value, noteMode)); };
      const digits = Array.from({ length: 9 }, (_, index) => panel.button(String(index + 1), () => enter(index + 1), 'sudoku-digit'));
      const erase = panel.button('清除', () => enter(0), 'sudoku-tool');
      const notes = panel.button('笔记', () => { if (panel.canPlay()) { noteMode = !noteMode; panel.render(); } }, 'sudoku-tool');
      const hint = panel.button('提示 · 3', () => { if (panel.canPlay()) panel.commit(hintSudoku(panel.state, selected)); }, 'sudoku-tool');
      return {
        create() { const game = createSudoku(); selected = game.board.findIndex(value => !value); noteMode = false; return game; },
        stats: game => [['待填空格', game.board.filter(value => !value).length], ['操作次数', game.moves], ['剩余提示', game.hints]],
        message: game => game.status === 'won' ? '每个数字都找到了位置，完成！' : sudokuConflicts(game.board).length ? '有数字重复了，检查一下红色格子' : noteMode ? '笔记模式：记录可能的数字' : '选一个空格，再填入数字',
        draw(game) {
          const conflicts = new Set(sudokuConflicts(game.board));
          cells.forEach((cell, i) => {
            const value = game.board[i], peer = Math.floor(i / 9) === Math.floor(selected / 9) || i % 9 === selected % 9 || (Math.floor(i / 27) === Math.floor(selected / 27) && Math.floor(i % 9 / 3) === Math.floor(selected % 9 / 3));
            cell.className = `${game.givens[i] ? 'given' : 'entered'} ${i === selected ? 'selected' : peer ? 'peer' : ''} ${conflicts.has(i) ? 'conflict' : ''}`;
            cell.style.borderRightWidth = i % 9 === 2 || i % 9 === 5 ? '2px' : '';
            cell.style.borderBottomWidth = Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5 ? '2px' : '';
            const html = value ? String(value) : game.notes[i] ? `<span class="sudoku-notes">${Array.from({ length: 9 }, (_, k) => `<i>${game.notes[i] & (1 << (k + 1)) ? k + 1 : ''}</i>`).join('')}</span>` : '';
            if (cell.innerHTML !== html) cell.innerHTML = html;
            cell.setAttribute('aria-label', `第 ${Math.floor(i / 9) + 1} 行第 ${i % 9 + 1} 列，${value || '空白'}${game.givens[i] ? '，题目数字' : ''}`);
            cell.setAttribute('aria-pressed', String(i === selected)); cell.disabled = !panel.canPlay(); cell.tabIndex = i === selected ? 0 : -1;
          });
          [...digits, erase, notes].forEach(button => { button.disabled = !panel.canPlay() || game.givens[selected]; });
          notes.setAttribute('aria-pressed', String(noteMode)); notes.classList.toggle('selected', noteMode);
          hint.disabled = !panel.canPlay() || !game.hints || game.givens[selected] || game.board[selected] === game.solution[selected]; setText(hint, `提示 · ${game.hints}`);
        },
        key(key) {
          if (/^[1-9]$/.test(key)) { enter(Number(key)); return true; }
          if (['0', 'backspace', 'delete'].includes(key)) { enter(0); return true; }
          if (key === 'n') { noteMode = !noteMode; panel.render(); return true; }
          return gridKey(panel, cells, 9, key, index => { selected = index; panel.render(); });
        },
      };
    },
  },
  {
    id: 'memory', name: '记忆翻牌', number: '007', category: '记忆挑战', filter: 'puzzle', description: '那些一闪而过的，你还记得吗？', welcome: '翻开一点惊喜。', hint: '少一点尝试，多一点记忆。', detail: '16 张 · 8 对图案', intro: '每次翻两张，记住图案的位置。用尽量少的步数，找齐八对好朋友。',
    rules: ['点两张卡片，相同图案会保持翻开，不同图案会在片刻后盖回去。', '一对卡片算一次尝试。全部 8 对配对完成即获胜，没有时间限制。', '方向键选择卡片，Enter 或空格翻开。切换页面时，未配对的卡片也会暂停等待。'],
    art: '<div class="art-memory"><b>✦</b><b>?</b><b>?</b><b>✦</b></div>',
    setup(panel) {
      const cells = gridButtons(panel.surface, 16, 'memory-grid');
      prepareCells(cells, index => { if (panel.canPlay()) panel.commit(flipMemory(panel.state, index)); });
      return {
        create: createMemory, interval: 80, tick: tickMemory,
        stats: game => [['已配对', `${game.matched.length / 2} / 8`], ['尝试次数', game.moves], ['剩余卡片', 16 - game.matched.length]],
        message: game => game.status === 'won' ? `全部配对完成！用了 ${game.moves} 次尝试` : game.wait ? '记住这两个位置，马上盖回去' : '翻开两张，找一找相同的图案',
        draw(game) {
          cells.forEach((cell, i) => {
            const matched = game.matched.includes(i), open = matched || game.open.includes(i);
            setText(cell, open ? MEMORY_SYMBOLS[game.deck[i]] : '?');
            cell.className = `${open ? 'face-up' : ''} ${matched ? 'matched' : ''}`;
            cell.setAttribute('aria-label', `第 ${i + 1} 张，${matched ? '已配对' : open ? '已翻开' : '未翻开'}${open ? `，${MEMORY_SYMBOLS[game.deck[i]]}` : ''}`);
            cell.setAttribute('aria-disabled', String(!panel.canPlay() || !!game.wait || open));
            cell.disabled = !panel.started || panel.paused;
          });
        },
        key: key => gridKey(panel, cells, 4, key),
      };
    },
  },
  {
    id: 'breakout', name: '打砖块', number: '008', category: '敏捷街机', filter: 'arcade', description: '接住每一次弹跳，清空小小烦恼。', welcome: '快乐，弹起来。', hint: '看准落点，再接一次。', detail: '30 块砖 · 3 次机会', record: true,
    rules: ['左右方向键 / A、D 移动挡板，也可以用鼠标或在场地内拖动手指。', '空格或“发球”让小球出发。击碎一块砖得 10 分，清空全部 30 块获胜。', '从挡板两侧接球可改变反弹角度。小球落到底部会失去一次机会，共有 3 次机会。', 'P / Esc 暂停或继续，离开页面也会自动暂停。'],
    art: '<div class="art-breakout"><div>' + '<i></i>'.repeat(18) + '</div><b></b><span></span></div>',
    setup(panel) {
      panel.surface.innerHTML = `<svg class="breakout-field" viewBox="0 0 400 500" role="img" aria-label="打砖块场地"><defs><pattern id="breakout-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#ccd6be"/></pattern></defs><rect width="400" height="500" fill="url(#breakout-dots)"/><g class="breakout-bricks">${Array.from({ length: 30 }, (_, i) => `<rect width="55" height="19" rx="4" class="brick-row-${Math.floor(i / 6)}"/>`).join('')}</g><rect class="breakout-paddle" y="470" width="76" height="12" rx="6"/><circle class="breakout-ball" r="6"/><text class="breakout-serve-note" x="200" y="310" text-anchor="middle">准备好了，就发球</text></svg>`;
      const field = panel.surface.querySelector('svg'), bricks = [...field.querySelectorAll('.breakout-bricks rect')], paddle = field.querySelector('.breakout-paddle'), ball = field.querySelector('.breakout-ball'), note = field.querySelector('.breakout-serve-note');
      const launch = () => { if (panel.canPlay()) panel.commit(launchBreakout(panel.state)); };
      const left = panel.button('← 左移', () => { if (panel.canPlay()) panel.commit(steerBreakout(panel.state, panel.state.paddle - 2)); });
      const serve = panel.button('发球', launch);
      const right = panel.button('右移 →', () => { if (panel.canPlay()) panel.commit(steerBreakout(panel.state, panel.state.paddle + 78)); });
      for (const [button, key] of [[left, 'arrowleft'], [right, 'arrowright']]) {
        button.addEventListener('pointerdown', event => { if (panel.canPlay()) { panel.keys.add(key); button.setPointerCapture(event.pointerId); } });
        for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(eventName, () => panel.keys.delete(key));
      }
      const aim = event => { if (!panel.canPlay()) return; const rect = field.getBoundingClientRect(); panel.commit(steerBreakout(panel.state, (event.clientX - rect.left) * 400 / rect.width)); };
      field.addEventListener('pointerdown', event => { if (panel.canPlay()) { field.setPointerCapture(event.pointerId); aim(event); } });
      field.addEventListener('pointermove', event => { if (event.pointerType === 'mouse' || field.hasPointerCapture(event.pointerId)) aim(event); });
      return {
        create: createBreakout,
        tick: (game, ms) => stepBreakout(game, ms, Number(panel.keys.has('arrowright') || panel.keys.has('d')) - Number(panel.keys.has('arrowleft') || panel.keys.has('a'))),
        stats: game => [['本局得分', game.score], ['剩余机会', game.lives], ['剩余砖块', game.bricks.filter(brick => brick.alive).length]],
        message: game => game.status === 'won' ? '砖块全部清空，完美通关！' : game.status === 'lost' ? `机会用完了，本局 ${game.score} 分` : game.flying ? '移动挡板，接住下一次弹跳' : '点发球或按空格，继续出发',
        draw(game) {
          bricks.forEach((element, i) => { const brick = game.bricks[i]; element.setAttribute('x', brick.x); element.setAttribute('y', brick.y); element.style.display = brick.alive ? '' : 'none'; });
          paddle.setAttribute('x', game.paddle); ball.setAttribute('cx', game.ball.x); ball.setAttribute('cy', game.ball.y);
          note.style.display = game.flying || game.status !== 'playing' ? 'none' : '';
          field.setAttribute('aria-label', `打砖块，得分 ${game.score}，剩余 ${game.lives} 次机会`);
          left.disabled = right.disabled = !panel.canPlay(); serve.disabled = !panel.canPlay() || game.flying;
        },
        key(key, event) {
          if (key === ' ') { if (!event.repeat) launch(); return true; }
          if (['arrowleft', 'arrowright', 'a', 'd'].includes(key)) {
            panel.keys.add(key);
            if (!event.repeat) panel.commit(steerBreakout(panel.state, panel.state.paddle + 38 + (key === 'arrowleft' || key === 'a' ? -16 : 16)));
            return true;
          }
          return false;
        },
      };
    },
  },
  {
    id: 'tictactoe', name: '井字棋', number: '009', category: '策略对弈', filter: 'strategy', description: '小小九宫格，也有大大的心思。', welcome: '三子连线，试试？', hint: '先占中心，还是先占角落？', detail: '3 × 3 · 人机对战', intro: '你执 X 先手，电脑执 O。棋盘很小，思考的空间却不小；平局也是一场漂亮的防守。',
    rules: ['你使用 X，电脑使用 O。点击空格落子，双方轮流行动。', '横、竖或斜线上率先连成三个相同符号获胜。九格填满仍无人获胜则平局。', '电脑会认真攻防，试着守住一场平局。方向键选择格子，Enter 或空格落子。'],
    art: '<div class="art-tic"><b>×</b><b></b><b>○</b><b></b><b>×</b><b></b><b>○</b><b></b><b>×</b></div>',
    setup(panel) {
      const cells = gridButtons(panel.surface, 9, 'tic-grid');
      prepareCells(cells, index => { if (panel.canPlay()) panel.commit(playTic(panel.state, index)); });
      return {
        create: createTic, tick: tickTic, interval: 80,
        stats: game => [['你的棋子', '×'], ['电脑棋子', '○'], ['已下步数', game.board.filter(Boolean).length]],
        message: game => game.status === 'won' ? '三子连线，你赢了！' : game.status === 'lost' ? '电脑连成了三子，再来一局吧' : game.status === 'draw' ? '势均力敌，这是一场平局' : game.turn === 'O' ? '电脑正在思考…' : '轮到你了，选一个空格',
        draw(game) {
          cells.forEach((cell, i) => {
            setText(cell, game.board[i] === 'X' ? '×' : game.board[i] === 'O' ? '○' : '');
            cell.className = `${game.board[i] === 'O' ? 'tic-computer' : ''} ${game.line.includes(i) ? 'tic-winning' : ''}`;
            cell.setAttribute('aria-label', `第 ${Math.floor(i / 3) + 1} 行第 ${i % 3 + 1} 列，${game.board[i] || '空格'}`);
            cell.setAttribute('aria-disabled', String(!panel.canPlay() || game.turn !== 'X' || !!game.board[i])); cell.disabled = !panel.started || panel.paused;
          });
        },
        key: key => gridKey(panel, cells, 3, key),
      };
    },
  },
  {
    id: 'lights', name: '点灯', number: '010', category: '逻辑解谜', filter: 'puzzle', description: '一盏灯的变化，藏着整个棋盘的答案。', welcome: '让灯光，歇一歇。', hint: '关掉全部灯，就算成功。', detail: '5 × 5 · 联动解谜', intro: '每次点击都会改变一小片灯光。棋盘保证可解；卡住时，让提示给你指个方向。',
    rules: ['点击一盏灯，它自己与上下左右相邻的灯会同时切换亮灭。边缘不会连接到另一边。', '目标是把全部 25 盏灯关闭。每一局都从可解的状态生成，没有时间限制。', '“提示一步”会标出一个可行的下一步。方向键选择灯，Enter 或空格切换。'],
    art: '<div class="art-lights"><i></i><i class="on"></i><i></i><i class="on"></i><i class="on"></i><i class="on"></i><i></i><i class="on"></i><i></i></div>',
    setup(panel) {
      const cells = gridButtons(panel.surface, 25, 'lights-grid'); let suggested = -1;
      prepareCells(cells, index => { if (panel.canPlay()) { suggested = -1; panel.commit(toggleLight(panel.state, index)); } });
      const hint = panel.button('提示一步', () => { if (panel.canPlay()) { suggested = solveLights(panel.state.board)?.[0] ?? -1; panel.render(); } });
      return {
        create: createLights, reset() { suggested = -1; },
        stats: game => [['还亮着', game.board.filter(Boolean).length], ['点击次数', game.moves], ['目标', '0 盏']],
        message: game => game.status === 'won' ? `灯光都休息了！用了 ${game.moves} 步` : suggested >= 0 ? `试试第 ${Math.floor(suggested / 5) + 1} 行第 ${suggested % 5 + 1} 列的灯` : '点击一盏灯，同时改变相邻的灯',
        draw(game) {
          cells.forEach((cell, i) => { cell.className = `${game.board[i] ? 'light-on' : ''} ${i === suggested ? 'light-hint' : ''}`; cell.setAttribute('aria-label', `第 ${Math.floor(i / 5) + 1} 行第 ${i % 5 + 1} 列，${game.board[i] ? '亮' : '灭'}${suggested === i ? '，建议点击' : ''}`); cell.setAttribute('aria-pressed', String(game.board[i])); cell.disabled = !panel.canPlay(); });
          hint.disabled = !panel.canPlay();
        },
        key: key => gridKey(panel, cells, 5, key),
      };
    },
  },
  {
    id: 'moles', name: '打地鼠', number: '011', category: '反应挑战', filter: 'arcade', description: '快乐冒出头，就轻轻点一下。', welcome: '眼疾，手也快。', hint: '打中 +10，点空 −5。', detail: '30 秒 · 反应挑战', record: true,
    rules: ['地鼠会轮流从九个洞里探头。点中地鼠加 10 分，点空扣 5 分，最低为 0 分。', '每只地鼠只能命中一次。击中越多，地鼠停留的时间越短，30 秒后结算。', '可以直接点洞，也可以按主键盘 1–9，按从左到右、从上到下对应。P / Esc 暂停。'],
    art: '<div class="art-moles"><i></i><i><b></b></i><i></i></div>',
    setup(panel) {
      const cells = gridButtons(panel.surface, 9, 'moles-grid');
      cells.forEach((cell, i) => { cell.innerHTML = `<span class="mole-hole"><span class="mole-body"><i></i><i></i><b></b></span></span><small>${i + 1}</small>`; });
      prepareCells(cells, index => { if (panel.canPlay()) panel.commit(hitMole(panel.state, index)); });
      return {
        create: createMoles, tick: tickMoles, interval: 40,
        stats: game => [['剩余时间', `${Math.ceil(game.remaining / 1000)} 秒`], ['本局得分', game.score], ['击中次数', game.hits]],
        message: game => game.status === 'won' ? `时间到！击中 ${game.hits} 次，获得 ${game.score} 分` : '盯住九个小洞，点中冒头的地鼠',
        draw(game) { cells.forEach((cell, i) => { cell.classList.toggle('mole-up', i === game.target); cell.setAttribute('aria-label', `${i + 1} 号洞，${game.target === i ? '地鼠出现了' : '空洞'}`); cell.disabled = !panel.canPlay(); }); },
        key(key, event) { if (/^[1-9]$/.test(key)) { if (!event.repeat) panel.commit(hitMole(panel.state, Number(key) - 1)); return true; } return gridKey(panel, cells, 3, key); },
      };
    },
  },
];
