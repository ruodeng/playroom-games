import { action, deckButton, face, facts, pip, range, red, shuffled, suit, suitNames, table, zone } from './cards-ui.js';

const seats = ['你', '左手', '对家', '右手'];
const passing = ['向左传', '向右传', '向对家传', '本手不传'];
const forecastLengths = [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];
const point = card => suit(card) === 2 ? 1 : card === 49 ? 13 : 0;

export function legalTrickCards(hand, trick, { hearts = false, first = false, broken = false } = {}) {
  if (trick.length) {
    const follow = hand.filter(card => suit(card) === suit(trick[0].card));
    if (follow.length) return follow;
    if (hearts && first) {
      const clean = hand.filter(card => !point(card));
      if (clean.length) return clean;
    }
  } else if (hearts) {
    if (first && hand.includes(0)) return [0];
    if (!broken) {
      const nonHearts = hand.filter(card => suit(card) !== 2);
      if (nonHearts.length) return nonHearts;
    }
  }
  return [...hand];
}

export function trickWinner(trick, trump = -1) {
  const led = suit(trick[0].card);
  const strength = card => (suit(card) === trump ? 26 : suit(card) === led ? 13 : 0) + pip(card);
  return trick.reduce((winner, play) => strength(play.card) > strength(winner.card) ? play : winner).seat;
}

export function heartsScores(points) {
  const moon = points.indexOf(26);
  return moon < 0 ? [...points] : points.map((_, i) => i === moon ? 0 : 26);
}

export function forecastBids(length, current) {
  const previous = current.filter(value => value !== null);
  const sum = previous.reduce((total, value) => total + value, 0);
  return range(length + 1).filter(value => previous.length !== 3 || sum + value !== length);
}

function forecastBid(hand, trump, current, length) {
  const estimate = hand.reduce((total, card) => {
    const rank = pip(card);
    return total + (suit(card) === trump ? 0.43 + rank / 21 : rank >= 10 ? (rank - 8) * 0.2 : 0.04);
  }, 0);
  return forecastBids(length, current).sort((a, b) => Math.abs(a - estimate) - Math.abs(b - estimate))[0];
}

function choosePass(hand) {
  const priority = card => (card === 49 ? 12 : 0) + (suit(card) === 3 && pip(card) > 10 ? 7 : 0)
    + pip(card) + (5 - hand.filter(c => suit(c) === suit(card)).length) * 0.8;
  return [...hand].sort((a, b) => priority(b) - priority(a)).slice(0, 3);
}

function chooseCard(legal, trick, seat, hearts, trump, need) {
  const last = trick.length === 3;
  const wins = card => !trick.length || trickWinner([...trick, { seat, card }], trump) === seat;
  const safety = card => pip(card) + (suit(card) === trump ? 15 : 0);
  if (hearts) {
    if (!trick.length) return [...legal].sort((a, b) => pip(a) - pip(b) || point(a) - point(b))[0];
    const losers = legal.filter(card => !wins(card));
    if (losers.length) return losers.sort((a, b) => (point(b) * 3 + pip(b)) - (point(a) * 3 + pip(a)))[0];
    const clean = !trick.some(play => point(play.card));
    return [...legal].sort((a, b) => point(a) - point(b) || (last && clean ? pip(b) - pip(a) : pip(a) - pip(b)))[0];
  }
  let pool = legal.filter(card => wins(card) === need);
  if (!pool.length) pool = legal;
  const strong = need && !last || !need && trick.length > 0 && pool.every(card => !wins(card));
  return [...pool].sort((a, b) => strong ? safety(b) - safety(a) : safety(a) - safety(b))[0];
}

