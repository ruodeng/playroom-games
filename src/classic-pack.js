import { setText } from './arcade-panel.js';
import { createSolitaire, drawSolitaire, moveSolitaire, undoSolitaire, canMoveSolitaire, solitaireMoves, solitaireSource, solitaireRank, solitaireRed, SOLITAIRE_SUITS, SOLITAIRE_SUIT_NAMES } from './solitaire.js';
import { createWord, typeWord, submitWord, wordKeyboard, WORD_DICTIONARY } from './word.js';
import { createCode, setCodePeg, submitCode, CODE_COLORS, CODE_ATTEMPTS } from './code.js';
import { createSimon, pressSimon, tickSimon, SIMON_NAMES, SIMON_ROUNDS } from './simon.js';
import { createRunner, jumpRunner, stepRunner, RUNNER_GROUND, RUNNER_X } from './runner.js';

function makeButton(label, className, action) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = className; button.textContent = label;
  if (action) button.addEventListener('click', action);
  return button;
}

function classicPanel(panel) { panel.root.classList.add('classic-view'); }
function sameSource(a, b) { return !!a && !!b && a.pile === b.pile && a.column === b.column && a.index === b.index; }
function cardName(card) { return `${SOLITAIRE_SUIT_NAMES[card.suit]} ${solitaireRank(card.rank)}`; }
function cardFace(card) { return `<span class="sol-corner">${solitaireRank(card.rank)}<em>${SOLITAIRE_SUITS[card.suit]}</em></span><span class="sol-center" aria-hidden="true">${SOLITAIRE_SUITS[card.suit]}</span>`; }
function sourceData(source) { return `data-pile="${source.pile}"${source.column === undefined ? '' : ` data-column="${source.column}"`}${source.index === undefined ? '' : ` data-index="${source.index}"`}`; }

