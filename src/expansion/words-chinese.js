import { crosswords, groupBoards, idioms, radicals } from './words-data.js';
import { buildCrossword, crosswordColumns, shuffled } from './words-rules.js';
import { scoreTime, setup } from './words-ui.js';

export function mountIdioms(id, host, api) {
  const view = setup(host, api, id);
  const placements = [2, 0, 3, 2, 1, 3, 1, 0, 2, 1, 0, 3, 0, 2, 3, 1, 2, 1, 2, 3, 3, 0, 1, 0, 3, 2, 0, 2, 1, 3, 1, 0, 0, 3, 2, 1];
  let index = 0;
  let errors = 0;
  let feedback = '';
  let failed = new Set();

  function render() {
    const done = index === idioms.length;
    const [idiom, missing, distractors, clue] = idioms[Math.min(index, idioms.length - 1)];
    const choices = [...distractors];
    if (!done) choices.splice(placements[index], 0, idiom[missing]);
    const letters = [...idiom].map((letter, position) => {
      const blank = !done && position === missing;
      const tile = view.element('span', `words-tile${blank ? ' words-blank' : ''}`, blank ? '？' : letter);
      if (blank) tile.setAttribute('aria-label', '缺字');
      return tile;
    });
    view.paint(
      view.toolbar(`已完成 ${index} / ${idioms.length}`, `罚时 ${errors * 3} 秒`),
      view.grid(4, letters, '四字成语'),
      view.prompt(clue),
      ...(!done ? [view.grid(4, choices.map((letter, position) => view.button(`answer-${position}`, letter, () => guess(letter), {
        disabled: failed.has(letter), style: 'words-glyph',
      })), '候选字')] : []),
      view.message(feedback),
    );
  }

  function guess(letter) {
    const [idiom, missing] = idioms[index];
    if (letter !== idiom[missing]) {
      errors++;
      failed.add(letter);
      feedback = `“${letter}”填错了，罚时增加 3 秒。`;
    } else {
      index++;
      failed = new Set();
      feedback = index === idioms.length ? `答对了，全部 ${idioms.length} 题完成。` : `答对了，上题是“${idiom}”。`;
    }
    render();
    if (index === idioms.length) api.end(feedback, scoreTime(api, errors * 3));
    else api.status(feedback);
  }

  render();
}

