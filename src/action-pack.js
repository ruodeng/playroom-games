import { aimBubbles, bubblePosition, createBubbles, fireBubbles, stepBubbles, BUBBLE_ORIGIN, BUBBLE_LIMIT } from './bubbles.js';
import { createFlappy, flapFlappy, stepFlappy, FLAPPY_GROUND, FLAPPY_PIPE, FLAPPY_GOAL } from './flappy.js';
import { createPong, steerPong, servePong, stepPong, PONG_PADDLE, PONG_TARGET } from './pong.js';
import { createInvaders, steerInvaders, fireInvaders, stepInvaders, INVADERS_WAVES } from './invaders.js';
import { createMaze, turnMaze, stepMaze, MAZE_MAP, MAZE_COLS } from './maze.js';

const ink = '#35472c', paper = '#fffefa', sage = '#8fac72', lime = '#c4f169', line = '#d8e2cb';
const bubbleColors = ['#aac38f', '#c89479', '#d4ba83', '#91b4b0'];
const directionKeys = { arrowleft: 'left', a: 'left', arrowup: 'up', w: 'up', arrowright: 'right', d: 'right', arrowdown: 'down', s: 'down' };

function field(panel, width, height, name) {
  panel.root.classList.add('action-game');
  panel.surface.style.setProperty('--action-width', `${width}px`);
  panel.surface.style.setProperty('--action-ratio', width / height);
  const canvas = document.createElement('canvas');
  canvas.className = 'action-canvas'; canvas.width = width * 2; canvas.height = height * 2;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', name);
  canvas.textContent = `${name}。游戏进度显示在下方状态栏，可用方向键和操作按钮游玩。`;
  panel.surface.append(canvas);
  const context = canvas.getContext('2d'); context.scale(2, 2);
  return { canvas, context, point(event) { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * width / rect.width, y: (event.clientY - rect.top) * height / rect.height }; } };
}
function background(context, width, height) {
  context.clearRect(0, 0, width, height); context.fillStyle = '#f0f4e7'; context.fillRect(0, 0, width, height);
}
function circle(context, x, y, radius, fill) {
  context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fillStyle = fill; context.fill();
}
function text(context, value, x, y, size = 12, color = '#62794f', align = 'center') {
  context.fillStyle = color; context.font = `500 ${size}px "Segoe UI", "Microsoft YaHei", sans-serif`; context.textAlign = align; context.textBaseline = 'middle'; context.fillText(value, x, y);
}
function roundRect(context, x, y, width, height, radius, fill) {
  context.beginPath(); context.roundRect(x, y, width, height, radius); context.fillStyle = fill; context.fill();
}
function hold(button, panel, key) {
  button.addEventListener('pointerdown', event => { if (panel.canPlay()) { panel.keys.add(key); button.setPointerCapture(event.pointerId); } });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, () => panel.keys.delete(key));
}
function axis(panel, negative, positive) {
  return Number(positive.some(key => panel.keys.has(key))) - Number(negative.some(key => panel.keys.has(key)));
}
function controlsEnabled(panel, buttons) { buttons.forEach(button => { button.disabled = !panel.canPlay(); }); }
function label(canvas, value) { if (canvas.getAttribute('aria-label') !== value) canvas.setAttribute('aria-label', value); }
function bubble(context, x, y, color, radius = 18) {
  circle(context, x, y, radius - 1, bubbleColors[color]);
  context.strokeStyle = '#536745'; context.lineWidth = 1.2; context.stroke();
  circle(context, x - radius * .3, y - radius * .32, radius * .15, '#fffefa99');
  context.strokeStyle = ink; context.lineWidth = 2; context.beginPath();
  if (color === 0) { context.arc(x, y + 1, radius * .24, 0, Math.PI * 2); }
  if (color === 1) { const d = radius * .32; context.moveTo(x, y - d); context.lineTo(x + d, y); context.lineTo(x, y + d); context.lineTo(x - d, y); context.closePath(); }
  if (color === 2) { const d = radius * .3; context.moveTo(x - d, y); context.lineTo(x + d, y); context.moveTo(x, y - d); context.lineTo(x, y + d); }
  if (color === 3) { const d = radius * .3; for (const offset of [-3, 3]) { context.moveTo(x - d, y + offset); context.lineTo(x + d, y + offset); } }
  context.stroke();
}
function bird(context, x, y, rotation = 0) {
  context.save(); context.translate(x, y); context.rotate(rotation);
  context.fillStyle = '#b7d778'; context.beginPath(); context.ellipse(0, 0, 15, 12, 0, 0, Math.PI * 2); context.fill();
  context.strokeStyle = ink; context.lineWidth = 1.4; context.stroke();
  context.fillStyle = '#d1b17b'; context.beginPath(); context.moveTo(12, -1); context.lineTo(22, 3); context.lineTo(12, 6); context.closePath(); context.fill();
  context.fillStyle = '#8ba95c'; context.beginPath(); context.ellipse(-6, 4, 7, 5, -.3, 0, Math.PI * 2); context.fill();
  circle(context, 6, -4, 4, paper); circle(context, 7, -4, 1.6, ink); context.restore();
}
function hunter(context, x, y, color, mark, vulnerable = false) {
  context.fillStyle = vulnerable ? '#d4ba83' : color;
  context.beginPath(); context.arc(x, y - 1, 9, Math.PI, 0); context.lineTo(x + 9, y + 8);
  context.lineTo(x + 4.5, y + 5); context.lineTo(x, y + 8); context.lineTo(x - 4.5, y + 5); context.lineTo(x - 9, y + 8); context.closePath(); context.fill();
  circle(context, x - 3.5, y - 2, 2.7, paper); circle(context, x + 3.5, y - 2, 2.7, paper);
  circle(context, x - 3, y - 2, 1.2, ink); circle(context, x + 4, y - 2, 1.2, ink);
  text(context, vulnerable ? '−' : mark, x, y + 5, 8, ink);
}

