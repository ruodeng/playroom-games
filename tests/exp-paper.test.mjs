import assert from 'node:assert/strict';
import test from 'node:test';
import { games } from '../src/expansion/paper-catalog.js';
import {
  akari, binaryAnalysis, blank, bridgesSolved, colorMap, eachCell, galleryAnalysis, hashi,
  islandAnalysis, loopAnalysis, mapAnalysis, nonogramMatches, nonograms, nurikabe, range,
  rectangleSelection, runs, sameLine, shikaku, slitherlink, takuzu, tentAnalysis, tents, towerAnalysis,
} from '../src/expansion/paper-models.js';

const digits = text => [...text].map(Number);
const changed = (board, index, value) => board.map((cell, i) => i === index ? value : cell);
const marks = (side, positions) => eachCell(side).map(i => Number(positions.includes(i)));

test('纸笔谜题目录提供十个可计时的游戏', () => {
  assert.deepEqual(games.map(game => game.name), [
    '数织', '数桥', '数回', '帐篷与树', '摩天楼', '矩形分割', '孤岛成海', '四色地图', '美术馆', '黑白二进制',
  ]);
  assert.equal(new Set(games.map(game => game.id)).size, 10);
  assert.ok(games.every(game => game.metric.unit === '秒' && game.metric.direction === 'asc'));
});

test('数织的三个尺寸都只有一个同时匹配行列的答案', () => {
  assert.deepEqual(nonograms.map(game => game.side), [5, 8, 10]);
  for (const puzzle of nonograms) {
    const { side, rows, columns } = puzzle;
    const combinations = range(2 ** side).map(i => digits(i.toString(2).padStart(side, '0')));
    const options = clue => combinations.filter(line => sameLine(runs(line), clue));
    const rowOptions = rows.map(options);
    const answers = [];
    function search(board, columnOptions) {
      const row = board.length / side;
      if (row === side) {
        answers.push(board);
        return;
      }
      for (const line of rowOptions[row]) {
        const matching = columnOptions.map((entries, i) => entries.filter(column => column[row] === line[i]));
        if (matching.every(entries => entries.length)) search([...board, ...line], matching);
      }
    }
    search([], columns.map(options));
    assert.equal(answers.length, 1, `${side}×${side}`);
    const match = nonogramMatches(answers[0], puzzle);
    assert.ok(match.rows.every(Boolean) && match.columns.every(Boolean));
    const wrong = nonogramMatches(changed(answers[0], 0, 1 - answers[0][0]), puzzle);
    assert.equal(wrong.rows[0], false);
    assert.equal(wrong.columns[0], false);
  }
});

test('数桥的合法桥梁贯通群岛，且数回要求闭环', () => {
  const bridges = [1, 1, 1, 0, 1, 2, 0, 2, 0, 2, 1, 0, 2, 1, 2, 1, 1];
  assert.equal(bridges.length, hashi.edges.length);
  assert.ok(bridgesSolved(bridges));
  assert.equal(bridgesSolved(changed(bridges, 5, 1)), false);

  const loop = blank(slitherlink.edges.length);
  digits('0110011110110101001111011').forEach((inside, i) => {
    if (inside) slitherlink.cells[i].forEach(edge => { loop[edge] = 1 - loop[edge]; });
  });
  assert.ok(loopAnalysis(loop).solved);
  assert.equal(loopAnalysis(changed(loop, loop.indexOf(1), 2)).solved, false);
});

test('帐篷和摩天楼分别满足配对、行列与视角线索', () => {
  const camp = marks(tents.side, [2, 5, 14, 17, 20, 29, 32, 41, 45]);
  const laidOut = tentAnalysis(camp);
  assert.ok(laidOut.solved);
  assert.equal(laidOut.matching, tents.trees.size);
  assert.ok(tentAnalysis(changed(camp, 8, 1)).conflicts.has(8));

  const city = digits('2143432114323214');
  assert.ok(towerAnalysis(city).solved);
  assert.equal(towerAnalysis(changed(city, 0, 1)).solved, false);
});

test('矩形分割拒绝面积错误及重叠，并可完整铺满棋盘', () => {
  const board = blank(shikaku.side ** 2, -1);
  assert.match(rectangleSelection(board, 0, 6).error, /面积/);
  for (const [start, end] of [[0, 13], [2, 5], [8, 15], [10, 23], [18, 26], [21, 27], [28, 35], [30, 33]]) {
    const result = rectangleSelection(board, start, end);
    assert.ok(result.cells);
    result.cells.forEach(i => { board[i] = result.clue; });
    assert.match(rectangleSelection(board, start, end).error, /覆盖/);
  }
  assert.ok(board.every(i => shikaku.clues.has(i)));
});

test('孤岛成海和四色地图验证连接关系', () => {
  const ocean = digits('222121111111212221111121122121211121');
  assert.ok([...nurikabe.clues.keys()].every(i => ocean[i] === 2));
  assert.ok(islandAnalysis(ocean).solved);
  assert.equal(islandAnalysis(changed(ocean, 25, 1)).solved, false);

  const colors = [1, 2, 3, 4, 2, 2, 3, 3, 1];
  assert.equal(colors.length, colorMap.names.length);
  assert.ok(mapAnalysis(colors).solved);
  assert.ok(mapAnalysis(changed(colors, 3, 1)).conflicts.has(3));
});

test('美术馆验证照明与相邻灯数，黑白二进制验证行列约束', () => {
  const lamps = marks(akari.side, [1, 4, 6, 11, 14, 22, 24, 27, 31, 35]);
  assert.ok(galleryAnalysis(lamps).solved);
  assert.ok(galleryAnalysis(changed(lamps, 0, 1)).conflicts.has(1));
  assert.equal(galleryAnalysis(changed(lamps, 6, 0)).solved, false);

  const binary = digits('010011101100101001010110001011110100').map(i => i + 1);
  assert.ok(takuzu.clues.every((clue, i) => !clue || clue === binary[i]));
  assert.ok(binaryAnalysis(binary).solved);
  assert.equal(binaryAnalysis(changed(binary, 6, 1)).solved, false);
});