function setupSolitaire(panel) {
  classicPanel(panel);
  const board = document.createElement('div'); board.className = 'sol-board'; panel.surface.append(board);
  let selected = null, note = '', lastState, lastSelection, lastPlayable;
  const clear = () => { selected = null; note = ''; };
  const drawStock = () => { if (panel.canPlay()) { clear(); panel.commit(drawSolitaire(panel.state)); } };
  const undo = panel.button('撤回一步', () => {
    if (panel.started && !panel.paused && !document.querySelector('dialog[open]')) { clear(); panel.commit(undoSolitaire(panel.state)); }
  });
  const cancel = panel.button('取消选择', () => { if (panel.canPlay()) { clear(); panel.render(); } });
  const hint = panel.button('找一步', () => {
    if (!panel.canPlay()) return;
    const moves = solitaireMoves(panel.state);
    const move = moves.find(option => option.destination.pile === 'foundation') || moves.find(option => option.source.pile === 'tableau') || moves[0];
    if (move) {
      selected = move.source;
      note = move.destination.pile === 'foundation' ? `这张牌可以放到 ${SOLITAIRE_SUITS[move.destination.column]} 收牌区。` : `已选好源牌，可以移到第 ${move.destination.column + 1} 列。`;
    } else { clear(); note = panel.state.stock.length ? '当前没有可接的牌。点左上牌库，继续翻牌。' : '当前没有可接的牌。点左上回收，再翻一轮。'; }
    panel.render();
  });
  board.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || !panel.canPlay()) return;
    if (button.dataset.action === 'stock') { drawStock(); return; }
    const source = { pile: button.dataset.pile };
    if (button.dataset.column !== undefined) source.column = Number(button.dataset.column);
    if (button.dataset.index !== undefined) source.index = Number(button.dataset.index);
    if (sameSource(selected, source)) { clear(); panel.render(); return; }
    if (selected && source.pile !== 'waste' && canMoveSolitaire(panel.state, selected, source)) {
      const next = moveSolitaire(panel.state, selected, source); clear(); panel.commit(next); return;
    }
    const cards = solitaireSource(panel.state, source);
    if (cards.length) {
      selected = source; note = `已选 ${cardName(cards[0])}${cards.length > 1 ? ` 起的 ${cards.length} 张牌` : ''}，再点目标牌堆。`;
    } else note = selected ? '这里放不下：空列只收 K，收牌区从同花色 A 开始。' : '先选一张明牌，再点要放到的牌堆。';
    panel.render();
  });
  return {
    create: createSolitaire,
    reset() { clear(); },
    stats: game => [['已收齐', `${game.score / 10} / 52`], ['移动次数', game.moves], ['牌库余牌', game.stock.length]],
    message: game => game.status === 'won' ? '四种花色都从 A 排到了 K，接龙完成！' : game.status === 'lost' ? '这局已没有可用的移动，试试撤回一步或重新开始。' : note || '先选明牌，再点目标；左上牌库每次翻 1 张。',
    draw(game) {
      const playable = panel.canPlay();
      undo.disabled = !panel.started || panel.paused || !game.previous;
      cancel.disabled = !playable || !selected; hint.disabled = !playable;
      const signature = JSON.stringify(selected);
      if (lastState === game && lastSelection === signature && lastPlayable === playable) return;
      lastState = game; lastSelection = signature; lastPlayable = playable;
      const focused = board.contains(document.activeElement) ? document.activeElement.dataset.focus : null;
      const disabled = playable ? '' : ' disabled';
      const renderCard = (card, source, extra = '') => `<button type="button" class="sol-card ${solitaireRed(card) ? 'sol-red' : ''} ${extra}" ${sourceData(source)} data-focus="card-${card.id}" aria-label="${cardName(card)}${source.pile === 'tableau' ? `，第 ${source.column + 1} 列` : ''}" aria-pressed="${sameSource(selected, source)}"${disabled}>${cardFace(card)}</button>`;
      const waste = game.waste.at(-1);
      const stock = `<div class="sol-pile"><span class="sol-pile-label">牌库 ${game.stock.length}</span><button type="button" class="sol-card sol-stock ${game.stock.length ? 'sol-filled' : ''}" data-action="stock" data-focus="stock" aria-label="${game.stock.length ? `翻一张牌，剩余 ${game.stock.length} 张` : game.waste.length ? '回收弃牌，重新翻牌' : '牌库已空'}"${!playable || (!game.stock.length && !game.waste.length) ? ' disabled' : ''}><b aria-hidden="true">${game.stock.length ? '▧' : '↻'}</b><small>${game.stock.length ? '翻牌' : '回收'}</small></button></div>`;
      const wasteHtml = `<div class="sol-pile"><span class="sol-pile-label">明牌 ${game.waste.length}</span>${waste ? renderCard(waste, { pile: 'waste' }, selected?.pile === 'waste' ? 'sol-selected' : '') : '<div class="sol-card sol-empty" aria-label="明牌区为空"><span>—</span></div>'}</div>`;
      const foundations = game.foundations.map((pile, column) => {
        const source = { pile: 'foundation', column }, target = selected && canMoveSolitaire(game, selected, source);
        return `<div class="sol-pile ${target ? 'sol-target' : ''}"><span class="sol-pile-label">${SOLITAIRE_SUITS[column]} 收牌</span>${pile.length ? renderCard(pile.at(-1), source, sameSource(selected, source) ? 'sol-selected' : '') : `<button type="button" class="sol-card sol-empty ${column % 2 ? 'sol-red' : ''}" ${sourceData(source)} data-focus="foundation-${column}" aria-label="${SOLITAIRE_SUIT_NAMES[column]}收牌区，等待 A"${disabled}><b>${SOLITAIRE_SUITS[column]}</b><small>A → K</small></button>`}</div>`;
      }).join('');
      const tableau = game.tableau.map((cards, column) => {
        const target = selected && canMoveSolitaire(game, selected, { pile: 'tableau', column });
        const content = cards.length ? cards.map((card, index) => card.faceUp ? renderCard(card, { pile: 'tableau', column, index }, selected?.pile === 'tableau' && selected.column === column && index >= selected.index ? 'sol-selected' : '') : '<div class="sol-back" role="img" aria-label="盖住的牌"></div>').join('') : `<button type="button" class="sol-card sol-empty" data-pile="tableau" data-column="${column}" data-focus="empty-${column}" aria-label="第 ${column + 1} 列为空，可以放 K"${disabled}><b>K</b></button>`;
        return `<div class="sol-column ${target ? 'sol-target' : ''}"><span class="sol-pile-label">${column + 1}</span>${content}</div>`;
      }).join('');
      board.innerHTML = `<div class="sol-top">${stock}${wasteHtml}<span aria-hidden="true"></span>${foundations}</div><div class="sol-tableau">${tableau}</div>`;
      if (focused && playable) board.querySelector(`[data-focus="${focused}"]`)?.focus({ preventScroll: true });
    },
    key(key) {
      if (key === 'n') { drawStock(); return true; }
      if (key === 'u') { undo.click(); return true; }
      if (key === 'h') { hint.click(); return true; }
      return false;
    },
  };
}

