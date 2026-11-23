import { gridButtons, setText } from './arcade-panel.js';
import { createConnect, moveConnect, tickConnect, connectLanding } from './connect.js';
import { createReversi, moveReversi, tickReversi, reversiMoves, reversiScore } from './reversi.js';
import { createBattle, shootBattle, tickBattle, sunkShips } from './battleship.js';
import { createDots, moveDots, tickDots, dotsScore } from './dots.js';
import { createHanoi, moveHanoi, undoHanoi } from './hanoi.js';

function focusCell(cells, index) {
  cells.forEach((cell, i) => { cell.tabIndex = i === index ? 0 : -1; });
  cells[index].focus({ preventScroll: true });
}
function prepare(cells, callback) {
  cells.forEach((cell, i) => { cell.tabIndex = i ? -1 : 0; cell.addEventListener('click', () => { focusCell(cells, i); callback(i); }); });
}
function gridKey(panel, cells, columns, key) {
  const current = cells.indexOf(document.activeElement), i = Math.max(0, current);
  const next = { arrowleft: Math.max(0, i - 1), arrowright: Math.min(cells.length - 1, i + 1), arrowup: Math.max(0, i - columns), arrowdown: Math.min(cells.length - 1, i + columns), home: 0, end: cells.length - 1 }[key];
  if (next !== undefined) { focusCell(cells, next); return true; }
  if (current < 0 && document.activeElement === panel.surface && ['enter', ' '].includes(key)) { cells[0].focus(); cells[0].click(); return true; }
  return false;
}
const resultMessage = (game, won, lost, playing) => game.status === 'won' ? won : game.status === 'lost' ? lost : game.status === 'draw' ? '势均力敌，这一局平手！' : playing;
const coordinate = (index, columns) => `第 ${Math.floor(index / columns) + 1} 行第 ${index % columns + 1} 列`;
function stateName(player) { return player === 1 ? '你的棋子' : player === 2 ? '电脑的棋子' : '空格'; }

