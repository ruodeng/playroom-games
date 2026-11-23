import { cases, numberBoards, sequences } from './words-data.js';
import { combine, isTwentyFour, numberCard, operators, solveTwentyFour, truthCount } from './words-rules.js';
import { scoreTime, setup } from './words-ui.js';

export function mountWitness(id, host, api) {
  const view = setup(host, api, id);
  let index = 0;
  let notes = [0, 0, 0, 0];
  let chosen = null;
  let solved = false;
  let feedback = '';

  function render() {
    const { title, intro, truths, suspects, statements } = cases[index];
    const list = view.element('ol', 'words-witness-list');
    statements.forEach(([statement, trueIf], suspect) => {
      const row = view.element('li', 'words-witness-row');
      const line = view.element('p', 'words-witness-line');
      line.append(view.element('strong', '', suspects[suspect]), view.element('span', '', statement));
      const mark = ['待判断', '真话', '假话'][notes[suspect]];
      row.append(line, solved ? view.element('span', 'words-verdict', trueIf.includes(chosen) ? '真话' : '假话')
        : view.button(`mark-${suspect}`, mark, () => {
          notes[suspect] = (notes[suspect] + 1) % 3;
          render();
        }, { label: `${suspects[suspect]}的证词，${mark}，点击切换`, style: notes[suspect] ? `words-mark-${notes[suspect]}` : '' }));
      list.append(row);
    });
    view.paint(
      view.toolbar(`案件 ${index + 1} / ${cases.length}`, `真实证词 ${truths} 条`),
      view.element('h2', 'words-case-title', title),
      view.prompt(intro),
      list,
      view.note('选择符合条件的人选。'),
      view.grid(4, suspects.map((name, suspect) => view.button(`suspect-${suspect}`, name, () => {
        chosen = suspect;
        feedback = '';
        render();
      }, { disabled: solved, pressed: chosen === suspect })), '人选'),
      view.actions(solved && index + 1 < cases.length ? view.next(() => {
        index++;
        notes = [0, 0, 0, 0];
        chosen = null;
        solved = false;
        feedback = '';
        render();
      }, '下一案') : view.button('check', '核对推理', () => {
        const count = truthCount(statements, chosen);
        solved = count === truths;
        feedback = solved ? `推理成立，答案是${suspects[chosen]}。` : `如果是${suspects[chosen]}，会有 ${count} 条真话。请再核对证词。`;
        render();
        if (solved && index + 1 === cases.length) api.end('解开了全部三案。');
        else api.status(feedback);
      }, { disabled: solved || chosen === null, style: 'words-primary' })),
      view.message(feedback),
    );
  }

  render();
}

function cardValue(card) {
  return card.denominator === 1 ? String(card.numerator) : `${card.numerator}/${card.denominator}`;
}

export function mountTwentyFour(id, host, api) {
  const view = setup(host, api, id);
  let index = 0;
  let cards;
  let picked;
  let operation;
  let history;
  let feedback;
  let answer;
  let practice = false;

  function load() {
    cards = numberBoards[index].map(numberCard);
    picked = [];
    operation = null;
    history = [];
    feedback = '';
    answer = '';
    render();
  }

  function infer() {
    feedback = '';
    render();
  }

  function compute() {
    const [left, right] = picked;
    const result = combine(cards[left], operation, cards[right]);
    if (!result) {
      feedback = '除数不能为零，请换一个运算。';
      render();
      api.status(feedback);
      return;
    }
    history.push(cards);
    cards = [...cards.filter((_, position) => position !== left && position !== right), result];
    picked = [];
    operation = null;
    if (cards.length > 1) feedback = `算出了 ${cardValue(result)}，继续合并剩余的牌。`;
    else if (isTwentyFour(result)) feedback = `${result.expression} = 24`;
    else feedback = `最后得到 ${cardValue(result)}，可以撤销上一步重新组合。`;
    render();
    if (cards.length === 1 && isTwentyFour(result) && index + 1 === numberBoards.length) {
      api.end('完成四组二十四点。', practice ? null : scoreTime(api));
    } else api.status(feedback);
  }

  function render() {
    const finishedCalculation = cards.length === 1;
    const solved = finishedCalculation && isTwentyFour(cards[0]);
    const tile = cards.map((card, position) => {
      const order = picked.indexOf(position);
      const control = view.button(`number-${position}`, cardValue(card), () => {
        if (order !== -1) picked = picked.filter(value => value !== position);
        else if (picked.length < 2) picked = [...picked, position];
        infer();
      }, {
        disabled: finishedCalculation || (order === -1 && picked.length === 2), pressed: order !== -1,
        style: 'words-number-card', label: `牌 ${position + 1}，${cardValue(card)}${order === -1 ? '' : order === 0 ? '，左操作数' : '，右操作数'}`,
      });
      if (order !== -1) control.append(view.element('small', 'words-cell-index', order === 0 ? '左' : '右'));
      if (card.expression.startsWith('(')) control.append(view.element('span', 'words-expression', card.expression));
      return control;
    });
    const operands = [picked[0], picked[1]].map(position => position === undefined ? '？' : cardValue(cards[position]));
    view.paint(
      view.toolbar(`第 ${index + 1} / ${numberBoards.length} 组`, `原始数字 ${numberBoards[index].join(' · ')}`, ...(practice ? ['练习模式'] : [])),
      view.grid(cards.length, tile, '可用数字牌', 'words-number-deck'),
      view.grid(4, operators.map((operator, position) => view.button(`op-${position}`, operator, () => {
        operation = operator;
        infer();
      }, { disabled: finishedCalculation, pressed: operation === operator, style: 'words-glyph' })), '四则运算符'),
      view.element('p', 'words-calculation', `${operands[0]} ${operation ?? '□'} ${operands[1]}`),
      view.actions(...(solved && index + 1 < numberBoards.length ? [view.next(() => {
        index++;
        load();
      }, '下一组')] : [
        view.button('compute', '算这一步', compute, { disabled: finishedCalculation || picked.length !== 2 || !operation, style: 'words-primary' }),
        view.button('undo', '撤销一步', () => {
          cards = history.pop();
          picked = [];
          operation = null;
          infer();
        }, { disabled: solved || !history.length }),
        view.button('hint', '查看解法', () => {
          if (!practice) {
            practice = true;
            api.unrank();
          }
          answer = solveTwentyFour(numberBoards[index].map(numberCard));
          render();
          api.status('已显示解法，本次为练习。');
        }, { disabled: solved || Boolean(answer) }),
      ])),
      view.message(feedback),
      ...(answer ? [view.note(`参考解法 ${answer} = 24`)] : []),
    );
  }

  load();
}