const WORD_FEEDBACK = { correct: '字母和位置都正确', present: '有这个字母，但位置不同', absent: '没有更多这个字母' };
const WORD_MARKS = { correct: '=', present: '↔', absent: '·' };

function setupWord(panel) {
  classicPanel(panel);
  panel.surface.innerHTML = '<div class="word-board" role="group" aria-label="六次机会，每次五个英文字母"></div><div class="word-legend"><span><i class="word-correct">=</i>位置对</span><span><i class="word-present">↔</i>位置不同</span><span><i class="word-absent">·</i>没有该字母</span></div>';
  const board = panel.surface.querySelector('.word-board');
  const rows = Array.from({ length: 6 }, (_, row) => {
    const element = document.createElement('div'); element.className = 'word-row'; element.setAttribute('role', 'group'); element.setAttribute('aria-label', `第 ${row + 1} 次猜测`);
    const cells = Array.from({ length: 5 }, () => { const cell = document.createElement('span'); cell.className = 'word-cell'; cell.innerHTML = '<b></b><small aria-hidden="true"></small>'; element.append(cell); return cell; });
    board.append(element); return { element, cells };
  });
  const enter = key => { if (panel.canPlay()) panel.commit(key === 'enter' ? submitWord(panel.state) : typeWord(panel.state, key)); };
  const keyboard = document.createElement('div'); keyboard.className = 'word-keyboard'; panel.controls.append(keyboard);
  const keys = [];
  ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].forEach((letters, index) => {
    const row = document.createElement('div'); row.className = `word-key-row word-key-row-${index}`;
    if (index === 2) { const confirm = makeButton('确认', 'word-key word-action', () => enter('enter')); confirm.dataset.key = 'enter'; row.append(confirm); keys.push(confirm); }
    [...letters].forEach(letter => { const button = makeButton(letter, 'word-key', () => enter(letter)); button.dataset.key = letter; button.setAttribute('aria-label', `输入字母 ${letter}`); row.append(button); keys.push(button); });
    if (index === 2) { const erase = makeButton('删除', 'word-key word-action', () => enter('backspace')); erase.dataset.key = 'backspace'; row.append(erase); keys.push(erase); }
    keyboard.append(row);
  });
  // The shared panel reserves P for pause. Here P belongs to the alphabet;
  // consume it before the document handler while retaining Esc / pause buttons.
  panel.root.addEventListener('keydown', event => {
    if (event.key.toLowerCase() !== 'p' || !panel.canPlay() || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input,textarea,select')) return;
    event.preventDefault(); event.stopPropagation(); enter('p');
  });
  return {
    create: createWord,
    stats: game => [['已猜次数', `${game.guesses.length} / 6`], ['英文单词', '5 字母'], ['剩余机会', 6 - game.guesses.length]],
    message: game => game.status === 'won' ? `猜中了！${game.answer}，用了 ${game.guesses.length} 次。` : game.status === 'lost' ? `六次机会用完了。答案是 ${game.answer}。` : game.error || '猜一个 5 字母英文单词，按确认看线索。',
    draw(game) {
      rows.forEach(({ element, cells }, row) => {
        const guess = game.guesses[row], current = row === game.guesses.length && game.status === 'playing';
        element.classList.toggle('word-current', current);
        cells.forEach((cell, column) => {
          const letter = guess ? guess.word[column] : current ? game.input[column] || '' : '';
          const feedback = guess?.feedback[column];
          cell.className = `word-cell${feedback ? ` word-${feedback}` : ''}${letter ? ' word-filled' : ''}`;
          setText(cell.firstChild, letter); setText(cell.lastChild, WORD_MARKS[feedback] || '');
          cell.setAttribute('aria-label', `第 ${column + 1} 格，${letter || '空'}${feedback ? `，${WORD_FEEDBACK[feedback]}` : ''}`);
        });
      });
      const known = wordKeyboard(game);
      keys.forEach(button => {
        const feedback = known[button.dataset.key];
        button.className = `word-key${button.dataset.key.length > 1 ? ' word-action' : ''}${feedback ? ` word-${feedback}` : ''}`;
        button.disabled = !panel.canPlay();
        if (button.dataset.key.length === 1) button.setAttribute('aria-label', `输入字母 ${button.dataset.key}${feedback ? `，${WORD_FEEDBACK[feedback]}` : ''}`);
      });
    },
    key(key, event) {
      if (key === 'enter' && !event.target.closest('button,a')) { enter('enter'); return true; }
      if (/^[a-z]$/.test(key) || ['backspace', 'delete'].includes(key)) { enter(key); return true; }
      return false;
    },
  };
}

