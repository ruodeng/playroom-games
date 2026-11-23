import test from 'node:test';
import assert from 'node:assert/strict';
import { TOWN, createMonopoly, rollMonopoly, buyProperty, skipProperty, manageProperty, canManage, assets,
  rentAt, settleDebt, declareBankruptcy, endMonopolyTurn, stepMonopolyAI, liquidCash, restoreMonopoly, ranking, redeemCost, chooseMonopolyRoute } from '../src/monopoly.js';
import { FORKS, MAP_POINTS, TILE_TERRAIN, terrainFor } from '../src/monopoly-map.js';

function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function sequence(...values) { let i = 0; return () => values[i++ % values.length]; }
const zero = () => 0;
const saved = state => JSON.stringify({ version: 1, started: true, state });
function owned(index = 2, player = 0, level = 0) {
  const s = createMonopoly(); s.properties[index] = { owner: player, level, mortgaged: false }; return s;
}
function owing(amount, creditor = 1) {
  const s = createMonopoly(); s.players[0].cash = 10; s.phase = 'debt'; s.debt = { amount, creditor }; return s;
}

test('new town has 24 squares, three players, and an independent balance for each', () => {
  const s = createMonopoly(); assert.equal(TOWN.length, 24); assert.deepEqual(s.players.map(p => p.cash), [1200, 1200, 1200]);
  assert.equal(s.phase, 'roll'); assert.equal(s.round, 1); assert.equal(assets(s, 0), 1200);
  s.players[0].cash = 0; assert.equal(s.players[1].cash, 1200);
});
test('rolling moves clockwise, pays salary once, and cannot roll again before ending', () => {
  const s = createMonopoly(); s.players[0].position = 23; const original = structuredClone(s);
  const next = rollMonopoly(s, zero); assert.equal(next.players[0].position, 1); assert.equal(next.players[0].cash, 1400);
  assert.equal(next.phase, 'buy'); assert.deepEqual(next.dice, [1, 1]); assert.equal(rollMonopoly(next, zero), next); assert.deepEqual(s, original);
  s.players[0].position = 22; const onStart = rollMonopoly(s, zero); assert.equal(onStart.players[0].position, 0); assert.equal(onStart.players[0].cash, 1400);
});
test('purchase debits cash once and preserves net assets; skipping and insufficient cash are safe', () => {
  const s = rollMonopoly(createMonopoly(), zero); const next = buyProperty(s);
  assert.equal(next.properties[2].owner, 0); assert.equal(next.players[0].cash, 1060); assert.equal(assets(next, 0), 1200);
  assert.equal(buyProperty(next), next); assert.equal(skipProperty(s).phase, 'end'); assert.equal(s.properties[2].owner, null);
  s.players[0].cash = 139; assert.equal(buyProperty(s), s); assert.equal(skipProperty(s).phase, 'end');
});
test('rent transfers cash exactly once and mortgaged properties collect nothing', () => {
  const s = owned(2, 1, 2); const next = rollMonopoly(s, zero); const rent = rentAt(s, 2);
  assert.equal(next.players[0].cash, 1200 - rent); assert.equal(next.players[1].cash, 1200 + rent); assert.equal(next.phase, 'end');
  s.properties[2].level = 0; s.properties[2].mortgaged = true;
  const free = rollMonopoly(s, zero); assert.equal(rentAt(s, 2), 0); assert.equal(free.players[0].cash, 1200);
});
test('stations charge by the number of unmortgaged stations and cannot be upgraded', () => {
  let s = owned(3); assert.equal(rentAt(s, 3), 40); s.properties[15].owner = 0; assert.equal(rentAt(s, 3), 80);
  s = manageProperty(s, 15, 'mortgage'); assert.equal(rentAt(s, 3), 40); assert.equal(rentAt(s, 15), 0);
  assert.equal(manageProperty(s, 3, 'upgrade'), s);
});
test('houses have three levels; selling returns half of building cost and precedes mortgage', () => {
  let s = owned(); const initialAssets = assets(s, 0);
  for (let i = 0; i < 3; i++) s = manageProperty(s, 2, 'upgrade');
  assert.equal(s.properties[2].level, 3); assert.equal(rentAt(s, 2), 250); assert.equal(s.players[0].cash, 990); assert.equal(assets(s, 0), initialAssets);
  assert.equal(manageProperty(s, 2, 'upgrade'), s); assert.equal(manageProperty(s, 2, 'mortgage'), s);
  for (let i = 0; i < 3; i++) s = manageProperty(s, 2, 'sell');
  assert.equal(s.players[0].cash, 1095); s = manageProperty(s, 2, 'mortgage'); assert.equal(s.players[0].cash, 1165);
  assert.equal(assets(s, 0), 1235); assert.equal(manageProperty(s, 2, 'mortgage'), s);
  s = manageProperty(s, 2, 'redeem'); assert.equal(s.players[0].cash, 1088); assert.equal(s.properties[2].mortgaged, false);
});
test('management rejects wrong owners, forbidden phases, and insufficient funds', () => {
  let s = owned(2, 1); assert.equal(manageProperty(s, 2, 'upgrade'), s);
  s = owned(); s.phase = 'buy'; assert.equal(manageProperty(s, 2, 'mortgage'), s);
  s.phase = 'roll'; s.players[0].cash = 69; assert.equal(manageProperty(s, 2, 'upgrade'), s);
  assert.equal(canManage(s, -1, 'upgrade'), false); assert.equal(canManage(s, 2, 'unknown'), false);
});
test('redemption adds exactly ten percent without floating point overcharging', () => {
  assert.equal(redeemCost(7), 99); assert.equal(redeemCost(10), 121);
  let s = owned(7); s = manageProperty(s, 7, 'mortgage'); s = manageProperty(s, 7, 'redeem');
  assert.equal(s.players[0].cash, 1191);
});
test('park, tax, and positive or negative chance events apply once', () => {
  let s = createMonopoly(); s.players[0].position = 10; assert.equal(rollMonopoly(s, zero).players[0].cash, 1300);
  s.players[0].position = 16; assert.equal(chooseMonopolyRoute(rollMonopoly(s, zero), 17, zero).players[0].cash, 1050);
  s.players[0].position = 4; assert.equal(rollMonopoly(s, sequence(0, 0, 0)).players[0].cash, 1350);
  assert.equal(rollMonopoly(s, sequence(0, 0, .2)).players[0].cash, 1080);
});
test('insufficient rent becomes debt without an early or duplicate creditor payout', () => {
  const s = owned(2, 1, 3); s.players[0].cash = 10;
  const next = rollMonopoly(s, zero); assert.equal(next.phase, 'debt'); assert.deepEqual(next.debt, { amount: 250, creditor: 1 });
  assert.equal(next.players[0].cash, 10); assert.equal(next.players[1].cash, 1200); assert.equal(settleDebt(next), next);
  next.players[0].cash = 300; const paid = settleDebt(next); assert.equal(paid.players[0].cash, 50); assert.equal(paid.players[1].cash, 1450); assert.equal(settleDebt(paid), paid);
});
test('solvent debt can be rescued with house sales and mortgage, not premature bankruptcy', () => {
  let s = owing(100); s.properties[2] = { owner: 0, level: 1, mortgaged: false };
  assert.equal(liquidCash(s, 0), 115); assert.equal(declareBankruptcy(s), s); assert.equal(manageProperty(s, 2, 'upgrade'), s);
  s = manageProperty(s, 2, 'sell'); s = manageProperty(s, 2, 'mortgage'); s = settleDebt(s);
  assert.equal(s.players[0].cash, 15); assert.equal(s.players[1].cash, 1300); assert.equal(s.phase, 'end');
});
test('bankruptcy liquidates collateral, clears ownership, pays creditor, and skips the player', () => {
  const s = owing(500); s.properties[2] = { owner: 0, level: 2, mortgaged: false };
  const next = declareBankruptcy(s); assert.equal(next.players[0].bankrupt, true); assert.equal(next.players[0].cash, 0);
  assert.equal(next.players[1].cash, 1350); assert.deepEqual(next.properties[2], { owner: null, level: 0, mortgaged: false });
  assert.equal(next.turn, 1); assert.equal(next.phase, 'roll'); assert.equal(next.round, 1);
  assert.deepEqual(restoreMonopoly(saved(next)).state, next);
});
test('bank debt is handled without creating cash for another player', () => {
  const s = owing(150, null); const next = declareBankruptcy(s); assert.equal(next.players[1].cash, 1200); assert.equal(next.players[2].cash, 1200);
});
test('last solvent player wins immediately after bankruptcy', () => {
  const s = owing(150); s.players[2].cash = 0; s.players[2].bankrupt = true;
  const next = declareBankruptcy(s); assert.equal(next.status, 'finished'); assert.deepEqual(next.winners, [1]); assert.equal(next.reason, 'last-standing');
  assert.deepEqual(restoreMonopoly(saved(next)).state, next);
});
test('rounds advance only after all seats, skip bankrupt players, and settle ties after 20 rounds', () => {
  let s = createMonopoly(); s.phase = 'end'; s = endMonopolyTurn(s); assert.equal(s.turn, 1); assert.equal(s.round, 1);
  s.phase = 'end'; s = endMonopolyTurn(s); assert.equal(s.turn, 2); assert.equal(s.round, 1);
  s.phase = 'end'; s = endMonopolyTurn(s); assert.equal(s.turn, 0); assert.equal(s.round, 2);
  s.turn = 2; s.round = 20; s.phase = 'end'; s = endMonopolyTurn(s); assert.equal(s.status, 'finished'); assert.deepEqual(s.winners, [0, 1, 2]);
  assert.equal(rollMonopoly(s), s); assert.equal(endMonopolyTurn(s), s); assert.deepEqual(restoreMonopoly(saved(s)).state, s);
  let skipped = createMonopoly(); skipped.players[2].bankrupt = true; skipped.players[2].cash = 0; skipped.turn = 1; skipped.phase = 'end'; skipped = endMonopolyTurn(skipped);
  assert.equal(skipped.turn, 0); assert.equal(skipped.round, 2);
});
test('ranking includes houses and discounted mortgaged land', () => {
  const s = owned(2, 0, 2); assert.equal(assets(s, 0), 1480); assert.equal(ranking(s)[0].id, 0);
  s.properties[2].level = 0; s.properties[2].mortgaged = true; assert.equal(assets(s, 0), 1270);
});
test('AI never advances a human turn; AI debt resolution terminates', () => {
  const s = createMonopoly(); assert.equal(stepMonopolyAI(s), s);
  let next = owing(100, 0); next.turn = 1; next.players[1].cash = 10; next.properties[2] = { owner: 1, level: 1, mortgaged: false };
  for (let i = 0; i < 3; i++) next = stepMonopolyAI(next, zero);
  assert.equal(next.phase, 'end'); assert.equal(next.players[1].cash, 15); assert.equal(next.players[0].cash, 110);
});
test('save parser rejects corrupt ownership, monetary data, phases, and fabricated winners', () => {
  const corruptions = [s => { s.players[0].cash = -1; }, s => { s.properties[0].owner = 0; },
    s => { s.properties[2].level = 1; }, s => { s.properties[3] = { owner: 1, level: 1, mortgaged: false }; },
    s => { s.phase = 'debt'; }, s => { s.phase = 'finished'; }, s => { s.turn = 3; },
    s => { s.round = 21; }, s => { s.winners = [0]; }, s => { s.log = [null]; },
    s => { s.players[1].bankrupt = true; }, s => { s.phase = 'buy'; }, s => { s.reason = 'anything'; }];
  for (const corrupt of corruptions) { const s = createMonopoly(); corrupt(s); assert.throws(() => restoreMonopoly(saved(s))); }
  assert.throws(() => restoreMonopoly('{')); assert.throws(() => restoreMonopoly(null));
  const s = createMonopoly(); s.players[0].name = '<b>injected</b>'; s.extra = true;
  const restored = restoreMonopoly(saved(s)).state; assert.equal(restored.players[0].name, '你'); assert.equal('extra' in restored, false);
});
test('100 seeded complete games preserve valid save states and finish without deadlocks', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const random = seeded(seed); let s = createMonopoly(), steps = 0;
    while (s.status === 'playing' && steps++ < 1500) {
      const before = JSON.stringify(s); let next;
      if (s.turn !== 0) next = stepMonopolyAI(s, random);
      else if (s.phase === 'roll') next = rollMonopoly(s, random);
      else if (s.phase === 'buy') next = s.players[0].cash >= TOWN[s.players[0].position].price + 150 ? buyProperty(s) : skipProperty(s);
      else if (s.phase === 'end') next = endMonopolyTurn(s);
      else if (s.phase === 'route') next = chooseMonopolyRoute(s, FORKS[s.players[0].position][seed % 2].next, random);
      else if (s.players[0].cash >= s.debt.amount) next = settleDebt(s);
      else if (liquidCash(s, 0) < s.debt.amount) next = declareBankruptcy(s);
      else {
        const index = s.properties.findIndex((p, i) => canManage(s, i, 'sell') || canManage(s, i, 'mortgage'));
        next = manageProperty(s, index, canManage(s, index, 'sell') ? 'sell' : 'mortgage');
      }
      assert.notEqual(next, s, `deadlock in seed ${seed}`); assert.equal(JSON.stringify(s), before, 'input was mutated'); s = next;
      assert.deepEqual(restoreMonopoly(saved(s)).state, s, `invalid persisted transition in seed ${seed}`);
      assert.ok(s.players.every(p => p.cash >= 0));
    }
    assert.equal(s.status, 'finished', `seed ${seed} did not finish`); assert.ok(s.winners.length >= 1);
  }
});

