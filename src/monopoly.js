import { FORKS, nextStops } from './monopoly-map.js';
// A compact property game. All transitions are immutable and independently testable.
const land = (name, price, group) => ({ name, price, group, type: 'land', rent: Math.round(price * .18 / 5) * 5 });
export const TOWN = Object.freeze([
  { name: '起点', type: 'start' }, land('青柠小铺', 120, 0), land('街角书店', 140, 0),
  { name: '南站', type: 'station', price: 200 }, land('午后咖啡', 160, 1), land('麦香面包', 180, 1),
  { name: '机会', type: 'chance' }, land('花间小屋', 180, 2), land('拾光画廊', 200, 2),
  { name: '机会', type: 'chance' }, land('森林乐坊', 220, 3), land('露天影院', 240, 3),
  { name: '中央公园', type: 'park' }, land('河畔庭院', 240, 4), land('四季花园', 260, 4),
  { name: '北站', type: 'station', price: 200 }, land('湖光公寓', 280, 5), land('小岛别墅', 300, 5),
  { name: '城市税', type: 'tax' }, land('云端公馆', 300, 6), land('星光酒店', 320, 6),
  { name: '机会', type: 'chance' }, land('日光大厦', 340, 7), land('月色庄园', 360, 7),
].map(Object.freeze));
export const PLAYER_NAMES = ['你', '小麦', '阿橙'];
export const ROUND_LIMIT = 20;
export const SALARY = 200;
export const upgradeCost = index => TOWN[index]?.type === 'land' ? TOWN[index].price / 2 : 0;
export const mortgageValue = index => Math.floor((TOWN[index]?.price || 0) / 2);
export const redeemCost = index => Math.ceil(mortgageValue(index) * 11 / 10);