function codePeg(color, label = '') { return `<span class="code-peg${color === null ? ' code-unknown' : ` code-color-${color}`}"${label ? ` aria-label="${label}"` : ''}>${color === null ? '?' : color + 1}</span>`; }

function setupCode(panel) {
  classicPanel(panel);
  let selected = 0;
  panel.surface.innerHTML = '<div class="code-secret" aria-label="本局密码"><span>秘密组合</span><div></div></div><div class="code-history" aria-label="猜测记录"></div><p class="code-legend">● 位置正确　○ 颜色正确、位置不同</p><div class="code-input" role="group" aria-label="编辑本次四个颜色"></div><p class="code-input-note">先点位置，再选颜色；同色可以重复。</p>';
  const history = panel.surface.querySelector('.code-history'), secret = panel.surface.querySelector('.code-secret > div'), input = panel.surface.querySelector('.code-input');
  const slots = Array.from({ length: 4 }, (_, index) => {
    const button = makeButton('', 'code-slot', () => { if (panel.canPlay()) { selected = index; panel.render(); } }); input.append(button); return button;
  });
  const choose = color => {
    if (!panel.canPlay()) return;
    const next = setCodePeg(panel.state, selected, color); selected = (selected + 1) % 4; panel.commit(next); panel.render();
  };
  const palette = document.createElement('div'); palette.className = 'code-palette'; panel.controls.append(palette);
  const colors = CODE_COLORS.map((name, color) => {
    const button = makeButton('', `code-color-button code-color-${color}`, () => choose(color)); button.innerHTML = `<b>${color + 1}</b><span>${name}</span>`; button.setAttribute('aria-label', `颜色 ${color + 1}，${name}`); palette.append(button); return button;
  });
  const erase = panel.button('删除一格', () => {
    if (!panel.canPlay()) return;
    if (panel.state.current[selected] === null) selected = (selected + 3) % 4;
    panel.commit(setCodePeg(panel.state, selected, null)); panel.render();
  });
  const submit = panel.button('提交猜测', () => {
    if (!panel.canPlay()) return;
    const next = submitCode(panel.state); if (next.guesses.length !== panel.state.guesses.length) selected = 0; panel.commit(next);
  }, 'classic-submit');
  return {
    create: createCode, reset() { selected = 0; },
    stats: game => [['已猜次数', `${game.guesses.length} / ${CODE_ATTEMPTS}`], ['可选颜色', '6 色'], ['剩余机会', CODE_ATTEMPTS - game.guesses.length]],
    message: game => game.status === 'won' ? `四个位置全部正确！用了 ${game.guesses.length} 次猜中。` : game.status === 'lost' ? `机会用完了，密码是 ${game.secret.map(color => color + 1).join(' · ')}。` : game.error || `正在编辑第 ${selected + 1} 格，选颜色后会自动到下一格。`,
    draw(game) {
      secret.innerHTML = game.secret.map((color, index) => codePeg(game.status === 'playing' ? null : color, `第 ${index + 1} 位${game.status === 'playing' ? '隐藏' : `，${CODE_COLORS[color]}，${color + 1}`}`)).join('');
      history.innerHTML = game.guesses.length ? game.guesses.map((guess, index) => `<div class="code-history-row"><span class="code-row-number">${String(index + 1).padStart(2, '0')}</span><div class="code-history-pegs" aria-label="猜测 ${guess.colors.map(color => color + 1).join('、')}">${guess.colors.map(color => codePeg(color)).join('')}</div><span class="code-feedback" aria-label="${guess.exact} 个位置正确，${guess.elsewhere} 个颜色正确但位置不同"><b>● ${guess.exact}</b><span>○ ${guess.elsewhere}</span></span></div>`).join('') : '<div class="code-empty"><span>01</span><p>你的第一条线索<br><small>从四个颜色开始。</small></p></div>';
      slots.forEach((button, index) => {
        const color = game.current[index];
        button.innerHTML = `<span class="code-slot-number">${index + 1}</span>${codePeg(color)}`;
        button.classList.toggle('selected', selected === index); button.setAttribute('aria-pressed', String(selected === index));
        button.setAttribute('aria-label', `第 ${index + 1} 个位置，${color === null ? '未选择' : `${CODE_COLORS[color]}，颜色 ${color + 1}`}`); button.disabled = !panel.canPlay();
      });
      [...colors, erase, submit].forEach(button => { button.disabled = !panel.canPlay(); });
    },
    key(key, event) {
      if (/^[1-6]$/.test(key)) { choose(Number(key) - 1); return true; }
      if (key === 'backspace' || key === 'delete') { erase.click(); return true; }
      if (key === 'enter' && !event.target.closest('button,a')) { submit.click(); return true; }
      if (key === 'arrowleft' || key === 'arrowright') { selected = (selected + (key === 'arrowleft' ? 3 : 1)) % 4; panel.render(); slots[selected].focus({ preventScroll: true }); return true; }
      return false;
    },
  };
}