test('winding map has a location and terrain illustration for every existing property', () => {
  assert.equal(MAP_POINTS.length, TOWN.length); assert.equal(TILE_TERRAIN.length, TOWN.length);
  for (let i = 0; i < 24; i++) { assert.ok(MAP_POINTS[i][0] > 0 && MAP_POINTS[i][0] < 1000); assert.ok(MAP_POINTS[i][1] > 0 && MAP_POINTS[i][1] < 760); assert.match(terrainFor(i).image, /^\/assets\/monopoly\/[a-z-]+\.png$/); }
});
test('a fork interrupts movement without triggering its event or spending remaining steps', () => {
  const s = createMonopoly(); s.players[0].position = 5;
  const next = rollMonopoly(s, zero); assert.equal(next.phase, 'route'); assert.equal(next.players[0].position, 6);
  assert.equal(next.journey.remaining, 1); assert.deepEqual(next.lastPath, [5, 6]); assert.equal(next.players[0].cash, 1200);
  assert.equal(chooseMonopolyRoute(next, 22), next); assert.equal(buyProperty(next), next); assert.equal(endMonopolyTurn(next), next);
  const scenic = chooseMonopolyRoute(next, 7, zero), shortcut = chooseMonopolyRoute(next, 10, zero);
  assert.equal(scenic.players[0].position, 7); assert.equal(shortcut.players[0].position, 10); assert.equal(shortcut.phase, 'buy');
  assert.deepEqual(shortcut.lastPath, [5, 6, 10]); assert.equal(shortcut.journey, null); assert.deepEqual(next.lastPath, [5, 6]);
});
test('landing exactly on a fork triggers that location and chooses a route on the following roll', () => {
  const s = createMonopoly(); s.players[0].position = 4;
  let next = rollMonopoly(s, zero); assert.equal(next.players[0].position, 6); assert.equal(next.phase, 'end'); assert.equal(next.players[0].cash, 1350);
  next.phase = 'roll'; next = rollMonopoly(next, zero); assert.equal(next.phase, 'route'); assert.equal(next.journey.remaining, 2);
});
test('one roll may meet two forks and salary is awarded only at an actual start crossing', () => {
  const s = createMonopoly(); s.players[0].position = 6;
  let next = rollMonopoly(s, () => .999); assert.equal(next.journey.remaining, 12);
  next = chooseMonopolyRoute(next, 10, zero); assert.equal(next.phase, 'route'); assert.equal(next.players[0].position, 16); assert.equal(next.journey.remaining, 5);
  next = chooseMonopolyRoute(next, 22, zero); assert.equal(next.players[0].position, 2); assert.equal(next.players[0].cash, 1400);
  assert.deepEqual(next.lastPath, [6,10,11,12,13,14,15,16,22,23,0,1,2]);
});
test('route decisions survive saving and old saves are upgraded without losing money or ownership', () => {
  const s = createMonopoly(); s.players[0].position = 5; const route = rollMonopoly(s, zero);
  assert.deepEqual(restoreMonopoly(saved(route)).state, route);
  const corrupt = structuredClone(route); corrupt.journey.remaining = 9; assert.throws(() => restoreMonopoly(saved(corrupt)));
  const teleported = structuredClone(route); teleported.lastPath = [1, 6]; assert.throws(() => restoreMonopoly(saved(teleported)));
  const legacy = owned(7, 0, 2); legacy.players[0].cash = 777; delete legacy.journey; delete legacy.lastPath;
  const restored = restoreMonopoly(saved(legacy)).state; assert.equal(restored.players[0].cash, 777); assert.deepEqual(restored.properties[7], legacy.properties[7]); assert.equal(restored.journey, null); assert.deepEqual(restored.lastPath, []);
});
test('AI selects a safe route instead of landing on an expensive enemy property', () => {
  const s = owned(7, 0, 3); s.turn = 1; s.players[1].position = 5;
  const route = rollMonopoly(s, zero), next = stepMonopolyAI(route, zero);
  assert.equal(next.players[1].position, 10); assert.equal(next.players[1].cash, 1200);
});
