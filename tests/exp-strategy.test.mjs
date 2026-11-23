import test from 'node:test';
import assert from 'node:assert/strict';
import { games } from '../src/expansion/strategy-catalog.js';
import { forestStages, forestState, forestTick, startForestWave } from '../src/expansion/strategy-defense.js';
import { advanceSignal, dispatchTrains, railState, signalState } from '../src/expansion/strategy-traffic.js';
import { advanceFire, createWrecks, fireMap, fireState, surveyDistance } from '../src/expansion/strategy-terrain.js';
import { cargo, fitCargo, garageOccupancy, garages, moveCar, rotateCargo, truckWeights } from '../src/expansion/strategy-parking.js';
import { advanceRelay, advanceTide, relayState, tideState } from '../src/expansion/strategy-routes.js';
import { expandProgram, moveRover, programSize, roverFinished, roverState } from '../src/expansion/strategy-rover.js';

test('the strategy catalog has the ten games and ranks only the three requested challenges', () => {
  assert.deepEqual(games.map(game => game.name), [
    '林间塔防', '列车会让', '路口信号台', '深海测绘', '山火隔离带',
    '搬家装车', '车库泊出', '急件接驳', '潮汐撤离', '指令探险车',
  ]);
  assert.equal(new Set(games.map(game => game.id)).size, 10);
  assert.deepEqual(games.filter(game => game.metric).map(game => [game.id, game.metric.direction]), [
    ['forest-defense', 'desc'], ['rail-meet', 'asc'], ['command-rover', 'asc'],
  ]);
});

test('each of the six forest stages supports two beatable waves', () => {
  const buildOrders = [
    [10, 11, 12, 13, 26, 27, 28, 29],
    [18, 20, 26, 28, 29, 12, 17, 21],
    [27, 28, 19, 20, 14, 17, 35, 36],
    [19, 13, 18, 29, 27, 14, 26, 0],
    [12, 26, 18, 35, 4, 16, 22, 30],
    [19, 27, 37, 3, 17, 9, 23, 5],
  ];
  assert.equal(forestStages.length, buildOrders.length);
  forestStages.forEach((stage, level) => {
    const state = forestState(level);
    const build = () => {
      for (const index of buildOrders[level]) {
        assert.ok(!stage.path.includes(index) && !stage.rocks.includes(index));
        if (state.wood < 4 || state.placed.has(index)) continue;
        state.placed.set(index, { type: 'arrow', level: 1 });
        state.wood -= 4;
      }
    };
    build();
    for (const wave of [1, 2]) {
      startForestWave(state);
      let complete = false;
      let kills = 0;
      for (let tick = 0; tick < 60 && !complete; tick++) {
        const result = forestTick(state);
        assert.equal(result.leaks, 0);
        kills += result.kills;
        complete = result.done;
        build();
      }
      assert.ok(complete);
      assert.equal(kills, 7 + level + wave * 2);
    }
  });
});

test('four rail services pass in eight dispatches, while swapping stations is a collision', () => {
  let trains = railState();
  for (let step = 0; step < 8; step++) {
    const moving = new Set(trains.flatMap((train, index) => train.arrived ? [] : [index]));
    const next = dispatchTrains(trains, moving, false, step === 1 || step === 2);
    assert.equal(next.collision, null);
    trains = next.trains;
  }
  assert.ok(trains.every(train => train.arrived));
  const first = { ...trains[0], node: 4, arrived: false };
  const second = { ...trains[1], node: 5, arrived: false };
  assert.deepEqual(dispatchTrains([first, second], new Set([0, 1]), false, false).collision, [0, 1]);
});

test('the signal plan clears traffic while the single-direction plan jams', () => {
  let state = signalState();
  let result;
  for (const phaseChange of [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0]) {
    result = advanceSignal(state, Boolean(phaseChange));
    assert.equal(result.loss, null);
    state = result.next;
  }
  assert.ok(result.emptied);
  assert.equal(state.ticks, 19);
  state = signalState();
  for (let turn = 0; turn < 20; turn++) {
    result = advanceSignal(state, false);
    if (result.loss) break;
    state = result.next;
  }
  assert.match(result.loss, /堵塞|超时/);
});

test('two soundings on the first row distinguish all three seeded wrecks', () => {
  const samples = [0.1, 0.9, 0.4];
  const wrecks = createWrecks(() => samples.shift());
  assert.equal(new Set(wrecks).size, 3);
  for (const wreck of wrecks) {
    const candidates = Array.from({ length: 25 }, (_, index) => index)
      .filter(position => [0, 4].every(origin => surveyDistance(origin, position) === surveyDistance(origin, wreck)));
    assert.deepEqual(candidates, [wreck]);
  }
});