export function mountSequence(id, host, api) {
  const view = setup(host, api, id);
  let index = 0;
  let entries = new Map();
  let shown = false;
  let solved = false;

  function render() {
    const { terms, blanks, hint } = sequences[index];
    const inputs = new Map();
    const form = view.element('form', 'words-sequence-form');
    const feedback = view.message('');
    const cells = terms.map((term, position) => {
      const tile = view.element('div', 'words-sequence-tile');
      tile.append(view.element('span', 'words-sequence-label', `第 ${position + 1} 项`));
      if (!blanks.includes(position) || solved) {
        tile.append(view.element('strong', '', term));
        if (blanks.includes(position)) tile.classList.add('words-found');
        return tile;
      }
      const input = view.element('input', 'words-sequence-input');
      input.setAttribute('aria-label', `第 ${position + 1} 项`);
      input.type = 'text';
      input.inputMode = 'numeric';
      input.maxLength = 6;
      input.autocomplete = 'off';
      input.placeholder = '？';
      input.value = entries.get(position) ?? '';
      input.dataset.wordKey = `term-${position}`;
      input.addEventListener('input', () => {
        entries.set(position, input.value);
        input.removeAttribute('aria-invalid');
        feedback.textContent = '';
      });
      inputs.set(position, input);
      tile.append(input);
      return tile;
    });
    const submit = view.element('button', 'words-button words-primary', '核对数列');
    submit.type = 'submit';
    submit.dataset.wordKey = 'check';
    form.append(
      view.grid(terms.length, cells, '待补全的数列', 'words-sequence-grid'),
      ...(solved ? [view.note('两个空位都填对了。')]
        : [view.actions(submit, view.button('hint', shown ? '隐藏提示' : '规律提示', () => {
          shown = !shown;
          render();
        }, { pressed: shown }))]),
      ...(shown ? [view.note(hint)] : []),
      feedback,
    );
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (solved || api.signal.aborted) return;
      const incorrect = [];
      for (const [position, input] of inputs) {
        const value = input.value.normalize('NFKC').trim();
        if (!/^\d+$/.test(value) || Number(value) !== terms[position]) {
          input.setAttribute('aria-invalid', 'true');
          incorrect.push(input);
        }
      }
      if (incorrect.length) {
        feedback.textContent = '请检查标出的空位，填入完整的数字。';
        incorrect[0].focus({ preventScroll: true });
        api.status(feedback.textContent);
        return;
      }
      solved = true;
      render();
      if (index + 1 === sequences.length) api.end('八道数列谜题全部解开。');
      else api.status('两个空位都填对了。');
    });
    view.paint(
      view.toolbar(`第 ${index + 1} / ${sequences.length} 题`, '补全两个空位'),
      form,
      ...(solved && index + 1 < sequences.length ? [view.actions(view.next(() => {
        index++;
        entries = new Map();
        shown = false;
        solved = false;
        render();
      }))] : []),
    );
  }

  render();
}