export const ACTION_GAMES = [
  {
    id: 'bubbles', name: '泡泡龙', number: '018', icon: '◉', category: '消除益智', filter: 'puzzle', description: '瞄准相同的图案，让小泡泡一起轻盈落下。', welcome: '快乐，连成一串。', hint: '同色三连消除，悬空泡泡会掉落。', detail: '反弹瞄准 · 连锁消除', record: true,
    rules: ['移动鼠标瞄准，点击发射；触屏按住场地瞄准，松开发射。也可以用左右键 / A、D 调整，空格发射。', '连上至少 3 个同色同图案的泡泡即可消除，每个得 10 分。与顶部断开的泡泡会掉落，每个再得 20 分。', '左右墙壁可以反弹。连续 5 次未消除，顶部会下降一格；泡泡触及虚线则结束。清空所有泡泡即获胜。', '下方可看下一颗泡泡。游戏只会提供场上仍有的颜色；P / Esc 暂停。'],
    art: '<div class="action-art action-art-bubbles"><span>○</span><span>＋</span><span>◇</span><span>○</span><span>○</span><span>＝</span><i></i><b>○</b></div>',
    setup(panel) {
      const { canvas, context: ctx, point } = field(panel, 360, 450, '泡泡龙场地');
      const aim = angle => { if (panel.canPlay()) panel.commit(aimBubbles(panel.state, angle)); };
      const fire = () => { if (panel.canPlay()) panel.commit(fireBubbles(panel.state)); };
      const left = panel.button('← 瞄准', () => aim(panel.state.angle - .1));
      const shoot = panel.button('发射', fire, 'action-primary');
      const right = panel.button('瞄准 →', () => aim(panel.state.angle + .1));
      hold(left, panel, 'aim-left'); hold(right, panel, 'aim-right');
      const aimPointer = event => { const position = point(event); if (position.y < BUBBLE_ORIGIN.y - 8) aim(Math.atan2(position.y - BUBBLE_ORIGIN.y, position.x - BUBBLE_ORIGIN.x)); };
      canvas.addEventListener('pointerdown', event => { if (panel.canPlay()) { canvas.setPointerCapture(event.pointerId); aimPointer(event); } });
      canvas.addEventListener('pointermove', event => { if (event.pointerType === 'mouse' || canvas.hasPointerCapture(event.pointerId)) aimPointer(event); });
      canvas.addEventListener('pointerup', event => { if (canvas.hasPointerCapture(event.pointerId)) { aimPointer(event); fire(); canvas.releasePointerCapture(event.pointerId); } });
      return {
        create: createBubbles,
        stats: game => [['本局得分', game.score], ['剩余泡泡', game.board.length], ['下降倒计', `${5 - game.misses} 次`]],
        message: game => game.status === 'won' ? `泡泡全部清空！获得 ${game.score} 分` : game.status === 'lost' ? `泡泡碰到警戒线了，本局 ${game.score} 分` : game.shot ? '泡泡出发了，看看能连起多少颗' : game.lastPop ? `消除 ${game.lastPop} 颗${game.lastDrop ? `，另掉落 ${game.lastDrop} 颗` : ''}，继续瞄准吧` : '瞄准同色同图案的泡泡，松手或点发射',
        tick(game, ms) {
          const direction = axis(panel, ['arrowleft', 'a', 'aim-left'], ['arrowright', 'd', 'aim-right']);
          return stepBubbles(direction ? aimBubbles(game, game.angle + direction * Math.min(ms, 80) * .0016) : game, ms);
        },
        draw(game) {
          background(ctx, 360, 450);
          ctx.fillStyle = '#dce5cf'; ctx.fillRect(0, 0, 360, game.ceiling + 4);
          ctx.setLineDash([5, 6]); ctx.strokeStyle = '#b38d71'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(8, BUBBLE_LIMIT); ctx.lineTo(352, BUBBLE_LIMIT); ctx.stroke(); ctx.setLineDash([]);
          text(ctx, '警戒线', 38, BUBBLE_LIMIT + 13, 10, '#8e715c');
          if (!game.shot && game.status === 'playing') {
            ctx.strokeStyle = '#7a975e'; ctx.lineWidth = 2; ctx.setLineDash([3, 6]); ctx.beginPath(); ctx.moveTo(180, 418);
            let x = 180, y = 418, vx = Math.cos(game.angle), vy = Math.sin(game.angle);
            for (let step = 0; step < 32; step++) { x += vx * 6; y += vy * 6; if (x < 18 || x > 342) { vx *= -1; x = Math.max(18, Math.min(342, x)); } ctx.lineTo(x, y); }
            ctx.stroke(); ctx.setLineDash([]);
          }
          for (const item of game.board) { const pos = bubblePosition(item, game.ceiling); bubble(ctx, pos.x, pos.y, item.color); }
          roundRect(ctx, 146, 424, 68, 13, 6, '#8da573');
          if (!game.shot) bubble(ctx, 180, 418, game.current);
          else bubble(ctx, game.shot.x, game.shot.y, game.shot.color);
          text(ctx, '下一颗', 310, 390, 11); bubble(ctx, 310, 418, game.next, 14);
          label(canvas, `泡泡龙：剩余 ${game.board.length} 颗，得分 ${game.score}，连续 ${5 - game.misses} 次未消除后下降。`);
          controlsEnabled(panel, [left, right]); shoot.disabled = !panel.canPlay() || !!game.shot;
        },
        key(key, event) { if (key === ' ') { if (!event.repeat) fire(); return true; } if (['arrowleft', 'arrowright', 'a', 'd'].includes(key)) { panel.keys.add(key); return true; } return false; },
      };
    },
  },
  {
    id: 'flappy', name: '飞跃小鸟', number: '019', icon: '⌁', category: '轻盈街机', filter: 'arcade', description: '轻轻振翅，在一上一下间找到自己的节奏。', welcome: '再轻轻，飞一下。', hint: '短促点按，保持飞行节奏。', detail: '穿过 20 道 · 节奏挑战', record: true,
    rules: ['点场地或“振翅”，也可按空格、↑ 或 W，让小鸟向上飞一下；不操作时会自然下落。', '从上下管道中间的缺口穿过，整只小鸟通过后得 1 分。碰到管道、地面或顶部则结束。', '连续通过 20 道管道即可完成挑战。第一下振翅后才开始移动，P / Esc 可随时暂停。'],
    art: '<div class="action-art action-art-flappy"><i></i><b><span></span></b><i></i><em>· · ·</em></div>',
    setup(panel) {
      const { canvas, context: ctx } = field(panel, 360, 450, '飞跃小鸟场地');
      const flap = () => { if (panel.canPlay()) panel.commit(flapFlappy(panel.state)); };
      const button = panel.button('振翅 · 轻点一下', flap, 'action-primary action-flap');
      canvas.addEventListener('pointerdown', flap);
      return {
        create: createFlappy, tick: stepFlappy,
        stats: game => [['已过管道', game.score], ['通关目标', FLAPPY_GOAL], ['飞行进度', `${game.score * 5}%`]],
        message: game => game.status === 'lost' ? `飞过 ${game.score} 道管道，再找找节奏吧` : game.status === 'won' ? '20 道管道全部飞过，轻盈通关！' : game.flying ? '点一下抬高，松开自然下落' : '点场地、振翅按钮或空格，开始飞行',
        draw(game) {
          background(ctx, 360, 450);
          for (let i = 0; i < 4; i++) { const x = ((i * 120 - game.distance * .2) % 480 + 480) % 480 - 60; circle(ctx, x, 74 + i % 2 * 43, 20, '#e3ebd7'); circle(ctx, x + 23, 80 + i % 2 * 43, 26, '#e3ebd7'); }
          for (const item of game.pipes) {
            const top = item.gapY - FLAPPY_PIPE.gap / 2, bottom = item.gapY + FLAPPY_PIPE.gap / 2;
            roundRect(ctx, item.x, -10, FLAPPY_PIPE.width, top + 10, 6, '#91ac74');
            roundRect(ctx, item.x, bottom, FLAPPY_PIPE.width, FLAPPY_GROUND - bottom + 8, 6, '#91ac74');
            roundRect(ctx, item.x - 3, top - 14, FLAPPY_PIPE.width + 6, 14, 3, '#718d56');
            roundRect(ctx, item.x - 3, bottom, FLAPPY_PIPE.width + 6, 14, 3, '#718d56');
            ctx.fillStyle = '#b2c994'; ctx.fillRect(item.x + 8, 0, 5, Math.max(0, top - 18)); ctx.fillRect(item.x + 8, bottom + 18, 5, Math.max(0, FLAPPY_GROUND - bottom - 18));
          }
          ctx.fillStyle = '#dde5c7'; ctx.fillRect(0, FLAPPY_GROUND, 360, 28); ctx.fillStyle = '#a3b57d'; ctx.fillRect(0, FLAPPY_GROUND, 360, 4);
          for (let x = -30; x < 390; x += 24) { ctx.fillStyle = '#b9c99b'; ctx.fillRect(x - game.distance % 24, 434, 12, 2); }
          bird(ctx, game.bird.x, game.bird.y, Math.max(-.45, Math.min(.85, game.bird.vy / 470)));
          if (!game.flying && game.status === 'playing') text(ctx, '轻点一下，开始飞行', 180, 300, 15);
          label(canvas, `飞跃小鸟：已通过 ${game.score} 道管道，目标 20 道。点场地振翅。`); controlsEnabled(panel, [button]);
        },
        key(key, event) { if ([' ', 'arrowup', 'w'].includes(key)) { if (!event.repeat) flap(); return true; } return false; },
      };
    },
  },
  {
    id: 'pong', name: '乒乓球', number: '020', icon: '↔', category: '双拍对决', filter: 'arcade', description: '一来一回，把每一个好球接住。', welcome: '好球，再来一拍。', hint: '用球拍边缘，打出更刁钻的角度。', detail: '人机对战 · 先得 7 分', record: true,
    rules: ['你控制左侧球拍。用 ↑↓ / W、S 移动，也可以在场地内上下拖动，或按住下方按钮。', '空格或“发球”开始每一球。球拍边缘的反弹角度更大；球越过对方底线得 1 分。', '电脑球拍有速度限制。先得 7 分获胜，每得 1 分计 100 分。P / Esc 暂停。'],
    art: '<div class="action-art action-art-pong"><i></i><b></b><span></span><i></i></div>',
    setup(panel) {
      const { canvas, context: ctx, point } = field(panel, 400, 320, '乒乓球场地，你控制左侧球拍');
      const steer = y => { if (panel.canPlay()) panel.commit(steerPong(panel.state, y)); };
      const serve = () => { if (panel.canPlay()) panel.commit(servePong(panel.state)); };
      const up = panel.button('↑ 上移', () => steer(panel.state.player + PONG_PADDLE / 2 - 22));
      const launch = panel.button('发球', serve, 'action-primary');
      const down = panel.button('↓ 下移', () => steer(panel.state.player + PONG_PADDLE / 2 + 22));
      hold(up, panel, 'pong-up'); hold(down, panel, 'pong-down');
      const drag = event => steer(point(event).y);
      canvas.addEventListener('pointerdown', event => { if (panel.canPlay()) { canvas.setPointerCapture(event.pointerId); drag(event); } });
      canvas.addEventListener('pointermove', event => { if (event.pointerType === 'mouse' || canvas.hasPointerCapture(event.pointerId)) drag(event); });
      return {
        create: createPong,
        tick: (game, ms) => stepPong(game, ms, axis(panel, ['arrowup', 'w', 'pong-up'], ['arrowdown', 's', 'pong-down'])),
        stats: game => [['你的比分', game.playerScore], ['电脑比分', game.computerScore], ['目标比分', PONG_TARGET]],
        message: game => game.status === 'won' ? `${game.playerScore} : ${game.computerScore}，你赢下了这一场！` : game.status === 'lost' ? `${game.playerScore} : ${game.computerScore}，再挑战电脑一次吧` : game.serving ? '准备好了，点发球开始下一球' : `正在对打 · 本球已接 ${game.rally} 拍`,
        draw(game) {
          background(ctx, 400, 320);
          ctx.strokeStyle = '#d2dfc2'; ctx.lineWidth = 2; ctx.setLineDash([6, 9]); ctx.beginPath(); ctx.moveTo(200, 10); ctx.lineTo(200, 310); ctx.stroke(); ctx.setLineDash([]);
          ctx.strokeStyle = line; ctx.strokeRect(8, 8, 384, 304); circle(ctx, 200, 160, 33, '#e7eedc');
          text(ctx, '你', 40, 24, 11); text(ctx, '电脑', 357, 24, 11);
          roundRect(ctx, 18, game.player, 10, PONG_PADDLE, 5, '#66864c'); roundRect(ctx, 372, game.computer, 10, PONG_PADDLE, 5, '#a98d66');
          circle(ctx, game.ball.x, game.ball.y, 6, ink);
          if (game.serving && game.status === 'playing') text(ctx, '点发球，下一球见', 200, 218, 14);
          label(canvas, `乒乓球：你 ${game.playerScore} 分，电脑 ${game.computerScore} 分。拖动场地控制左侧球拍。`);
          controlsEnabled(panel, [up, down]); launch.disabled = !panel.canPlay() || !game.serving;
        },
        key(key, event) { if (key === ' ') { if (!event.repeat) serve(); return true; } if (['arrowup', 'arrowdown', 'w', 's'].includes(key)) { panel.keys.add(key); return true; } return false; },
      };
    },
  },
  {
    id: 'invaders', name: '太空射击', number: '021', icon: '⌃', category: '星际街机', filter: 'arcade', description: '守住这片小宇宙，把星光留给自己。', welcome: '小小飞船，出发。', hint: '躲开下落弹幕，清空三波来客。', detail: '3 波敌人 · 3 点护盾', record: true,
    rules: ['用左右键 / A、D 移动飞船，空格射击。也可以在场地内左右拖动，或按住下方的移动与开火按钮。', '每波 21 个敌人，命中上、中、下排分别得 30、20、10 分。清空一波加 100 分，共 3 波。', '敌人会往返移动、逐渐下降并发射弹幕。你有 3 点护盾，被击中后有短暂保护；护盾耗尽或敌人到达底线则失败。', '清空 3 波即获胜。P / Esc 暂停，暂停时弹幕和波次等待都会停止。'],
    art: '<div class="action-art action-art-invaders"><div><i></i><i></i><i></i><i></i><i></i><i></i></div><span></span><b></b></div>',
    setup(panel) {
      const { canvas, context: ctx, point } = field(panel, 360, 450, '太空射击场地');
      const steer = x => { if (panel.canPlay()) panel.commit(steerInvaders(panel.state, x)); };
      const fire = () => { if (panel.canPlay()) panel.commit(fireInvaders(panel.state)); };
      const left = panel.button('← 左移', () => steer(panel.state.player - 20));
      const shoot = panel.button('开火 · 按住连发', fire, 'action-primary');
      const right = panel.button('右移 →', () => steer(panel.state.player + 20));
      hold(left, panel, 'ship-left'); hold(shoot, panel, 'ship-fire'); hold(right, panel, 'ship-right');
      canvas.addEventListener('pointerdown', event => { if (panel.canPlay()) { canvas.setPointerCapture(event.pointerId); steer(point(event).x); fire(); } });
      canvas.addEventListener('pointermove', event => { if (canvas.hasPointerCapture(event.pointerId)) steer(point(event).x); });
      return {
        create: createInvaders,
        tick: (game, ms) => stepInvaders(game, ms, { direction: axis(panel, ['arrowleft', 'a', 'ship-left'], ['arrowright', 'd', 'ship-right']), fire: panel.keys.has(' ') || panel.keys.has('ship-fire') }),
        stats: game => [['本局得分', game.score], ['剩余护盾', game.lives], ['当前波次', `${game.wave} / ${INVADERS_WAVES}`]],
        message: game => game.status === 'won' ? `三波敌人全部击退！获得 ${game.score} 分` : game.status === 'lost' ? `防线失守，本局获得 ${game.score} 分` : game.waveDelay ? `第 ${game.wave} 波清空，下一波马上到来` : game.invulnerable ? '保护罩生效中，移动飞船调整位置' : `第 ${game.wave} 波 · 还剩 ${game.enemies.length} 个敌人`,
        draw(game) {
          background(ctx, 360, 450);
          for (let i = 0; i < 34; i++) circle(ctx, (i * 71 + 13) % 360, (i * 103 + 24) % 450, i % 4 ? 1 : 2, '#d5dfc9');
          ctx.setLineDash([4, 6]); ctx.strokeStyle = '#b7c59f'; ctx.beginPath(); ctx.moveTo(8, 394); ctx.lineTo(352, 394); ctx.stroke(); ctx.setLineDash([]);
          for (const enemy of game.enemies) {
            const color = ['#799363', '#a1b983', '#c3bd8c'][enemy.row];
            roundRect(ctx, enemy.x - 12, enemy.y - 8, 24, 15, 4, color);
            ctx.fillStyle = color; ctx.fillRect(enemy.x - 15, enemy.y - 2, 4, 7); ctx.fillRect(enemy.x + 11, enemy.y - 2, 4, 7);
            ctx.fillStyle = ink; ctx.fillRect(enemy.x - 7, enemy.y - 3, 4, 4); ctx.fillRect(enemy.x + 3, enemy.y - 3, 4, 4);
            for (let mark = 0; mark <= enemy.row; mark++) ctx.fillRect(enemy.x - 5 + mark * 5, enemy.y + 6, 2, 4);
          }
          for (const bullet of game.bullets) roundRect(ctx, bullet.x - 2, bullet.y - 5, 4, 10, 2, '#4e7136');
          for (const bullet of game.enemyBullets) { ctx.fillStyle = '#a5765a'; ctx.beginPath(); ctx.moveTo(bullet.x, bullet.y + 6); ctx.lineTo(bullet.x - 4, bullet.y - 4); ctx.lineTo(bullet.x + 4, bullet.y - 4); ctx.closePath(); ctx.fill(); }
          if (game.invulnerable) { circle(ctx, game.player, 416, 22, '#c4f16944'); ctx.strokeStyle = '#8faa5f'; ctx.lineWidth = 1.5; ctx.stroke(); }
          ctx.fillStyle = ink; ctx.beginPath(); ctx.moveTo(game.player, 400); ctx.lineTo(game.player + 14, 427); ctx.lineTo(game.player, 421); ctx.lineTo(game.player - 14, 427); ctx.closePath(); ctx.fill();
          roundRect(ctx, game.player - 3, 410, 6, 9, 3, lime);
          if (game.waveDelay) { roundRect(ctx, 67, 205, 226, 56, 9, '#fffefae8'); text(ctx, `第 ${game.wave} 波完成 · +100`, 180, 233, 16); }
          label(canvas, `太空射击：第 ${game.wave} 波，敌人 ${game.enemies.length} 个，护盾 ${game.lives}，得分 ${game.score}。`);
          controlsEnabled(panel, [left, right]); shoot.disabled = !panel.canPlay() || game.waveDelay > 0;
        },
        key(key, event) { if (key === ' ') { panel.keys.add(key); if (!event.repeat) fire(); return true; } if (['arrowleft', 'arrowright', 'a', 'd'].includes(key)) { panel.keys.add(key); return true; } return false; },
      };
    },
  },
  {
    id: 'maze', name: '迷宫吃豆', number: '022', icon: '◔', category: '迷宫街机', filter: 'arcade', description: '绕一个弯，把沿途的小快乐都收集起来。', welcome: '每个转角，都有惊喜。', hint: '吃到大豆子，就能反过来追逐。', detail: '双影追逐 · 3 次机会', record: true,
    rules: ['方向键 / WASD 或下方按钮选择方向，小圆球会持续前进。可以提前按下下一次转弯方向，到路口会自动转弯；触屏也可以滑动。', '小豆子每颗 10 分，大豆子每颗 50 分，并让追逐者在 6.5 秒内变得脆弱。此时碰到它们再得 100 分。', '平时碰到追逐者会失去一次机会，共有 3 次。受伤后回到起点，选择方向继续，已经吃到的豆子会保留。', '吃完全部豆子即可获胜。开局与受伤后有短暂保护，P / Esc 暂停。'],
    art: '<div class="action-art action-art-maze"><i></i><i></i><i></i><b></b><span>· · ·</span><em></em></div>',
    setup(panel) {
      const { canvas, context: ctx, point } = field(panel, 360, 360, '迷宫吃豆场地');
      const turn = direction => { if (panel.canPlay()) panel.commit(turnMaze(panel.state, direction)); };
      const buttons = [['←', 'left', '左'], ['↑', 'up', '上'], ['↓', 'down', '下'], ['→', 'right', '右']].map(([symbol, direction, name]) => { const button = panel.button(symbol, () => turn(direction), 'action-direction'); button.setAttribute('aria-label', `向${name}移动`); return button; });
      let origin = null;
      canvas.addEventListener('pointerdown', event => { if (panel.canPlay()) { origin = point(event); canvas.setPointerCapture(event.pointerId); } });
      canvas.addEventListener('pointercancel', () => { origin = null; });
      canvas.addEventListener('pointerup', event => {
        if (!origin) return; const end = point(event), dx = end.x - origin.x, dy = end.y - origin.y; origin = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) >= 12) turn(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up');
      });
      return {
        create: createMaze, tick: stepMaze, interval: 30, reset() { origin = null; },
        stats: game => [['本局得分', game.score], ['剩余豆子', game.remaining], ['剩余机会', game.lives]],
        message: game => game.status === 'won' ? `豆子全部收齐！获得 ${game.score} 分` : game.status === 'lost' ? `机会用完了，还剩 ${game.remaining} 颗豆子` : game.ready ? '选一个方向，开始收集豆子' : game.power ? `能量状态 · 还剩 ${Math.ceil(game.power / 1000)} 秒，可以追逐对手` : '提前选好方向，到路口就会转弯',
        draw(game) {
          background(ctx, 360, 360);
          for (let row = 0; row < MAZE_COLS; row++) for (let col = 0; col < MAZE_COLS; col++) {
            const index = row * MAZE_COLS + col, x = col * 24, y = row * 24;
            if (MAZE_MAP[row][col] === '#') { roundRect(ctx, x + 2, y + 2, 20, 20, 4, '#9eB889'); roundRect(ctx, x + 5, y + 5, 14, 4, 2, '#b7cca3'); }
            else if (game.pellets[index]) { circle(ctx, x + 12, y + 12, game.pellets[index] === 2 ? 5.5 : 2.2, game.pellets[index] === 2 ? '#a98056' : '#758660'); if (game.pellets[index] === 2) circle(ctx, x + 12, y + 12, 2, paper); }
          }
          const x = game.player % MAZE_COLS * 24 + 12, y = Math.floor(game.player / MAZE_COLS) * 24 + 12;
          if (game.invulnerable || game.power) { circle(ctx, x, y, 11.3, '#d4e9ac'); ctx.strokeStyle = '#799a47'; ctx.lineWidth = 1.4; ctx.stroke(); }
          const rotation = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[game.direction];
          ctx.fillStyle = '#c2df74'; ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, 9, rotation + .4, rotation + Math.PI * 2 - .4); ctx.closePath(); ctx.fill(); ctx.stroke();
          for (const ghost of game.ghosts) { if (!ghost.wait) hunter(ctx, ghost.position % MAZE_COLS * 24 + 12, Math.floor(ghost.position / MAZE_COLS) * 24 + 12, ghost.id ? '#8da9a2' : '#c1957f', ghost.id ? 'Ⅱ' : 'Ⅰ', game.power > 0); }
          label(canvas, `迷宫吃豆：剩余 ${game.remaining} 颗豆子，${game.lives} 次机会，得分 ${game.score}${game.power ? '，能量状态' : ''}。`); controlsEnabled(panel, buttons);
        },
        key(key) { if (!directionKeys[key]) return false; turn(directionKeys[key]); return true; },
      };
    },
  },
];