export const BOARD_GAMES = [
  {
    id: 'connect', name: '四子棋', number: '023', icon: '●', category: '策略对弈', filter: 'strategy',
    description: '让四枚棋子，连成一条小小的胜利。', welcome: '下一颗，落在哪里？', hint: '横、竖、斜，连成四颗。', detail: '7 × 6 · 人机对战', intro: '你执青绿色棋子先手，电脑执陶棕色。棋子总会落到这一列最低的空位，仔细看看下一步的机会。',
    rules: ['点击棋盘上方的列按钮投下一枚棋子；棋子会落到该列最下方的空格。你先手，电脑随后行动。', '任意横、竖或斜线率先连成四颗即获胜。42 格填满仍无连线则平局，满列不能继续投子。', '左右方向键选择列，Enter 或空格投子；也可按数字 1–7。P / Esc 暂停。电脑会进攻、挡住连线，并考虑几步之后。'],
    art: `<div class="bp-art-connect">${Array.from({ length: 20 }, (_, i) => `<i class="${[11, 12, 13, 14].includes(i) ? 'human' : [16, 17, 19, 8].includes(i) ? 'ai' : ''}"></i>`).join('')}</div>`,
    setup(panel) {
      const columns = gridButtons(panel.surface, 7, 'bp-connect-columns');
      columns.forEach((button, i) => setText(button, `↓ ${i + 1}`));
      const board = document.createElement('div'); board.className = 'bp-connect-board'; board.setAttribute('role', 'img'); panel.surface.append(board);
      const cells = Array.from({ length: 42 }, () => { const cell = document.createElement('span'); board.append(cell); return cell; });
      const play = column => { if (panel.canPlay()) panel.commit(moveConnect(panel.state, column)); };
      prepare(columns, play);
      return {
        create: createConnect, tick: tickConnect, interval: 80,
        stats: game => [['你的棋子', '青绿'], ['轮到', game.status !== 'playing' ? '已结束' : game.turn === 1 ? '你落子' : '电脑'], ['已落棋子', `${game.moves} / 42`]],
        message: game => resultMessage(game, '四子连线，你赢了！', '电脑连成四子，再试一局吧', game.turn === 2 ? '电脑正在思考…' : '选一列投子，留意斜线的机会'),
        draw(game) {
          cells.forEach((cell, i) => { cell.className = `${game.board[i] === 1 ? 'bp-human' : game.board[i] === 2 ? 'bp-ai' : ''} ${game.line.includes(i) ? 'bp-winning' : ''}`; });
          board.setAttribute('aria-label', `四子棋棋盘，已落 ${game.moves} 子。${game.board.map((player, i) => player ? `${coordinate(i, 7)}${stateName(player)}` : '').filter(Boolean).join('，')}`);
          columns.forEach((button, i) => { const full = connectLanding(game.board, i) < 0; button.disabled = !panel.started || panel.paused; button.setAttribute('aria-disabled', String(!panel.canPlay() || game.turn !== 1 || full)); button.setAttribute('aria-label', `第 ${i + 1} 列${full ? '已满' : '，投下一子'}`); });
        },
        key(key, event) { if (/^[1-7]$/.test(key)) { if (!event.repeat) play(Number(key) - 1); return true; } return gridKey(panel, columns, 7, key); },
      };
    },
  },
  {
    id: 'reversi', name: '黑白棋', number: '024', icon: '◐', category: '策略对弈', filter: 'strategy',
    description: '一子落下，让棋盘悄悄翻转。', welcome: '从四颗棋子开始。', hint: '夹住对方，翻成自己的颜色。', detail: '8 × 8 · 人机对战', intro: '你执黑先手，电脑执白。浅色圆点会标出可以落子的位置。角落很珍贵，暂时落后也可能反败为胜。',
    rules: ['点击带圆点的空格落黑子。新棋子必须与已有黑子夹住一条连续白子，横、竖、斜八个方向夹住的白子都会翻黑。电脑执白。', '没有合法落点的一方会自动跳过；双方都不能落子时结算，即使棋盘尚未填满。你的黑子更多即获胜，数量相同则平局。', '方向键选择格子，Enter 或空格落子。P / Esc 暂停。圆环标记上一手位置。'],
    art: `<div class="bp-art-reversi">${Array.from({ length: 16 }, (_, i) => `<i class="${[5, 10].includes(i) ? 'black' : [6, 9].includes(i) ? 'white' : ''}"></i>`).join('')}</div>`,
    setup(panel) {
      const cells = gridButtons(panel.surface, 64, 'bp-reversi-board'); prepare(cells, index => { if (panel.canPlay()) panel.commit(moveReversi(panel.state, index)); });
      return {
        create: createReversi, tick: tickReversi, interval: 80,
        stats: game => { const [human, ai] = reversiScore(game.board); return [['你的黑子', human], ['电脑白子', ai], ['可落位置', game.status === 'playing' ? reversiMoves(game.board, game.turn).length : 0]]; },
        message: game => resultMessage(game, '黑子更多，你赢了！', '白子更多，电脑赢了这一局', `${game.passed ? `${game.passed === 1 ? '你' : '电脑'}无合法落点，自动跳过。` : ''}${game.turn === 2 ? '电脑正在思考…' : '轮到你了，点圆点处落黑子'}`),
        draw(game) {
          const legal = reversiMoves(game.board, 1);
          cells.forEach((cell, i) => { cell.className = `${game.board[i] === 1 ? 'bp-black' : game.board[i] === 2 ? 'bp-white' : ''} ${game.turn === 1 && game.status === 'playing' && legal.includes(i) ? 'bp-legal' : ''} ${game.last === i ? 'bp-last' : ''}`; cell.setAttribute('aria-label', `${coordinate(i, 8)}，${game.board[i] === 1 ? '黑子' : game.board[i] === 2 ? '白子' : game.turn === 1 && legal.includes(i) ? '可落黑子' : '空格'}${game.last === i ? '，上一手' : ''}`); cell.setAttribute('aria-disabled', String(!panel.canPlay() || game.turn !== 1 || !legal.includes(i))); cell.disabled = !panel.started || panel.paused; });
        },
        key: key => gridKey(panel, cells, 8, key),
      };
    },
  },
  {
    id: 'battleship', name: '海战', number: '025', icon: '⚓', category: '策略对弈', filter: 'strategy',
    description: '海面很安静，下一炮会在哪里？', welcome: '寻找藏在海里的舰队。', hint: '命中之后，试试相邻海域。', detail: '7 × 7 · 3 艘舰船', intro: '双方各有一艘 3 格舰、两艘 2 格舰。你的舰队显示在下方，对方舰队隐藏在海面之下；开局前可重新布阵。',
    rules: ['开始前可点“重新布阵”随机调整双方舰队。船只沿横向或竖向放置，互不重叠，可以相邻。开始后布局固定。', '点击对方海域发射一炮。× 表示命中，· 表示落空，击沉的船会标记为深色。无论命中与否，每次射击后换人，不可重复射击。', '先击沉对方三艘舰船获胜。下方显示你的船和电脑的攻击。电脑只依据已经观察到的命中、落空和击沉信息选目标。', '方向键在敌方海域移动，Enter 或空格发射。P / Esc 暂停。'],
    art: '<div class="bp-art-battle"><span>·</span><span>×</span><span>·</span><i></i><i></i><i></i><span>·</span><span>×</span><span>·</span></div>',
    setup(panel) {
      const layout = document.createElement('div'); layout.className = 'bp-battle-layout'; panel.surface.append(layout);
      const enemy = document.createElement('section'); enemy.innerHTML = '<h3>对方海域 <small>× 命中 · 落空</small></h3>'; layout.append(enemy);
      const cells = gridButtons(enemy, 49, 'bp-battle-grid'); prepare(cells, index => { if (panel.canPlay()) panel.commit(shootBattle(panel.state, index)); });
      const own = document.createElement('section'); own.innerHTML = '<h3>你的舰队 <small>深绿为船只</small></h3>'; layout.append(own);
      const ownGrid = document.createElement('div'); ownGrid.className = 'bp-battle-grid bp-own-sea'; ownGrid.setAttribute('role', 'img'); own.append(ownGrid);
      const ownCells = Array.from({ length: 49 }, () => { const cell = document.createElement('span'); ownGrid.append(cell); return cell; });
      const shuffle = panel.button('重新布阵', () => { if (!panel.started) panel.commit(createBattle()); });
      return {
        create: createBattle, tick: tickBattle, interval: 80,
        stats: game => [['对方剩余', `${3 - sunkShips(game.enemyFleet, game.ownShots).length} 艘`], ['己方剩余', `${3 - sunkShips(game.ownFleet, game.enemyShots).length} 艘`], ['发射次数', game.ownShots.filter(Boolean).length]],
        message: game => resultMessage(game, '对方舰队全部击沉，你赢了！', '你的舰队全部被击沉，再来一局吧', `${game.lastMessage}。${game.turn === 2 ? '电脑正在瞄准…' : '轮到你发射'}`),
        draw(game) {
          const enemySunk = new Set(sunkShips(game.enemyFleet, game.ownShots).flat()), ownShips = new Set(game.ownFleet.flat());
          cells.forEach((cell, i) => { const shot = game.ownShots[i]; setText(cell, shot === 2 ? '×' : shot === 1 ? '·' : ''); cell.className = `${shot === 2 ? 'bp-hit' : shot === 1 ? 'bp-miss' : ''} ${enemySunk.has(i) ? 'bp-sunk' : ''}`; cell.setAttribute('aria-label', `${String.fromCharCode(65 + Math.floor(i / 7))}${i % 7 + 1}，${enemySunk.has(i) ? '舰船已击沉' : shot === 2 ? '命中' : shot === 1 ? '落空' : '未探索'}`); cell.setAttribute('aria-disabled', String(!panel.canPlay() || game.turn !== 1 || !!shot)); cell.disabled = !panel.started || panel.paused; });
          ownCells.forEach((cell, i) => { const shot = game.enemyShots[i]; setText(cell, shot === 2 ? '×' : shot === 1 ? '·' : ''); cell.className = `${ownShips.has(i) ? 'bp-ship' : ''} ${shot === 2 ? 'bp-hit' : ''}`; });
          ownGrid.setAttribute('aria-label', `你的海域，舰船位于 ${game.ownFleet.map(ship => ship.map(i => `${String.fromCharCode(65 + Math.floor(i / 7))}${i % 7 + 1}`).join('、')).join('；')}。电脑已命中 ${game.enemyShots.filter(x => x === 2).length} 格，落空 ${game.enemyShots.filter(x => x === 1).length} 格。${game.turn === 1 ? game.lastMessage : ''}`);
          shuffle.disabled = panel.started;
        },
        key: key => gridKey(panel, cells, 7, key),
      };
    },
  },
  {
    id: 'dots', name: '点格棋', number: '026', icon: '⌗', category: '策略对弈', filter: 'strategy',
    description: '连起小点，把一方格子留给自己。', welcome: '一条边，也有小心思。', hint: '封住第四条边，就能再走一步。', detail: '4 × 4 点 · 人机对战', intro: '你用青绿连线，电脑用陶棕连线。九个小格子等待归属；留下第三条边时，要想想谁会合上最后一条。',
    rules: ['点两个相邻圆点之间的横边或竖边画线。你先手，与电脑轮流画一条尚未画过的边。', '画出格子的第四条边就拥有该格，得 1 分，并且必须继续落一条边。一次可同时完成两个格子，电脑得分后也会连续行动。', '24 条边全部画满后，九个格子中占得更多的一方获胜。格子内“你 / 机”标明归属。', '方向键依次选择边，Home / End 到第一 / 最后一条边，Enter 或空格画线。先遍历所有横边，再遍历所有竖边。P / Esc 暂停。'],
    art: '<div class="bp-art-dots"><span>● ━ ● ━ ●</span><span>┃ 你 ┃　 ┃</span><span>● ━ ● ━ ●</span><span>┃　 ┃ 机 ┃</span><span>● ━ ● ━ ●</span></div>',
    setup(panel) {
      const board = document.createElement('div'); board.className = 'bp-dots-board'; panel.surface.append(board);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const dot = document.createElement('span'); dot.className = 'bp-dot'; dot.style.gridArea = `${r * 2 + 1} / ${c * 2 + 1}`; dot.setAttribute('aria-hidden', 'true'); board.append(dot); }
      const boxes = Array.from({ length: 9 }, (_, i) => { const box = document.createElement('span'); box.className = 'bp-box'; box.style.gridArea = `${Math.floor(i / 3) * 2 + 2} / ${i % 3 * 2 + 2}`; board.append(box); return box; });
      const cells = Array.from({ length: 24 }, (_, i) => {
        const cell = document.createElement('button'); cell.type = 'button'; cell.className = 'bp-edge';
        const horizontal = i < 12, n = horizontal ? i : i - 12;
        cell.style.gridArea = horizontal ? `${Math.floor(n / 3) * 2 + 1} / ${n % 3 * 2 + 2}` : `${Math.floor(n / 4) * 2 + 2} / ${n % 4 * 2 + 1}`;
        cell.dataset.direction = horizontal ? 'horizontal' : 'vertical'; cell.dataset.label = `${horizontal ? '横边' : '竖边'}，${coordinate(n, horizontal ? 3 : 4)}`;
        board.append(cell); return cell;
      });
      prepare(cells, i => { if (panel.canPlay()) panel.commit(moveDots(panel.state, i)); });
      return {
        create: createDots, tick: tickDots, interval: 80,
        stats: game => { const [human, ai] = dotsScore(game); return [['你的格子', human], ['电脑格子', ai], ['剩余边线', game.edges.filter(x => !x).length]]; },
        message: game => resultMessage(game, '你占了更多格子，获胜！', '电脑占了更多格子，再试一局吧', game.turn === 2 ? '电脑正在画线，得分后会继续…' : '轮到你了；封住一个格子后可以继续画线'),
        draw(game) {
          cells.forEach((cell, i) => { cell.className = `bp-edge ${game.edges[i] === 1 ? 'bp-human' : game.edges[i] === 2 ? 'bp-ai' : ''} ${game.last === i ? 'bp-last' : ''}`; cell.setAttribute('aria-label', `${cell.dataset.label}，${game.edges[i] ? stateName(game.edges[i]) : '未画线'}`); cell.setAttribute('aria-disabled', String(!panel.canPlay() || game.turn !== 1 || !!game.edges[i])); cell.disabled = !panel.started || panel.paused; });
          boxes.forEach((box, i) => { setText(box, game.boxes[i] === 1 ? '你' : game.boxes[i] === 2 ? '机' : ''); box.className = `bp-box ${game.boxes[i] === 1 ? 'bp-human' : game.boxes[i] === 2 ? 'bp-ai' : ''}`; box.setAttribute('aria-label', `第 ${i + 1} 格，${game.boxes[i] === 1 ? '属于你' : game.boxes[i] === 2 ? '属于电脑' : '未完成'}`); });
        },
        key: key => gridKey(panel, cells, 1, key),
      };
    },
  },
  {
    id: 'hanoi', name: '汉诺塔', number: '027', icon: '△', category: '逻辑解谜', filter: 'puzzle',
    description: '一次挪一片，把小山搬到另一边。', welcome: '慢慢搬，也是一种快乐。', hint: '大盘永远不能压住小盘。', detail: '4–6 层 · 可撤回', intro: '把左边的圆盘全部搬到最右边。中间的柱子可以借用，没有时间限制；每一步都可以撤回。开局前可选择层数。',
    rules: ['先点一根柱子选中最上面的盘，再点目标柱子移动。只能移动顶盘，大盘不能放在小盘上。再次点选中的柱子可取消选择。', '把全部圆盘从左柱搬到最右柱即获胜。4 / 5 / 6 层的理论最少步数分别是 15 / 31 / 63 步。开局前可切换层数。', '按数字 1、2、3 选择起点和终点，或左右方向键选择柱子后按 Enter / 空格。点“撤回一步”可回到上一手，包括完成之后。P / Esc 暂停。'],
    art: '<div class="bp-art-hanoi"><i></i><i></i><i></i><div><b></b><b></b><b></b><b></b></div></div>',
    setup(panel) {
      let disks = 4, selected = -1, notice = '';
      const cells = gridButtons(panel.surface, 3, 'bp-hanoi-board');
      const choose = index => {
        if (!panel.canPlay()) return;
        const game = panel.state;
        if (selected < 0) { if (!game.towers[index].length) notice = '这根柱子没有圆盘，请选有盘的柱子'; else { selected = index; notice = '已选中顶盘，请选择目标柱子'; } panel.render(); return; }
        if (index === selected) { selected = -1; notice = ''; panel.render(); return; }
        const next = moveHanoi(game, selected, index);
        if (next === game) { notice = '大盘不能放在小盘上，请换一根目标柱'; panel.render(); return; }
        selected = -1; notice = ''; panel.commit(next);
      };
      prepare(cells, choose);
      const levels = [4, 5, 6].map(count => panel.button(`${count} 层`, () => { if (!panel.started) { disks = count; selected = -1; notice = ''; panel.commit(createHanoi(disks)); } }));
      const undo = panel.button('撤回一步', () => { if (panel.started && !panel.paused) { selected = -1; notice = ''; panel.commit(undoHanoi(panel.state)); } });
      return {
        create: () => createHanoi(disks), reset() { selected = -1; notice = ''; },
        stats: game => [['已走步数', game.moves], ['最少步数', 2 ** game.disks - 1], ['右柱圆盘', `${game.towers[2].length} / ${game.disks}`]],
        message: game => game.status === 'won' ? `全部搬好了！共 ${game.moves} 步${game.moves === 2 ** game.disks - 1 ? '，达到最少步数！' : ''}` : notice || '选一根柱子的顶盘，再选择目标柱子',
        draw(game) {
          cells.forEach((cell, i) => { cell.className = selected === i ? 'bp-selected' : ''; cell.innerHTML = `<span class="bp-hanoi-rod" aria-hidden="true"></span><span class="bp-hanoi-stack" aria-hidden="true">${[...game.towers[i]].reverse().map(disk => `<span style="--disk-width:${28 + disk / game.disks * 66}%;--disk-color:${88 + disk * 3}"></span>`).join('')}</span><span class="bp-hanoi-label">${i + 1} · ${['起点', '借用', '终点'][i]}</span>`; cell.setAttribute('aria-label', `第 ${i + 1} 根柱，${game.towers[i].length ? `从底到顶：${game.towers[i].join('、')}；顶盘 ${game.towers[i].at(-1)}` : '空柱'}${selected === i ? '，已选中顶盘' : ''}`); cell.setAttribute('aria-pressed', String(selected === i)); cell.disabled = !panel.canPlay(); });
          levels.forEach((button, i) => { button.disabled = panel.started; button.classList.toggle('selected', game.disks === i + 4); button.setAttribute('aria-pressed', String(game.disks === i + 4)); });
          undo.disabled = !panel.started || panel.paused || !game.history.length;
        },
        key(key, event) { if (/^[1-3]$/.test(key)) { if (!event.repeat) choose(Number(key) - 1); return true; } return gridKey(panel, cells, 3, key); },
      };
    },
  },
];