export function createMonopoly() {
  return { version: 1, players: PLAYER_NAMES.map(name => ({ name, cash: 1200, position: 0, bankrupt: false })),
    properties: TOWN.map(() => ({ owner: null, level: 0, mortgaged: false })),
    turn: 0, round: 1, phase: 'roll', status: 'playing', dice: [0, 0], debt: null, journey: null, lastPath: [],
    log: ['小镇开张！每人带着 1,200 金币出发。'], message: '轮到你了，掷骰子出发吧。', winners: [], reason: null };
}
const clone = state => structuredClone(state);
function tell(state, message) { state.message = message; state.log.unshift(message); state.log.length = Math.min(40, state.log.length); }
export function assets(state, player) {
  return state.players[player].cash + state.properties.reduce((sum, property, index) => property.owner !== player ? sum :
    sum + (property.mortgaged ? mortgageValue(index) : TOWN[index].price) + property.level * upgradeCost(index), 0);
}
export function rentAt(state, index) {
  const tile = TOWN[index], property = state.properties[index];
  if (!tile?.price || property.owner === null || property.mortgaged) return 0;
  if (tile.type === 'station') return 40 * state.properties.filter((p, i) => p.owner === property.owner && !p.mortgaged && TOWN[i].type === 'station').length;
  return tile.rent * [1, 3, 6, 10][property.level];
}
export function ranking(state) {
  return state.players.map((player, id) => ({ id, ...player, assets: assets(state, id) }))
    .sort((a, b) => Number(a.bankrupt) - Number(b.bankrupt) || b.assets - a.assets || a.id - b.id);
}
function finish(state, reason) {
  state.status = 'finished'; state.phase = 'finished'; state.debt = null; state.reason = reason;
  const ranks = ranking(state); state.winners = ranks.filter(p => !p.bankrupt && p.assets === ranks[0].assets).map(p => p.id);
  tell(state, `${reason === 'last-standing' ? '只剩一位玩家，本局结束' : '20 轮结束'}。${state.winners.map(id => PLAYER_NAMES[id]).join('、')}${state.winners.length > 1 ? '并列' : ''}获胜！`);
}
function charge(state, amount, creditor = null) {
  const player = state.players[state.turn];
  if (player.cash < amount) {
    state.debt = { amount, creditor }; state.phase = 'debt';
    tell(state, `${player.name}需要支付 ${amount} 金币，现金不足。请卖房或抵押筹款。`);
  } else {
    player.cash -= amount; if (creditor !== null) state.players[creditor].cash += amount;
    state.phase = 'end';
  }
}
const EVENTS = [
  { text: '社区奖励', amount: 150 }, { text: '临时维修', amount: -120 },
  { text: '市集分红', amount: 200 }, { text: '道路维护', amount: -100 },
  { text: '幸运红包', amount: 100 }, { text: '旅行支出', amount: -80 },
];
const randomIndex = (random, size) => Math.min(size - 1, Math.max(0, Math.floor(random() * size)));
export function rollMonopoly(state, random = Math.random) {
  if (state.status !== 'playing' || state.phase !== 'roll') return state;
  const next = clone(state), player = next.players[next.turn];
  next.dice = [randomIndex(random, 6) + 1, randomIndex(random, 6) + 1];
  next.journey = { remaining: next.dice[0] + next.dice[1] }; next.lastPath = [player.position];
  tell(next, `${player.name}掷出 ${next.dice.join(' + ')}，沿小镇道路前进。`);
  return travel(next, random);
}
function takeStep(next, destination) {
  const player = next.players[next.turn];
  if (destination === 0) { player.cash += SALARY; tell(next, `${player.name}经过起点，领取 ${SALARY} 金币。`); }
  player.position = destination; next.lastPath.push(destination); next.journey.remaining--;
}
function travel(next, random) {
  const player = next.players[next.turn];
  while (next.journey.remaining > 0) {
    if (FORKS[player.position]) {
      next.phase = 'route'; tell(next, `${player.name}来到岔路口，还能走 ${next.journey.remaining} 步。选择接下来的路线。`); return next;
    }
    takeStep(next, (player.position + 1) % TOWN.length);
  }
  next.journey = null;
  return landOn(next, random);
}
export function chooseMonopolyRoute(state, destination, random = Math.random) {
  if (state.status !== 'playing' || state.phase !== 'route' || !state.journey || !nextStops(state.players[state.turn].position).includes(destination)) return state;
  const next = clone(state), option = FORKS[next.players[next.turn].position].find(item => item.next === destination);
  tell(next, `${PLAYER_NAMES[next.turn]}选择了「${option.name}」。`); takeStep(next, destination); return travel(next, random);
}
function landOn(next, random) {
  const player = next.players[next.turn];
  const index = player.position, tile = TOWN[index], property = next.properties[index]; next.phase = 'end';
  tell(next, `${player.name}来到「${tile.name}」。`);
  if (tile.price) {
    if (property.owner === null) { next.phase = 'buy'; tell(next, `${tile.name}售价 ${tile.price}，${player.name}可以购买或跳过。`); }
    else if (property.owner !== next.turn && !property.mortgaged) {
      const amount = rentAt(next, index); tell(next, `${player.name}向${PLAYER_NAMES[property.owner]}支付 ${amount} 金币租金。`); charge(next, amount, property.owner);
    } else tell(next, property.mortgaged ? '这处地产已抵押，本次免租。' : `${player.name}回到自己的地产。`);
  } else if (tile.type === 'chance') {
    const event = EVENTS[randomIndex(random, EVENTS.length)];
    tell(next, `${player.name}抽到「${event.text}」：${event.amount > 0 ? '+' : '−'}${Math.abs(event.amount)} 金币。`);
    if (event.amount > 0) player.cash += event.amount; else charge(next, -event.amount);
  } else if (tile.type === 'park') { player.cash += 100; tell(next, `${player.name}在公园休息，获得 100 金币补给。`); }
  else if (tile.type === 'tax') { tell(next, `${player.name}缴纳城市税 150 金币。`); charge(next, 150); }
  return next;
}
export function buyProperty(state) {
  const index = state.players[state.turn].position, price = TOWN[index].price;
  if (state.status !== 'playing' || state.phase !== 'buy' || !price || state.properties[index].owner !== null || state.players[state.turn].cash < price) return state;
  const next = clone(state); next.players[next.turn].cash -= price; next.properties[index].owner = next.turn; next.phase = 'end';
  tell(next, `${PLAYER_NAMES[next.turn]}用 ${price} 金币买下「${TOWN[index].name}」。`); return next;
}
export function skipProperty(state) {
  if (state.status !== 'playing' || state.phase !== 'buy') return state;
  const next = clone(state); next.phase = 'end'; tell(next, `${PLAYER_NAMES[next.turn]}暂时不买，留一点现金。`); return next;
}
export function canManage(state, index, action) {
  const property = state.properties[index], player = state.players[state.turn];
  if (state.status !== 'playing' || !['roll', 'end', 'debt'].includes(state.phase) || !property || property.owner !== state.turn) return false;
  if (action === 'upgrade') return state.phase !== 'debt' && TOWN[index].type === 'land' && !property.mortgaged && property.level < 3 && player.cash >= upgradeCost(index);
  if (action === 'sell') return property.level > 0;
  if (action === 'mortgage') return !property.mortgaged && property.level === 0;
  if (action === 'redeem') return state.phase !== 'debt' && property.mortgaged && player.cash >= redeemCost(index);
  return false;
}
export function manageProperty(state, index, action) {
  if (!canManage(state, index, action)) return state;
  const next = clone(state), property = next.properties[index], player = next.players[next.turn];
  if (action === 'upgrade') { player.cash -= upgradeCost(index); property.level++; }
  if (action === 'sell') { player.cash += Math.floor(upgradeCost(index) / 2); property.level--; }
  if (action === 'mortgage') { player.cash += mortgageValue(index); property.mortgaged = true; }
  if (action === 'redeem') { player.cash -= redeemCost(index); property.mortgaged = false; }
  tell(next, `${player.name}${{ upgrade: '升级', sell: '卖出一栋房屋：', mortgage: '抵押', redeem: '赎回' }[action]}「${TOWN[index].name}」。`);
  return next;
}
export function settleDebt(state) {
  if (state.status !== 'playing' || state.phase !== 'debt' || state.players[state.turn].cash < state.debt.amount) return state;
  const next = clone(state), { amount, creditor } = next.debt; next.debt = null;
  charge(next, amount, creditor); tell(next, `${PLAYER_NAMES[next.turn]}已偿还 ${amount} 金币欠款。`); return next;
}
export function liquidCash(state, id) {
  return state.players[id].cash + state.properties.reduce((sum, p, index) => p.owner !== id ? sum : sum +
    p.level * Math.floor(upgradeCost(index) / 2) + (p.mortgaged ? 0 : mortgageValue(index)), 0);
}
export function declareBankruptcy(state) {
  if (state.status !== 'playing' || state.phase !== 'debt' || liquidCash(state, state.turn) >= state.debt.amount) return state;
  const next = clone(state), player = next.players[next.turn];
  // Liquidation pays the creditor what remains; the bank reclaims all property.
  if (next.debt.creditor !== null) next.players[next.debt.creditor].cash += liquidCash(next, next.turn);
  player.cash = 0; player.bankrupt = true;
  next.properties.forEach(p => { if (p.owner === next.turn) { p.owner = null; p.level = 0; p.mortgaged = false; } });
  next.debt = null; next.phase = 'end'; tell(next, `${player.name}资不抵债，破产退场。地产回到市场。`);
  if (next.players.filter(p => !p.bankrupt).length === 1) finish(next, 'last-standing');
  else return endMonopolyTurn(next);
  return next;
}
export function endMonopolyTurn(state) {
  if (state.status !== 'playing' || state.phase !== 'end') return state;
  const next = clone(state); let id = next.turn;
  do { id = (id + 1) % 3; if (id === 0) next.round++; } while (next.players[id].bankrupt);
  if (next.round > ROUND_LIMIT) { next.round = ROUND_LIMIT; finish(next, 'round-limit'); return next; }
  next.turn = id; next.phase = 'roll'; next.dice = [0, 0]; next.lastPath = []; next.journey = null;
  tell(next, `第 ${next.round} 轮，轮到${PLAYER_NAMES[id]}。`); return next;
}
export function stepMonopolyAI(state, random = Math.random) {
  if (state.status !== 'playing' || state.turn === 0) return state;
  const player = state.players[state.turn], owned = state.properties.map((p, i) => p.owner === state.turn ? i : -1).filter(i => i >= 0);
  if (state.phase === 'route') {
    const options = FORKS[player.position].map(option => {
      let target = option.next;
      for (let step = 1; step < state.journey.remaining; step++) target = nextStops(target)[0];
      const property = state.properties[target], tile = TOWN[target];
      const value = property.owner !== null && property.owner !== state.turn ? -rentAt(state, target) : tile.price && property.owner === null ? 60 : tile.type === 'park' ? 100 : tile.type === 'tax' ? -150 : 0;
      return { ...option, value };
    }).sort((a, b) => b.value - a.value);
    return chooseMonopolyRoute(state, options[0].next, random);
  }
  if (state.phase === 'debt') {
    if (player.cash >= state.debt.amount) return settleDebt(state);
    if (liquidCash(state, state.turn) < state.debt.amount) return declareBankruptcy(state);
    const house = owned.find(i => canManage(state, i, 'sell')); if (house !== undefined) return manageProperty(state, house, 'sell');
    const property = owned.find(i => canManage(state, i, 'mortgage')); if (property !== undefined) return manageProperty(state, property, 'mortgage');
  }
  if (state.phase === 'buy') return player.cash >= TOWN[player.position].price + 180 ? buyProperty(state) : skipProperty(state);
  if (state.phase === 'end') return endMonopolyTurn(state);
  if (state.phase === 'roll') {
    const redeem = owned.find(i => canManage(state, i, 'redeem') && player.cash - redeemCost(i) >= 500);
    if (redeem !== undefined) return manageProperty(state, redeem, 'redeem');
    const upgrade = owned.find(i => canManage(state, i, 'upgrade') && player.cash - upgradeCost(i) >= 500);
    if (upgrade !== undefined) return manageProperty(state, upgrade, 'upgrade');
    return rollMonopoly(state, random);
  }
  return state;
}