export function mountCrossword(id, host, api) {
  const view = setup(host, api, id);
  let index = 0;
  let puzzle;
  let entries;
  let bank;
  let clueIndex;
  let cursor;
  let checked;
  let solved;
  let feedback;

  function load() {
    puzzle = buildCrossword(crosswords[index]);
    entries = new Map();
    bank = shuffled(new Set([...Array.from(puzzle.board.values(), cell => cell.answer), ...'云晨雪明']), () => api.random());
    clueIndex = 0;
    cursor = puzzle.clues[0].cells[0];
    solved = false;
    checked = false;
    feedback = '点击候选字填入当前字格。';
    render();
  }

  function selectClue(next) {
    clueIndex = next;
    const { cells } = puzzle.clues[clueIndex];
    cursor = cells.find(cell => !entries.has(cell)) ?? cells[0];
    render();
  }

  function selectCell(position, cell) {
    if (!cell.clues.includes(clueIndex)) clueIndex = cell.clues[0];
    else if (position === cursor && cell.clues.length > 1) clueIndex = cell.clues.find(value => value !== clueIndex);
    cursor = position;
    render();
  }

  function fill(letter) {
    entries.set(cursor, letter);
    const { cells } = puzzle.clues[clueIndex];
    const offset = cells.indexOf(cursor);
    cursor = cells[offset + 1] ?? cells.find(cell => !entries.has(cell)) ?? cursor;
    checked = false;
    feedback = '点击字格可修改已填的字。';
    render();
  }

  function check() {
    checked = true;
    const correct = [...puzzle.board].filter(([position, cell]) => entries.get(position) === cell.answer).length;
    solved = correct === puzzle.board.size;
    feedback = solved ? '全部字格正确。' : `填对了 ${correct} / ${puzzle.board.size} 格，请继续修改。`;
    render();
    if (solved && index + 1 === crosswords.length) api.end('解开了全部三盘字谜。');
    else api.status(feedback);
  }

  function render() {
    const active = puzzle.clues[clueIndex];
    const board = Array.from({ length: 4 * crosswordColumns }, (_, position) => {
      const cell = puzzle.board.get(position);
      if (!cell) return view.element('span', 'words-block');
      const letter = entries.get(position) ?? '';
      const style = ['words-square'];
      if (active.cells.includes(position)) style.push('words-cross-run');
      if (cursor === position) style.push('words-current');
      if (checked && letter) style.push(letter === cell.answer ? 'words-found' : 'words-incorrect');
      const state = checked && letter ? (letter === cell.answer ? '，正确' : '，需修改') : '';
      const labels = `${Math.floor(position / crosswordColumns) + 1} 行 ${position % crosswordColumns + 1} 列，${letter || '空白'}${state}`;
      const tile = view.button(`cell-${position}`, letter, () => selectCell(position, cell), {
        style: style.join(' '), pressed: cursor === position, disabled: solved, label: labels,
      });
      if (cell.starts.length) tile.append(view.element('small', 'words-cell-index', cell.starts.join('/')));
      return tile;
    });
    view.paint(
      view.toolbar(`第 ${index + 1} / ${crosswords.length} 盘`, `已填 ${entries.size} / ${puzzle.board.size} 格`),
      view.grid(crosswordColumns, board, '交叉字格', 'words-letter-board'),
      view.actions(...puzzle.clues.map(({ direction }, next) => view.button(`clue-${next}`, `${next + 1} ${direction}`, () => selectClue(next), {
        pressed: clueIndex === next, disabled: solved,
      }))),
      view.prompt(`${clueIndex + 1} ${active.direction} · ${active.text}`),
      view.grid(6, bank.map(letter => view.button(`bank-${letter}`, letter, () => fill(letter), {
        style: 'words-glyph', disabled: solved,
      })), '候选字'),
      view.actions(
        view.button('clear', '清除该格', () => {
          entries.delete(cursor);
          checked = false;
          render();
        }, { disabled: solved || !entries.has(cursor) }),
        solved && index + 1 < crosswords.length
          ? view.next(() => { index++; load(); }, '下一盘')
          : view.button('check', '核对字格', check, { disabled: solved || !entries.size, style: 'words-primary' }),
      ),
      view.message(feedback),
    );
  }

  load();
}

export function mountRadicals(id, host, api) {
  const view = setup(host, api, id);
  const banks = radicals.map(([, , parts, extras]) => shuffled([...parts, ...extras], () => api.random()));
  const partOrder = { 左右: ['左部', '右部'], 上下: ['上部', '下部'], 内外: ['外框', '内部'] };
  let index = 0;
  let selected = [];
  let solved = false;
  let feedback = '';

  function render() {
    const [answer, shape, parts, , clue] = radicals[index];
    const picked = selected.map(choice => banks[index][choice]);
    const layout = { 左右: 'side', 上下: 'stack', 内外: 'frame' }[shape];
    const assembled = view.element('div', `words-assembly words-assembly-${layout}${solved ? ' words-found' : ''}`);
    if (solved) {
      assembled.textContent = answer;
    } else {
      assembled.setAttribute('role', 'group');
      assembled.setAttribute('aria-label', '部件组合');
      partOrder[shape].forEach((label, position) => {
        const part = view.element('span', `words-assembly-part${picked[position] ? '' : ' words-empty-part'}`, picked[position] ?? label);
        if (picked[position]) part.setAttribute('aria-label', `${label} ${picked[position]}`);
        assembled.append(part);
      });
    }
    view.paint(
      view.toolbar(`第 ${index + 1} / ${radicals.length} 题`, `${shape}结构`),
      view.prompt(clue),
      assembled,
      view.grid(6, banks[index].map((part, choice) => view.button(`part-${choice}`, part, () => {
        if (selected.includes(choice)) selected = selected.filter(value => value !== choice);
        else if (selected.length < 2) selected = [...selected, choice];
        feedback = '';
        render();
      }, { pressed: selected.includes(choice), disabled: solved, style: 'words-glyph' })), '候选部件'),
      view.actions(solved && index + 1 < radicals.length ? view.next(() => {
        index++;
        selected = [];
        solved = false;
        feedback = '';
        render();
      }) : view.button('combine', '组合部件', () => {
        solved = picked.every((part, position) => part === parts[position]);
        feedback = solved ? `组合正确，得到“${answer}”。` : '这两个部件还拼不出目标字，请调整部件或顺序。';
        render();
        if (solved && index + 1 === radicals.length) api.end(`完成全部 ${radicals.length} 个造字挑战。`);
        else api.status(feedback);
      }, { disabled: solved || selected.length !== 2, style: 'words-primary' })),
      view.message(feedback),
    );
  }

  render();
}