export function mountTricks(id, host, api) {
  const hearts = id === 'hearts', total = [0, 0, 0, 0];
  const ui = table(host, api, click);
  let round = 0, dealer = Math.floor(api.random() * 4), length, hands, trumpCard, trump, phase;
  let turn, trick, tricksDone, won, points, bids, selected, broken, winner, note, over = '';
  function startHand() {
    length = hearts ? 13 : forecastLengths[round];
    const deck = shuffled(range(52), api.random);
    hands = range(4).map(i => deck.slice(i * length, (i + 1) * length).sort((a, b) => a - b));
    trumpCard = hearts ? null : deck[length * 4]; trump = hearts ? -1 : suit(trumpCard);
    trick = []; tricksDone = 0; won = [0, 0, 0, 0]; points = [0, 0, 0, 0]; bids = Array(4).fill(null);
    selected = new Set(); broken = false; note = '';
    if (hearts) {
      if (round % 4 === 3) startPlay();
      else phase = 'pass';
    } else { phase = 'bid'; turn = (dealer + 1) % 4; }
  }
  function startPlay() {
    phase = 'play'; turn = hearts ? hands.findIndex(hand => hand.includes(0)) : (dealer + 1) % 4;
  }
  function exchange() {
    const direction = [1, 3, 2][round % 4];
    const choices = hands.map((hand, i) => i === 0 ? [...selected] : choosePass(hand));
    hands = hands.map((hand, i) => [...hand.filter(card => !choices[i].includes(card)), ...choices[(i + 4 - direction) % 4]].sort((a, b) => a - b));
    note = '传来的牌：' + choices[(4 - direction) % 4].map(face).join(' ');
    selected.clear(); startPlay();
  }
  function bid(value) {
    bids[turn] = value;
    if (bids.every(n => n !== null)) startPlay();
    else turn = (turn + 1) % 4;
  }
  function legal(seat = turn) {
    return legalTrickCards(hands[seat], trick, { hearts, first: tricksDone === 0, broken });
  }
  function play(card) {
    hands[turn].splice(hands[turn].indexOf(card), 1);
    trick.push({ seat: turn, card });
    if (suit(card) === 2) broken = true;
    if (trick.length === 4) {
      winner = trickWinner(trick, trump);
      won[winner]++;
      points[winner] += trick.reduce((sum, entry) => sum + point(entry.card), 0);
      tricksDone++; phase = 'trick';
      note = `${seats[winner]}赢下第 ${tricksDone} 墩。`;
    } else turn = (turn + 1) % 4;
  }
  function finishHand() {
    const gains = hearts ? heartsScores(points) : won.map((n, i) => n + (n === bids[i] ? 10 : 0));
    gains.forEach((amount, i) => { total[i] += amount; });
    const moon = hearts ? points.indexOf(26) : -1;
    note = (moon >= 0 ? `${seats[moon]}独收全红！` : '') + '本手结算：' + gains.map((value, i) => `${seats[i]} +${value}`).join('，');
    if (hearts ? Math.max(...total) >= 100 : round === forecastLengths.length - 1) {
      const best = hearts ? Math.min(...total) : Math.max(...total);
      const leaders = seats.filter((_, i) => total[i] === best);
      over = `${leaders.join('、')}${leaders.length > 1 ? '并列' : ''}获胜。你累计 ${total[0]} ${hearts ? '罚分' : '分'}。`;
      phase = 'done';
    } else phase = 'round';
  }
  function advance() {
    while ((phase === 'bid' || phase === 'play') && turn !== 0) {
      if (phase === 'bid') bid(forecastBid(hands[turn], trump, bids, length));
      else play(chooseCard(legal(), trick, turn, hearts, trump, won[turn] < bids[turn]));
    }
    draw();
    if (over) ui.end(over);
  }
  function click(id) {
    if (id.startsWith('card-')) {
      const card = Number(id.slice(5));
      if (phase === 'pass') {
        if (selected.has(card)) selected.delete(card);
        else if (selected.size < 3) selected.add(card);
        draw(); return;
      }
      if (phase === 'play' && turn === 0 && legal().includes(card)) { note = ''; play(card); advance(); }
    } else if (phase === 'pass' && id === 'exchange' && selected.size === 3) { exchange(); advance(); }
    else if (phase === 'bid' && id.startsWith('bid-')) {
      const amount = Number(id.slice(4));
      if (turn === 0 && forecastBids(length, bids).includes(amount)) { bid(amount); advance(); }
    } else if (phase === 'trick' && id === 'next') {
      if (tricksDone === length) finishHand();
      else { phase = 'play'; trick = []; turn = winner; note = ''; }
      advance();
    } else if (phase === 'round' && id === 'round') {
      round++; dealer = (dealer + 1) % 4; startHand(); advance();
    }
  }
  function draw() {
    const status = phase === 'pass' ? `${passing[round % 4]}三张（已选 ${selected.size}/3）`
      : phase === 'bid' ? '预报你能赢下的墩数' : phase === 'play' ? (trick.length ? '轮到你跟牌' : '轮到你领出') : note;
    const scoreboard = facts(seats.map((name, i) => [name + (hearts ? '' : dealer === i ? ' · 庄' : ''), hearts ? `${total[i]} 罚分 · 本手 ${points[i]}` : `${total[i]} 分 · 墩 ${won[i]}/${bids[i] ?? '待报'}`]));
    const board = seats.map((name, i) => {
      const card = trick.find(entry => entry.seat === i)?.card;
      return `<div class="xc-seat"><small>${name}</small><b class="${card === undefined ? '' : red(card)}">${card === undefined ? '·' : face(card)}</b></div>`;
    }).join('');
    const allowed = phase === 'play' && turn === 0 ? legal() : [];
    const hand = hands[0].map(card => deckButton(card, { selected: phase === 'pass' ? selected.has(card) : undefined, disabled: phase === 'pass' ? selected.size === 3 && !selected.has(card) : !allowed.includes(card) })).join('');
    let controls = '';
    if (phase === 'pass') controls = action('exchange', passing[round % 4] + '三张', { disabled: selected.size !== 3, className: 'xc-primary' });
    if (phase === 'bid') controls = range(length + 1).map(n => action('bid-' + n, n + ' 墩', { disabled: !forecastBids(length, bids).includes(n) })).join('');
    if (phase === 'trick') controls = action('next', tricksDone === length ? '结算本手' : '收牌，下一墩', { className: 'xc-primary' });
    if (phase === 'round') controls = action('round', '发下一手', { className: 'xc-primary' });
    const tag = hearts ? (broken ? '红心已破' : '红心未破') : '将牌 ' + suitNames[trump] + ' ' + face(trumpCard);
    ui.paint(scoreboard + `<div class="xc-field"><span>第 ${round + 1} 手 · ${length} 墩 · ${tag}</span><div class="xc-seats">${board}</div></div>` + zone('你的手牌', hand || '<span class="xc-muted">本手已出完</span>') + (controls ? zone(status, controls, 'xc-actions') : ''));
    api.status(over || [status, note !== status ? note : ''].filter(Boolean).join('。'));
  }
  startHand(); advance();
}
