import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EXPANSION_GAMES } from '../src/expansion-catalog.js';
import { challengeRandom } from '../src/expansion-runtime.js';
import { getRecordBoardById } from '../src/record-catalog.js';
import { SITE_GAMES } from '../src/site-games.js';
import { getPage } from '../src/site-pages.js';
import { isPublicAsset } from '../scripts/public-assets.mjs';

test('each new game has a public module, its own lobby link, Chinese rules and the matching leaderboard', async () => {
  assert.equal(EXPANSION_GAMES.length, 100);
  assert.equal(new Set(SITE_GAMES.map(game => game.id)).size, 132);
  const groups = Map.groupBy(EXPANSION_GAMES, game => game.group);
  assert.equal(groups.size, 10);
  for (const [group, games] of groups) {
    assert.equal(games.length, 10);
    assert.equal(SITE_GAMES.filter(game => game.category === games[0].category).length, 10);
    const modulePath = '/src/expansion/' + group + '.js';
    assert.equal(isPublicAsset(modulePath), true);
    assert.equal(typeof (await import('..' + modulePath)).mount, 'function');
    for (const game of games) {
      assert.equal(getPage('/games/' + game.id)?.name, game.name);
      assert.ok(game.rules.length >= 2 && game.rules.every(rule => /\p{Script=Han}/u.test(rule)));
      const board = getRecordBoardById(game.id);
      assert.equal(Boolean(board), Boolean(game.metric));
      if (board) assert.deepEqual([board.unit, board.direction], [game.metric.unit, game.metric.direction]);
    }
  }
  const template = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(!/<script[^>]+src="[^"]*\/expansion\//.test(template), 'gameplay must load on demand');
});

test('a ranked game replays the same random challenge on a fresh start', () => {
  const draw = id => Array.from({length: 16}, challengeRandom(id));
  const game = draw('pinball');
  assert.deepEqual(game, draw('pinball'));
  assert.notDeepEqual(game, draw('tower-stack'));
  assert.ok(game.every(x => x >= 0 && x < 1));
});
