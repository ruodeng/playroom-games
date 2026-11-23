export const SOKOBAN_LEVELS = [
  ['#######', '# ... #', '#     #', '# $$$ #', '#  @  #', '#     #', '#######'],
  ['########', '#  .   #', '#  $ # #', '# . $ .#', '# # $  #', '#   @  #', '########'],
  ['########', '# .  . #', '# $$   #', '#  ##  #', '#   $$ #', '# . @. #', '#      #', '########'],
];
export function createSokoban(level = 0) {
  const map = SOKOBAN_LEVELS[level % SOKOBAN_LEVELS.length], width = map[0].length, walls = [], goals = [], boxes = []; let player = 0;
  map.join('').split('').forEach((tile, i) => {
    if (tile === '#') walls.push(i);
    if ('.+*'.includes(tile)) goals.push(i);
    if ('$*'.includes(tile)) boxes.push(i);
    if ('@+'.includes(tile)) player = i;
  });
  return { level: level % SOKOBAN_LEVELS.length, width, height: map.length, walls, goals, boxes, player, moves: 0, pushes: 0, history: [], status: 'playing' };
}
export function moveSokoban(game, direction) {
  const deltas = { left: -1, right: 1, up: -game.width, down: game.width };
  const delta = deltas[direction];
  if (game.status !== 'playing' || !delta) return game;
  const target = game.player + delta;
  if (target < 0 || target >= game.width * game.height || (Math.abs(delta) === 1 && Math.floor(target / game.width) !== Math.floor(game.player / game.width)) || game.walls.includes(target)) return game;
  const box = game.boxes.indexOf(target), beyond = target + delta;
  if (box >= 0 && (beyond < 0 || beyond >= game.width * game.height || (Math.abs(delta) === 1 && Math.floor(beyond / game.width) !== Math.floor(target / game.width)) || game.walls.includes(beyond) || game.boxes.includes(beyond))) return game;
  const boxes = [...game.boxes]; if (box >= 0) boxes[box] = beyond;
  return { ...game, boxes, player: target, moves: game.moves + 1, pushes: game.pushes + Number(box >= 0), history: [...game.history, { player: game.player, boxes: game.boxes, pushes: game.pushes }], status: boxes.every(index => game.goals.includes(index)) ? 'won' : 'playing' };
}
export function undoSokoban(game) {
  if (!game.history.length) return game;
  return { ...game, ...game.history.at(-1), moves: game.moves - 1, history: game.history.slice(0, -1), status: 'playing' };
}
export function resetSokoban(game) { return createSokoban(game.level); }
export function nextSokoban(game) { return game.status === 'won' && game.level < SOKOBAN_LEVELS.length - 1 ? createSokoban(game.level + 1) : game; }
