import test from 'node:test';
import assert from 'node:assert/strict';
import { createConnect, moveConnect, tickConnect, connectLanding, connectResult, chooseConnectMove } from '../src/connect.js';
import { createReversi, moveReversi, tickReversi, reversiFlips, reversiMoves, reversiScore, chooseReversiMove } from '../src/reversi.js';
import { createBattle, placeFleet, shootBattle, tickBattle, sunkShips, chooseBattleShot } from '../src/battleship.js';
import { createDots, moveDots, tickDots, chooseDotsMove, dotsScore, DOT_BOX_EDGES } from '../src/dots.js';
import { createHanoi, moveHanoi, undoHanoi } from '../src/hanoi.js';
import { BOARD_GAMES } from '../src/board-pack.js';

function random(seed) { return () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }; }
function deepFreeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); } return value; }

test('five complete board definitions expose the shared adapter contract', () => {
  assert.deepEqual(BOARD_GAMES.map(game => [game.id, game.number]), [['connect', '023'], ['reversi', '024'], ['battleship', '025'], ['dots', '026'], ['hanoi', '027']]);
  for (const game of BOARD_GAMES) { assert.equal(typeof game.setup, 'function'); assert.ok(game.rules.length >= 3); assert.ok(game.art && game.icon && game.intro); }
});

test('connect gravity, illegal/full columns and immutable moves', () => {
  let game = deepFreeze(createConnect());
  assert.equal(moveConnect(game, -1), game); assert.equal(moveConnect(game, 0, 2), game);
  const next = moveConnect(game, 0); assert.equal(next.board[35], 1); assert.equal(game.board[35], 0);
  game = next;
  for (let i = 0; i < 5; i++) game = moveConnect(game, 0, game.turn);
  assert.equal(connectLanding(game.board, 0), -1); assert.equal(moveConnect(game, 0, game.turn), game);
});

test('connect recognizes all four directions and never wraps board edges', () => {
  for (const line of [[35, 36, 37, 38], [14, 21, 28, 35], [14, 22, 30, 38], [20, 26, 32, 38]]) {
    const board = Array(42).fill(0); line.forEach(i => board[i] = 1); assert.equal(connectResult(board).winner, 1);
  }
  const board = Array(42).fill(0); [5, 6, 7, 8].forEach(i => board[i] = 2); assert.equal(connectResult(board).winner, 0);
});

test('connect AI wins immediately, blocks immediate threats and obeys tick delay', () => {
  for (const player of [1, 2]) {
    const board = Array(42).fill(0); [35, 36, 37].forEach(i => board[i] = player); assert.equal(chooseConnectMove(board), 3);
  }
  let game = moveConnect(createConnect(), 3);
  assert.equal(tickConnect(game, 100).moves, 1); game = tickConnect(game, 1000); assert.equal(game.moves, 2); assert.equal(game.turn, 1);
  game = createConnect(); for (const column of [0, 6, 1, 6, 2, 5, 3]) game = moveConnect(game, column, game.turn);
  assert.equal(game.status, 'won'); assert.equal(tickConnect(game, 1000), game); assert.equal(moveConnect(game, 4), game);
  const board = Array.from({ length: 42 }, (_, i) => (Math.floor(i / 7) % 2 ? [2, 2, 1, 1, 2, 2, 1] : [1, 1, 2, 2, 1, 1, 2])[i % 7]);
  board[0] = 0; assert.equal(connectResult(board).winner, 0);
  assert.equal(moveConnect({ ...createConnect(), board, moves: 41 }, 0).status, 'draw');
});

test('connect randomized legal games with searched AI reach a consistent terminal state', () => {
  for (let seed = 1; seed <= 3; seed++) {
    const rng = random(seed); let game = createConnect();
    while (game.status === 'playing') {
      const available = Array.from({ length: 7 }, (_, i) => i).filter(i => connectLanding(game.board, i) >= 0);
      game = game.turn === 1 ? moveConnect(deepFreeze(game), available[Math.floor(rng() * available.length)]) : tickConnect(deepFreeze(game), 1000);
      assert.ok(game.moves <= 42);
    }
    assert.equal(game.board.filter(Boolean).length, game.moves);
    assert.equal(game.status, connectResult(game.board).winner === 1 ? 'won' : connectResult(game.board).winner === 2 ? 'lost' : 'draw');
  }
});

