import { ladders, letters, searches } from './words-data.js';
import { buildSearch, oneLetterApart, rotateLetters, searchLine, shortestLadder } from './words-rules.js';
import { setup } from './words-ui.js';

export function mountLadder(id, host, api) {
  const view = setup(host, api, id);
  let index = 0;
  let path = [ladders[index].start];
  let steps = 0;
  let practice = false;
  let feedback = '';

  function render() {
    const { start, goal, bank, clue } = ladders[index];
    const current = path.at(-1);
    const solved = current === goal;
    const route = view.element('ol', 'words-ladder-path');
    for (const word of path) route.append(view.element('li', '', word));
    route.setAttribute('aria-label', '已走的阶梯');
    route.lang = 'en';
    view.paint(
      view.toolbar(`第 ${index + 1} / ${ladders.length} 段`, `共走 ${steps} 步`, ...(practice ? ['练习模式'] : [])),
      view.prompt(`${start} → ${goal} · ${clue}`),
      route,
      view.grid(4, bank.map(word => {
        const tile = view.button(`word-${word}`, word, () => move(word), { style: 'words-english', disabled: solved || path.includes(word) });
        tile.lang = 'en';
        return tile;
      }), '可选的英文单词'),
      view.actions(...(solved && index + 1 < ladders.length ? [view.next(() => {
        index++;
        path = [ladders[index].start];
        feedback = '';
        render();
      }, '下一段')] : [
        view.button('undo', '退回一步', () => {
          path.pop();
          feedback = `回到 ${path.at(-1)}。`;
          render();
          api.status(feedback);
        }, { disabled: solved || path.length < 2 }),
        view.button('hint', '提示下一步', () => {
          if (!practice) {
            practice = true;
            api.unrank();
          }
          const remaining = bank.filter(word => !path.includes(word));
          const route = shortestLadder(current, goal, remaining);
          feedback = route ? `试试把 ${current} 变成 ${route[1]}。本次为练习。` : '这条路已经走不通，退回一步再试。本次为练习。';
          render();
          api.status(feedback);
        }, { disabled: solved }),
      ])),
      view.message(feedback),
    );
  }

  function move(word) {
    const current = path.at(-1);
    const goal = ladders[index].goal;
    if (!oneLetterApart(current, word)) {
      feedback = `${current} 和 ${word} 需要改动多于一个字母。`;
    } else {
      path.push(word);
      steps++;
      feedback = word === goal ? `到达 ${goal}。` : `当前是 ${word}。`;
    }
    render();
    if (word === path.at(-1) && word === goal && index + 1 === ladders.length) {
      api.end(`走完三段阶梯，共 ${steps} 步。`, practice ? null : steps);
    } else api.status(feedback);
  }

  render();
}

export function mountSearch(id, host, api) {
  const view = setup(host, api, id);
  let index = 0;
  let board;
  let start;
  let marked;
  let found;
  let feedback;

  function load() {
    board = buildSearch(searches[index].placements, () => api.random());
    start = null;
    marked = new Set();
    found = new Set();
    feedback = '先点击一个目标词的首字母。';
    render();
  }

  function select(position) {
    const { placements } = searches[index];
    if (start === position) {
      start = null;
      feedback = '已取消起点。';
    } else if (start === null) {
      start = position;
      feedback = `已选中 ${board[position]}，现在点击尾字母。`;
    } else {
      const path = searchLine(start, position);
      const word = path.map(cell => board[cell]).join('');
      if (!path.length) feedback = '请在同一横线、竖线或斜线上圈词。';
      else if (found.has(word)) feedback = `已经找到了 ${word}。`;
      else if (placements.some(([target]) => target === word)) {
        found.add(word);
        for (const cell of path) marked.add(cell);
        feedback = `找到了 ${word}。`;
      } else feedback = '这条直线上的字母没有组成目标词。';
      start = null;
    }
    render();
    if (found.size === placements.length && index + 1 === searches.length) api.end('找到了三盘里的所有目标词。');
    else api.status(feedback);
  }

  function render() {
    const { theme, placements } = searches[index];
    const solved = found.size === placements.length;
    const targets = view.element('ul', 'words-targets');
    for (const [word, translation] of placements) {
      const item = view.element('li', found.has(word) ? 'words-found' : '');
      const english = view.element('strong', 'words-english', word);
      english.lang = 'en';
      item.append(english, view.element('span', '', `${translation}${found.has(word) ? ' ✓' : ''}`));
      targets.append(item);
    }
    const cells = board.map((letter, position) => view.button(`letter-${position}`, letter, () => select(position), {
      disabled: solved, pressed: start === position,
      label: `${Math.floor(position / 7) + 1} 行 ${position % 7 + 1} 列，${letter}${marked.has(position) ? '，已找到' : ''}`,
      style: `words-square words-english${marked.has(position) ? ' words-found' : ''}`,
    }));
    view.paint(
      view.toolbar(`第 ${index + 1} / ${searches.length} 盘 · ${theme}`, `已找到 ${found.size} / ${placements.length} 个`),
      targets,
      view.grid(7, cells, '字母方阵', 'words-letter-board'),
      ...(solved && index + 1 < searches.length ? [view.actions(view.next(() => { index++; load(); }, '下一盘'))] : []),
      view.message(feedback),
    );
  }

  load();
}

export function mountCipher(id, host, api) {
  const view = setup(host, api, id);
  let index = 0;
  let rotation = 0;
  let solved = false;
  let feedback = '';

  function render() {
    const [answer, shift, hint] = letters[index];
    const ciphertext = rotateLetters(answer, shift);
    const decoded = rotateLetters(ciphertext, -rotation);
    function sample(label, text, style = '') {
      const panel = view.element('p', `words-cipher-sample ${style}`);
      const line = view.element('strong', 'words-english', text);
      line.lang = 'en';
      panel.append(view.element('small', '', label), line);
      return panel;
    }
    view.paint(
      view.toolbar(`第 ${index + 1} / ${letters.length} 封`, '凯撒移位'),
      view.prompt(hint),
      sample('密文', ciphertext),
      view.actions(
        view.button('rotate-minus', '−', () => rotate(-1), { label: '还原步数减一', disabled: solved }),
        view.element('span', 'words-rotation', `回退 ${rotation} 位`),
        view.button('rotate-plus', '+', () => rotate(1), { label: '还原步数加一', disabled: solved }),
      ),
      view.note(`密文中的 ${ciphertext[0]} → ${decoded[0]}`),
      sample('译文预览', decoded, 'words-cipher-preview'),
      view.actions(solved && index + 1 < letters.length ? view.next(() => {
        index++;
        rotation = 0;
        solved = false;
        feedback = '';
        render();
      }, '下一封信') : view.button('check', '提交译文', () => {
        solved = decoded === answer;
        feedback = solved ? '译文正确，密信已解开。' : '还原的步数不对，试试其他位移。';
        render();
        if (solved && index + 1 === letters.length) api.end('三封密信都已解开。');
        else api.status(feedback);
      }, { disabled: solved, style: 'words-primary' })),
      view.message(feedback),
    );
  }

  function rotate(delta) {
    rotation = (rotation + delta + 26) % 26;
    feedback = '';
    render();
    api.status(`回退 ${rotation} 位。`);
  }

  render();
}