function setupSimon(panel) {
  classicPanel(panel);
  panel.surface.innerHTML = '<div class="simon-cue"><span class="small-label">WATCH · REMEMBER · REPEAT</span><strong></strong><p></p></div><div class="simon-pads" role="group" aria-label="四个节奏灯，数字键 1 至 4"></div><div class="simon-progress" aria-label="八轮进度"></div>';
  const cue = panel.surface.querySelector('.simon-cue strong'), note = panel.surface.querySelector('.simon-cue p'), grid = panel.surface.querySelector('.simon-pads'), progress = panel.surface.querySelector('.simon-progress');
  const press = index => { if (panel.canPlay()) panel.commit(pressSimon(panel.state, index)); };
  const pads = SIMON_NAMES.map((name, index) => {
    const button = makeButton('', `simon-pad simon-pad-${index}`, () => press(index)); button.innerHTML = `<b>${index + 1}</b><span>${name}</span><small>等待</small>`; grid.append(button); return button;
  });
  const rounds = Array.from({ length: SIMON_ROUNDS }, (_, index) => { const element = document.createElement('span'); element.textContent = index + 1; progress.append(element); return element; });
  return {
    create: createSimon, tick: tickSimon, interval: 16,
    stats: game => [['当前轮次', `${game.sequence.length} / ${SIMON_ROUNDS}`], ['已完成', game.completed], ['本局得分', game.score]],
    message: game => game.status === 'won' ? '八轮节奏全部记住，800 分完美通关！' : game.status === 'lost' ? `顺序不对，再试一次吧。已完成 ${game.completed} 轮。` : game.phase === 'input' ? `轮到你：还需按 ${game.sequence.length - game.inputIndex} 下。` : game.phase === 'round' ? '这一轮正确，下一轮多记一个。' : game.phase === 'feedback' ? '正确，跟着自己的节奏来。' : '先看灯光顺序，播放结束后再按。',
    draw(game) {
      const accepting = game.phase === 'input' && panel.canPlay();
      setText(cue, game.status === 'won' ? '全部记住了。' : game.status === 'lost' ? '差一点，重来吧。' : game.phase === 'input' ? '轮到你，照着按。' : game.phase === 'round' ? '记住了，再加一个。' : game.phase === 'feedback' ? '就是这个节奏。' : '先看一遍。');
      setText(note, game.status !== 'playing' ? `完成 ${game.completed} / ${SIMON_ROUNDS} 轮` : game.phase === 'input' || game.phase === 'feedback' ? `已输入 ${game.inputIndex} / ${game.sequence.length}` : `${game.sequence.length} 个亮灯 · 播放时暂不能输入`);
      pads.forEach((button, index) => {
        const lit = game.active === index;
        button.classList.toggle('simon-lit', lit); button.classList.toggle('simon-error', game.status === 'lost' && lit);
        button.disabled = !panel.canPlay(); button.setAttribute('aria-disabled', String(!accepting));
        button.setAttribute('aria-label', `${index + 1}，${SIMON_NAMES[index]}${lit ? '，亮起' : ''}${accepting ? '，可以输入' : '，请等待'}`);
        setText(button.lastChild, lit ? '亮' : accepting ? '点我' : '等待');
      });
      rounds.forEach((element, index) => { element.classList.toggle('simon-done', index < game.completed); element.classList.toggle('simon-current', index + 1 === game.sequence.length && game.status === 'playing'); });
    },
    key(key, event) { if (/^[1-4]$/.test(key)) { if (!event.repeat) press(Number(key) - 1); return true; } return false; },
  };
}