export function mountGroups(id, host, api) {
  const view = setup(host, api, id);
  const layouts = [
    [4, 13, 8, 2, 11, 1, 15, 6, 0, 10, 5, 12, 14, 7, 3, 9],
    [5, 11, 0, 14, 2, 13, 4, 8, 15, 6, 9, 3, 10, 1, 12, 7],
  ];
  let index = 0;
  let solved = [];
  let picked = [];
  let errors = 0;
  let practice = false;
  let feedback = '';

  function render() {
    const groups = groupBoards[index];
    const words = groups.flatMap(([, values]) => values);
    const done = solved.length === groups.length;
    const tiles = layouts[index].filter(position => !solved.includes(Math.floor(position / 4)));
    const revealed = solved.map(group => {
      const [label, values] = groups[group];
      const item = view.element('div', `words-revealed words-category-${group}`);
      item.append(view.element('strong', '', label), view.element('span', '', values.join('　')));
      return item;
    });
    view.paint(
      view.toolbar(`第 ${index + 1} / ${groupBoards.length} 盘`, `已分 ${solved.length} / ${groups.length} 组`, practice ? '练习模式' : `罚时 ${errors * 8} 秒`),
      ...revealed,
      ...(!done ? [view.grid(4, tiles.map(position => view.button(`word-${position}`, words[position], () => {
        if (picked.includes(position)) picked = picked.filter(value => value !== position);
        else if (picked.length < 4) picked = [...picked, position];
        feedback = '';
        render();
      }, { pressed: picked.includes(position) })), '待分类词语')] : []),
      view.actions(...(done && index + 1 < groupBoards.length ? [view.next(() => {
        index++;
        solved = [];
        feedback = '';
        render();
      }, '下一盘')] : [
        view.button('group-submit', '提交四个词', () => submit(false), { disabled: done || picked.length !== 4, style: 'words-primary' }),
        view.button('group-hint', '提示一组', () => submit(true), { disabled: done }),
      ])),
      view.message(feedback),
    );
  }

  function submit(hint) {
    const groups = groupBoards[index];
    const group = hint ? groups.findIndex((_, position) => !solved.includes(position)) : Math.floor(picked[0] / 4);
    if (hint && !practice) {
      practice = true;
      api.unrank();
    }
    if (hint || picked.every(position => Math.floor(position / 4) === group)) {
      solved.push(group);
      feedback = hint ? `已提示“${groups[group][0]}”，本次为练习。` : `找到一组“${groups[group][0]}”。`;
    } else if (!practice) {
      errors++;
      feedback = '这四个词无法归为一组，罚时增加 8 秒。';
    } else feedback = '这四个词无法归为一组，请重新选择。';
    picked = [];
    render();
    if (solved.length === groups.length && index + 1 === groupBoards.length) {
      api.end('两盘词语全部归组。', practice ? null : scoreTime(api, errors * 8));
    } else api.status(feedback);
  }

  render();
}
