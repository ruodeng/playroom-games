export const BATTLE_SIZE = 7;
export const BATTLE_FLEET = [3, 2, 2];
function randomIndex(length, rng) { return Math.min(length - 1, Math.max(0, Math.floor(rng() * length))); }
export function placeFleet(rng = Math.random) {
  const fleet = [], occupied = new Set();
  for (const length of BATTLE_FLEET) {
    const options = [];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) for (const [dr, dc] of [[0, 1], [1, 0]]) {
      if (r + dr * (length - 1) >= 7 || c + dc * (length - 1) >= 7) continue;
      const cells = Array.from({ length }, (_, i) => (r + dr * i) * 7 + c + dc * i);
      if (cells.every(cell => !occupied.has(cell))) options.push(cells);
    }
    const ship = options[randomIndex(options.length, rng)]; fleet.push(ship); ship.forEach(cell => occupied.add(cell));
  }
  return fleet;
}
export function createBattle(rng = Math.random) {
  return { ownFleet: placeFleet(rng), enemyFleet: placeFleet(rng), ownShots: Array(49).fill(0), enemyShots: Array(49).fill(0), turn: 1, status: 'playing', wait: 0, moves: 0, lastMessage: '选择对方海域，发出第一炮' };
}
export function sunkShips(fleet, shots) { return fleet.filter(ship => ship.every(cell => shots[cell] === 2)); }
function resolveBattleShot(game, index, player) {
  if (!Number.isInteger(index) || index < 0 || index >= 49) return game;
  const shotKey = player === 1 ? 'ownShots' : 'enemyShots', fleet = player === 1 ? game.enemyFleet : game.ownFleet;
  if (game[shotKey][index]) return game;
  const shots = [...game[shotKey]], hit = fleet.some(ship => ship.includes(index)); shots[index] = hit ? 2 : 1;
  const ship = fleet.find(cells => cells.includes(index)), sunk = hit && ship.every(cell => shots[cell] === 2);
  const finished = sunkShips(fleet, shots).length === fleet.length;
  return { ...game, [shotKey]: shots, turn: 3 - player, wait: player === 1 ? 500 : 0, moves: game.moves + 1, status: finished ? player === 1 ? 'won' : 'lost' : 'playing', lastMessage: `${player === 1 ? '你' : '电脑'}攻击 ${String.fromCharCode(65 + Math.floor(index / 7))}${index % 7 + 1}：${sunk ? '击沉一艘！' : hit ? '命中！' : '落空'}` };
}
export function shootBattle(game, index) { return game.status === 'playing' && game.turn === 1 ? resolveBattleShot(game, index, 1) : game; }
// Target selection receives only observed shots and publicly announced sunk cells.
export function chooseBattleShot(shots, sunkCells = [], rng = Math.random) {
  const knownSunk = new Set(sunkCells), targets = new Set();
  shots.forEach((shot, index) => {
    if (shot !== 2 || knownSunk.has(index)) return;
    for (const next of [index - 7, index + 7, index % 7 ? index - 1 : -1, index % 7 < 6 ? index + 1 : -1]) if (next >= 0 && next < 49 && !shots[next]) targets.add(next);
  });
  const empty = shots.flatMap((shot, i) => shot ? [] : [i]);
  const hunt = empty.filter(i => (Math.floor(i / 7) + i % 7) % 2 === 0);
  const options = targets.size ? [...targets] : hunt.length ? hunt : empty;
  return options.length ? options[randomIndex(options.length, rng)] : -1;
}
export function tickBattle(game, ms, rng = Math.random) {
  if (game.status !== 'playing' || game.turn !== 2) return game;
  const wait = Math.max(0, game.wait - ms); if (wait) return { ...game, wait };
  const sunkCells = sunkShips(game.ownFleet, game.enemyShots).flat();
  return resolveBattleShot(game, chooseBattleShot(game.enemyShots, sunkCells, rng), 2);
}