const DINO_PATH = 'M2 16h8v8h5V8h7V0h24v18H30v7h8v5h-7v-3h-4v8h-5v7h-7v-5h3v-7h-7v-4H6v-5H2z';

function setupRunner(panel) {
  classicPanel(panel);
  panel.surface.innerHTML = `<svg class="runner-field" viewBox="0 0 640 250" role="img" aria-label="恐龙跑道，点击跳跃"><rect width="640" height="250" rx="12" class="runner-sky"/><circle cx="525" cy="54" r="24" class="runner-sun"/><path d="M0 185 88 152 164 177 272 132 378 177 478 147 640 181V250H0Z" class="runner-hills"/><g class="runner-clouds"><path d="M115 57h61c2-15-9-22-20-17-7-18-34-16-37 4-14-2-20 13-4 13Z"/><path d="M344 87h46c5-14-4-21-15-16-10-14-25-8-27 4-12-2-16 12-4 12Z"/></g><path d="M0 ${RUNNER_GROUND}H640" class="runner-ground"/><path d="M0 215H640M0 232H640" class="runner-trail"/><g class="runner-obstacles"></g><g class="runner-dino"><path d="${DINO_PATH}"/><rect x="35" y="5" width="4" height="4" class="runner-eye"/><path class="runner-leg" d="M27 32h6v10h-7v-4h2Z"/></g><text x="24" y="32" class="runner-caption">ONE SMALL JUMP.</text></svg><p class="runner-instruction">点跑道或按跳跃，越过仙人掌。</p>`;
  const field = panel.surface.querySelector('svg'), dino = field.querySelector('.runner-dino'), obstacles = field.querySelector('.runner-obstacles'), trail = field.querySelector('.runner-trail'), leg = field.querySelector('.runner-leg');
  const jump = () => { if (panel.canPlay()) panel.commit(jumpRunner(panel.state)); };
  field.addEventListener('pointerdown', event => { if (event.button !== 0 || !panel.canPlay()) return; event.preventDefault(); jump(); });
  const jumpButton = panel.button('↑ 跳跃', jump, 'runner-jump');
  return {
    create: createRunner, tick: stepRunner,
    stats: game => [['本局得分', game.score], ['越过障碍', game.passed], ['当前速度', `${(game.speed / 210).toFixed(1)} ×`]],
    message: game => game.status === 'lost' ? `碰到仙人掌了。本局 ${game.score} 分，越过 ${game.passed} 个障碍。` : game.height > 0 ? '轻轻跳过，落地后还能再跳。' : '空格 / ↑ / W 或点跑道跳跃，P / Esc 暂停。',
    draw(game) {
      dino.setAttribute('transform', `translate(${RUNNER_X},${RUNNER_GROUND - game.height - 42})`);
      dino.classList.toggle('runner-hit', game.status === 'lost');
      leg.setAttribute('transform', game.height > 0 ? 'translate(0,-3)' : `translate(${Math.floor(game.elapsed / 90) % 2 ? -4 : 0},0)`);
      trail.setAttribute('stroke-dashoffset', String(game.distance % 34));
      obstacles.innerHTML = game.obstacles.map(obstacle => `<g transform="translate(${obstacle.x},${RUNNER_GROUND - obstacle.height})"><rect x="${obstacle.width * .31}" width="${obstacle.width * .38}" height="${obstacle.height}" rx="4"/><path d="M${obstacle.width * .4} ${obstacle.height * .52}H4V${obstacle.height * .23}M${obstacle.width * .6} ${obstacle.height * .66}H${obstacle.width - 4}V${obstacle.height * .39}"/></g>`).join('');
      field.setAttribute('aria-label', `恐龙跑道，${game.score} 分，已越过 ${game.passed} 个障碍${game.status === 'lost' ? '，本局结束' : ''}`);
      jumpButton.disabled = !panel.canPlay();
    },
    key(key, event) { if ([' ', 'arrowup', 'w'].includes(key)) { if (!event.repeat) jump(); return true; } return false; },
  };
}