test('reversi legal opening, multi-direction flipping and immutable invalid moves', () => {
  const game = deepFreeze(createReversi()); assert.deepEqual(reversiMoves(game.board, 1), [19, 26, 37, 44]);
  assert.equal(moveReversi(game, 0), game);
  const next = moveReversi(game, 19); assert.deepEqual(reversiScore(next.board), [4, 1]); assert.equal(game.board[27], 2);
  assert.equal(tickReversi(next, 100).moves, 1); assert.equal(tickReversi(next, 1000).moves, 2);
  const board = Array(64).fill(0); [20, 33, 35].forEach(i => board[i] = 1); [18, 19, 25, 26].forEach(i => board[i] = 2);
  assert.deepEqual(reversiFlips(board, 17, 1).sort((a, b) => a - b), [18, 19, 25, 26]);
});

test('reversi AI values corners and games auto-pass and finish without illegal turns', () => {
  const board = Array(64).fill(0); board[1] = 2; board[2] = 1; board[27] = 2; board[28] = 1;
  assert.equal(chooseReversiMove(board, 1), 0);
  let observedPass = false;
  for (let seed = 1; seed <= 24; seed++) {
    const rng = random(seed); let game = createReversi(), count = 0;
    while (game.status === 'playing') {
      const legal = reversiMoves(game.board, game.turn); assert.ok(legal.length);
      game = game.turn === 1 ? moveReversi(deepFreeze(game), legal[Math.floor(rng() * legal.length)]) : tickReversi(deepFreeze(game), 1000);
      observedPass ||= !!game.passed; count++; assert.ok(count <= 60);
    }
    assert.equal(reversiMoves(game.board, 1).length + reversiMoves(game.board, 2).length, 0);
    const [human, ai] = reversiScore(game.board); assert.equal(game.status, human > ai ? 'won' : human < ai ? 'lost' : 'draw');
    assert.equal(tickReversi(game, 1000), game);
  }
  assert.ok(observedPass, 'at least one generated game exercises automatic passing');
});

test('reversi can finish early with empty cells, including a draw', () => {
  const board = Array(64).fill(0); board[0] = 1; board[1] = 2;
  const game = moveReversi({ ...createReversi(), board }, 2); assert.equal(game.status, 'won'); assert.ok(game.board.includes(0));
  // The only remaining capture adds one black and flips one white: 1/4 becomes 3/3.
  const tieBoard = Array(64).fill(0); tieBoard[0] = 1; [1, 40, 41, 42].forEach(i => tieBoard[i] = 2);
  const tie = moveReversi({ ...createReversi(), board: tieBoard }, 2); assert.equal(tie.status, 'draw');
});

test('battleship fleet placement is bounded, deterministic, straight and non-overlapping', () => {
  assert.deepEqual(placeFleet(random(12)), placeFleet(random(12)));
  for (const rng of [() => 0, () => 0.999999, random(8)]) {
    const fleet = placeFleet(rng); assert.deepEqual(fleet.map(ship => ship.length), [3, 2, 2]); assert.equal(new Set(fleet.flat()).size, 7);
    for (const ship of fleet) { assert.ok(ship.every(i => i >= 0 && i < 49)); const step = ship[1] - ship[0]; assert.ok(step === 1 || step === 7); if (step === 1) assert.ok(ship.every(i => Math.floor(i / 7) === Math.floor(ship[0] / 7))); }
  }
});

test('battleship hit/miss/sunk, no duplicates, alternation and frozen state', () => {
  const initial = deepFreeze(createBattle(random(4))), hit = initial.enemyFleet[0][0];
  let game = shootBattle(initial, hit); assert.equal(game.ownShots[hit], 2); assert.equal(initial.ownShots[hit], 0);
  assert.equal(shootBattle(game, hit), game); assert.equal(tickBattle(game, 100, () => 0).moves, 1);
  game = tickBattle(deepFreeze(game), 1000, () => 0); assert.equal(game.moves, 2); assert.equal(game.turn, 1); assert.equal(shootBattle(game, hit), game);
  const shots = Array(49).fill(0); initial.enemyFleet[0].forEach(i => shots[i] = 2); assert.equal(sunkShips(initial.enemyFleet, shots).length, 1);
  const sea = game.enemyFleet.flat(), miss = game.ownShots.findIndex((shot, i) => !shot && !sea.includes(i)); assert.equal(shootBattle(game, miss).ownShots[miss], 1);
});

test('battleship AI targets observed neighbors and never repeats a shot', () => {
  const shots = Array(49).fill(0); shots[24] = 2;
  for (let seed = 1; seed <= 10; seed++) assert.ok([17, 23, 25, 31].includes(chooseBattleShot(shots, [], random(seed))));
  shots.fill(1); shots[48] = 0; assert.equal(chooseBattleShot(shots, [], () => 0), 48); shots[48] = 1; assert.equal(chooseBattleShot(shots), -1);
});