test('firebreak timing protects both villages and advancing without cuts loses', () => {
  let state = fireState();
  for (const cuts of [[6, 20], [40, 34], [48], [], [], [], []]) {
    state = advanceFire(state, cuts);
    assert.ok([...state.burning].every(index => fireMap[index] !== 'V'));
  }
  assert.equal(state.burning.size, 0);
  state = fireState();
  for (let turn = 0; turn < 7; turn++) state = advanceFire(state, []);
  assert.ok([...state.ash, ...state.burning].some(index => fireMap[index] === 'V'));
});

test('the seven rotated loads fit and balance, and wheel arches are unavailable', () => {
  const occupied = new Map();
  const slots = [[0, 0], [3, 0], [5, 1], [7, 0], [12, 1], [14, 0], [19, 0]];
  assert.equal(fitCargo(2, cargo[0].shape, occupied), null);
  slots.forEach(([anchor, rotations], index) => {
    const shape = rotations ? rotateCargo(cargo[index].shape) : cargo[index].shape;
    const positions = fitCargo(anchor, shape, occupied);
    assert.ok(positions);
    for (const position of positions) occupied.set(position, index);
  });
  assert.equal(occupied.size, 21);
  assert.deepEqual(truckWeights(occupied), [17, 13]);
});

test('both traffic jam layouts are collision-free and have an exit route', () => {
  const plans = [
    '甲↓ 乙← 乙← 甲↓ 丙↓ 丁← 丙↓ 丁← 丁← 甲↓ 红→ 红→ 红→ 红→',
    '红← 甲↓ 乙↑ 乙↑ 乙↑ 戊↓ 丁→ 己← 戊↓ 戊↓ 己← 甲↓ 辛↑ 壬← 乙↑ 红→ 红→ 红→ 红→ 红→',
  ];
  garages.forEach((garage, index) => {
    assert.equal(garageOccupancy(garage).size, garage.reduce((sum, car) => sum + car.length, 0));
    let cars = garage;
    let result;
    for (const [mark, arrow] of plans[index].split(' ')) {
      result = moveCar(cars, cars.findIndex(car => car.mark === mark), '↑→↓←'.indexOf(arrow));
      assert.ok(result);
      cars = result.cars;
    }
    assert.ok(result.escaped);
  });
});

test('courier connections require the listed departure time and allow all deadlines', () => {
  let state = relayState();
  let result = advanceRelay(state, 'north');
  assert.equal(advanceRelay(result.state, 'office'), null);
  for (const stop of ['north', null, 'office', 'hotel', 'lab', 'hotel']) {
    result = advanceRelay(state, stop);
    assert.ok(!result.late);
    state = result.state;
  }
  assert.ok(result.finished);
  assert.equal(state.time, 13);
});

test('the tide schedule allows two safe boat trips and blocks a shallow departure', () => {
  let state = tideState();
  let result;
  const route = [
    'inlet', 'north', 'board', 'inlet', 'harbor', 'unload', 'inlet', 'south',
    'board', 'island', 'board', 'north', 'inlet', 'harbor', 'unload',
  ];
  for (const stop of route) {
    result = ['board', 'unload'].includes(stop) ? advanceTide(state, stop) : advanceTide(state, 'sail', stop);
    assert.equal(result.loss, null);
    state = result.state;
  }
  assert.ok(result.finished);
  assert.equal(state.time, 15);
  const lowTide = { ...tideState(), here: 'inlet' };
  assert.equal(advanceTide(lowTide, 'sail', 'north'), null);
});

test('the rover rejects a wall and accepts a compressed program only at the return capsule', () => {
  const repeat = { repeat: 2, sequence: ['forward', 'forward', 'right', 'forward', 'forward', 'left'] };
  const program = [repeat, ...['forward', 'right', 'forward', 'forward'].map(command => ({ command }))];
  const instructions = expandProgram(program);
  const state = roverState();
  assert.equal(moveRover(moveRover(state, 'right'), 'forward'), null);
  assert.equal(programSize(program), 11);
  assert.equal(instructions.length, 16);
  const partial = instructions.slice(0, -1).reduce((rover, { command }) => moveRover(rover, command), state);
  assert.ok(!roverFinished(partial));
  assert.ok(roverFinished(moveRover(partial, instructions.at(-1).command)));
});