export const CLASSIC_GAMES = [
  {
    id: 'solitaire', name: '纸牌接龙', number: '028', icon: '♠', category: '经典纸牌', filter: 'puzzle',
    description: '红黑交替，给每一张牌找到归处。', welcome: '把一副牌，慢慢理顺。', hint: '先选源牌，再点目标牌堆。', detail: '52 张牌 · 翻一张', intro: '经典 Klondike 接龙。没有倒计时，支持撤回；随机牌局不保证能解，卡住时可以回看前一步。',
    rules: ['左上牌库每次翻 1 张。牌库用完后点“回收”，可不限次数重翻明牌堆。', '七列牌按红黑交替、数字递减摆放；可以搬走一整叠连续明牌。空列只接受 K 或以 K 开头的一叠牌。', '上方四个收牌区按各自花色从 A 到 K 递增，只能逐张放入。收牌区顶牌也可移回下方；盖住的顶牌会自动翻开。', '先点源牌，再点目标牌堆。Tab 与 Enter 也可操作；N 翻牌、U 撤回、H 找一步。收齐 52 张即获胜，无可用移动时会提示，并允许撤回。'],
    art: '<div class="art-solitaire"><b><small>Q ♠</small><span>♠</span></b><b><small>K ♥</small><span>♥</span></b><b><small>A ♣</small><span>♣</span></b></div>', setup: setupSolitaire,
  },
  {
    id: 'word', name: '猜单词', number: '029', icon: 'Aa', category: '英文词语', filter: 'puzzle',
    description: '六次机会，猜出一个五字母英文单词。', welcome: '让字母，给一点线索。', hint: '英文 5 字母 · Esc 暂停', detail: '6 次机会 · 本地词库', intro: `离线英文猜词，内置 ${WORD_DICTIONARY.length} 个五字母单词。答案选自常用词；无效单词不消耗机会。`,
    rules: ['输入一个 5 字母英文单词，再点“确认”或按 Enter。可以用字母键，也可点屏幕键盘；删除键撤回字母。', '绿色“=”表示字母和位置都对；黄色“↔”表示有这个字母但位置不同；灰色“·”表示没有更多这个字母。', '重复字母按答案里的实际数量给线索；绿色优先。最多 6 次猜测，全部位置正确即获胜，结束后显示答案。', '只接受内置词库中的英文单词。P 在本游戏用于输入字母，请用 Esc 或暂停按钮暂停。'],
    art: '<div class="art-word"><small>FIVE LITTLE LETTERS</small><div><b>P</b><b>L</b><b>A</b><b>N</b><b>T</b></div><span>=　↔　·　·　=</span></div>', setup: setupWord,
  },
  {
    id: 'code', name: '猜色密码', number: '030', icon: '●', category: '逻辑推理', filter: 'puzzle',
    description: '四个颜色，一点点接近秘密答案。', welcome: '跟着线索，解开密码。', hint: '颜色和数字，一样能辨认。', detail: '4 位密码 · 10 次机会', intro: '从六种颜色中排出四位组合，同色可重复。反馈只告诉数量，不会告诉你具体是哪一个位置。',
    rules: ['密码有 4 个位置，从 6 种颜色中选取，允许重复。点一个位置，再点颜色；选完会自动跳到下一格。', '每次提交后，● 是颜色和位置都正确的数量，○ 是颜色正确但位置不同的数量。一个密码位最多计入一次反馈。', '数字键 1–6 选颜色，左右键换位置，Backspace 删除，Enter 提交。颜色同时有数字标识。', '10 次内猜中全部四位即可获胜。结束时显示完整密码，方便回顾推理。'],
    art: '<div class="art-code"><small>CRACK THE COLOUR</small><div><i>1</i><i>3</i><i>2</i><i>1</i></div><div><i>2</i><i>1</i><i>4</i><i>6</i></div><span>● ● ○</span></div>', setup: setupCode,
  },
  {
    id: 'simon', name: '记忆节奏', number: '031', icon: '◈', category: '记忆挑战', filter: 'puzzle',
    description: '看一遍灯光，把顺序记在心里。', welcome: '接住一小段节奏。', hint: '先看，再按；不用打开声音。', detail: '4 盏灯 · 8 轮通关', record: true,
    rules: ['先看四盏灯按顺序亮起。显示“轮到你”后，照着刚才的顺序点灯。播放期间无法输入。', '每完成一轮，原顺序后会再加一盏灯；全部 8 轮正确就通关，每轮 100 分。按错即结束。', '点灯或按数字键 1–4：左上、右上、左下、右下。每次正确输入会短暂亮灯，熄灭后可以继续。', 'P / Esc 或按钮暂停。暂停会冻结亮灯和等待时间，回来后从同一处继续。'],
    art: '<div class="art-simon"><b>1</b><b>2</b><b>3</b><b>4</b><span>REPEAT</span></div>', setup: setupSimon,
  },
  {
    id: 'runner', name: '恐龙跑酷', number: '032', icon: '↗', category: '敏捷街机', filter: 'arcade',
    description: '小小一跃，越过一路的仙人掌。', welcome: '一路向前，轻轻跳。', hint: '落地后，才能再次起跳。', detail: '无尽跑道 · 跳跃挑战', record: true,
    rules: ['恐龙会自动前进。点跑道、点“跳跃”，或按空格 / ↑ / W 跳过仙人掌。', '跳跃有固定高度，必须落地才能再跳。看准距离起跳，碰到仙人掌就结束。', '每跑 10 单位得 1 分，每越过一个障碍再加 25 分。速度会逐渐增加，最高约 1.8 倍。', 'P / Esc 暂停或继续。离开页面会暂停，最高分保存在当前浏览器。'],
    art: `<div class="art-runner"><svg viewBox="0 0 240 150" aria-hidden="true"><circle cx="185" cy="36" r="19"/><path class="runner-art-hill" d="M0 118 58 81 112 108 180 72 240 117V150H0Z"/><path class="runner-art-ground" d="M0 130H240"/><path class="runner-art-dino" transform="translate(62 67) scale(1.5)" d="${DINO_PATH}"/><path class="runner-art-cactus" d="M183 130V88M183 113H170V100M183 104H194V94"/></svg></div>`, setup: setupRunner,
  },
];