test('battleship legal complete games stop on sinking all ships and preserve shot counts', () => {
  for (let seed = 1; seed <= 5; seed++) {
    const rng = random(seed); let game = createBattle(rng);
    while (game.status === 'playing') {
      const before = game.moves;
      game = game.turn === 1 ? shootBattle(deepFreeze(game), chooseBattleShot(game.ownShots, sunkShips(game.enemyFleet, game.ownShots).flat(), rng)) : tickBattle(deepFreeze(game), 1000, rng);
      assert.equal(game.moves, before + 1); assert.ok(game.moves <= 97);
    }
    assert.equal(game.moves, game.ownShots.filter(Boolean).length + game.enemyShots.filter(Boolean).length);
    assert.equal(sunkShips(game.status === 'won' ? game.enemyFleet : game.ownFleet, game.status === 'won' ? game.ownShots : game.enemyShots).length, 3);
    assert.equal(shootBattle(game, 0), game); assert.equal(tickBattle(game, 1000), game);
  }
});

test('battleship explicit human win and AI win finish immediately', () => {
  let game = createBattle(() => 0); game = { ...game, enemyFleet: [[0]], ownShots: Array(49).fill(0) };
  assert.equal(shootBattle(game, 0).status, 'won');
  game = { ...game, ownFleet: [[0]], turn: 2, wait: 0 }; assert.equal(tickBattle(game, 1000, () => 0).status, 'lost');
});

test('dots closes two boxes with one line and grants extra turns to both players', () => {
  for (const player of [1, 2]) {
    const initial = createDots(), edges = [...initial.edges]; [0, 3, 12, 1, 4, 14].forEach(i => edges[i] = 1);
    const game = deepFreeze({ ...initial, edges, turn: player }); assert.equal(chooseDotsMove(game), 13);
    const next = player === 1 ? moveDots(game, 13) : tickDots(game, 1000);
    assert.equal(next.boxes[0], player); assert.equal(next.boxes[1], player); assert.equal(next.turn, player); assert.equal(game.edges[13], 0);
    assert.equal(moveDots(next, 13, player), next);
  }
});

test('dots AI obeys delay, safe lines and legal complete games own every box exactly once', () => {
  const opening = moveDots(createDots(), 0); assert.equal(tickDots(opening, 100).edges.filter(Boolean).length, 1);
  for (let seed = 1; seed <= 12; seed++) {
    const rng = random(seed); let game = createDots(), moves = 0;
    while (game.status === 'playing') {
      const legal = game.edges.flatMap((edge, i) => edge ? [] : [i]);
      game = game.turn === 1 ? moveDots(deepFreeze(game), legal[Math.floor(rng() * legal.length)]) : tickDots(deepFreeze(game), 1000); moves++; assert.ok(moves <= 24);
    }
    assert.equal(moves, 24); assert.equal(game.boxes.filter(Boolean).length, 9); assert.ok(DOT_BOX_EDGES.every(sides => sides.every(i => game.edges[i])));
    const [human, ai] = dotsScore(game); assert.equal(game.status, human > ai ? 'won' : human < ai ? 'lost' : 'draw'); assert.equal(tickDots(game, 1000), game);
  }
});

test('hanoi only moves the top disk, rejects larger on smaller and supports immutable undo', () => {
  const initial = deepFreeze(createHanoi()); assert.equal(moveHanoi(initial, 1, 2), initial); assert.equal(moveHanoi(initial, 0, 0), initial);
  let game = moveHanoi(initial, 0, 2); assert.deepEqual(game.towers, [[4, 3, 2], [], [1]]); assert.equal(moveHanoi(game, 0, 2), game);
  game = moveHanoi(deepFreeze(game), 0, 1); const undo = undoHanoi(deepFreeze(game)); assert.equal(undo.moves, 1); assert.deepEqual(undo.towers, [[4, 3, 2], [], [1]]); assert.deepEqual(initial.towers[0], [4, 3, 2, 1]);
  assert.equal(undoHanoi(initial), initial);
});

test('hanoi all difficulties solve optimally, stop at completion and can undo the win', () => {
  for (const disks of [4, 5, 6]) {
    let game = createHanoi(disks);
    function solve(count, from, via, to) { if (!count) return; solve(count - 1, from, to, via); game = moveHanoi(deepFreeze(game), from, to); solve(count - 1, via, from, to); }
    solve(disks, 0, 1, 2); assert.equal(game.status, 'won'); assert.equal(game.moves, 2 ** disks - 1); assert.equal(moveHanoi(game, 2, 1), game);
    game = undoHanoi(game); assert.equal(game.status, 'playing'); assert.equal(game.towers[2].length, disks - 1);
  }
});