export function restoreMonopoly(raw) {
  const envelope = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const s = envelope?.state, integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
  const fail = () => { throw new Error('大富翁存档无效'); };
  if (envelope?.version !== 1 || typeof envelope.started !== 'boolean' || !s || s.version !== 1 ||
      !integer(s.turn, 0, 2) || !integer(s.round, 1, ROUND_LIMIT) || !['playing', 'finished'].includes(s.status) ||
      !['roll', 'route', 'buy', 'end', 'debt', 'finished'].includes(s.phase) || !Array.isArray(s.players) || s.players.length !== 3 ||
      !Array.isArray(s.properties) || s.properties.length !== 24 || !Array.isArray(s.dice) || s.dice.length !== 2 ||
      !s.dice.every(n => integer(n, 0, 6)) || !Array.isArray(s.log) || s.log.length > 40 ||
      !s.log.every(line => typeof line === 'string' && line.length <= 200) || typeof s.message !== 'string' || s.message.length > 200 ||
      !Array.isArray(s.winners) || !s.winners.every(id => integer(id, 0, 2)) || new Set(s.winners).size !== s.winners.length) fail();
  s.players.forEach(p => { if (!p || !integer(p.cash, 0, 1000000) || !integer(p.position, 0, 23) || typeof p.bankrupt !== 'boolean' || (p.bankrupt && p.cash !== 0)) fail(); });
  s.properties.forEach((p, i) => { if (!p || !(p.owner === null || integer(p.owner, 0, 2)) || !integer(p.level, 0, 3) || typeof p.mortgaged !== 'boolean' ||
    (p.owner !== null && (!TOWN[i].price || s.players[p.owner].bankrupt)) || (p.owner === null && (p.level || p.mortgaged)) ||
    (p.level && (TOWN[i].type !== 'land' || p.mortgaged))) fail(); });
  if (s.status === 'playing') {
    if (s.phase === 'finished' || s.players[s.turn].bankrupt || s.winners.length || s.reason !== null || s.players.filter(p => !p.bankrupt).length < 2) fail();
    if (s.phase === 'buy' && (!TOWN[s.players[s.turn].position].price || s.properties[s.players[s.turn].position].owner !== null)) fail();
  } else {
    if (s.phase !== 'finished' || !['round-limit', 'last-standing'].includes(s.reason) || !s.winners.length) fail();
    const ranks = ranking(s), winners = ranks.filter(p => !p.bankrupt && p.assets === ranks[0].assets).map(p => p.id);
    if (JSON.stringify(winners) !== JSON.stringify(s.winners) || (s.reason === 'round-limit' && s.round !== ROUND_LIMIT) ||
      (s.reason === 'last-standing' && s.players.filter(p => !p.bankrupt).length !== 1)) fail();
  }
  if (s.phase === 'debt') {
    if (!s.debt || !integer(s.debt.amount, 1, 100000) || !(s.debt.creditor === null || integer(s.debt.creditor, 0, 2)) ||
      (s.debt.creditor !== null && (s.debt.creditor === s.turn || s.players[s.debt.creditor].bankrupt))) fail();
  } else if (s.debt !== null) fail();
  const journey = s.journey ?? null, lastPath = s.lastPath ?? [];
  if (!Array.isArray(lastPath) || lastPath.length > 13 || !lastPath.every(id => integer(id, 0, 23)) ||
    lastPath.some((id, i) => i > 0 && !nextStops(lastPath[i - 1]).includes(id))) fail();
  if (s.phase === 'route') {
    if (!journey || !integer(journey.remaining, 1, 12) || !FORKS[s.players[s.turn].position] ||
      lastPath.at(-1) !== s.players[s.turn].position || journey.remaining + lastPath.length - 1 !== s.dice[0] + s.dice[1]) fail();
  } else if (journey !== null) fail();
  // Rebuild a whitelist, never adopt extra properties from persisted data.
  return { started: envelope.started, state: { version: 1, players: s.players.map((p, i) => ({ name: PLAYER_NAMES[i], cash: p.cash, position: p.position, bankrupt: p.bankrupt })),
    properties: s.properties.map(p => ({ owner: p.owner, level: p.level, mortgaged: p.mortgaged })), turn: s.turn, round: s.round,
    phase: s.phase, status: s.status, dice: [...s.dice], debt: s.debt ? { amount: s.debt.amount, creditor: s.debt.creditor } : null,
    log: [...s.log], message: s.message, winners: [...s.winners], reason: s.reason,
    journey: journey ? { remaining: journey.remaining } : null, lastPath: [...lastPath] } };
}
