export const DOT_BOX_EDGES = Array.from({ length: 9 }, (_, box) => {
  const row = Math.floor(box / 3), col = box % 3;
  return [row * 3 + col, (row + 1) * 3 + col, 12 + row * 4 + col, 12 + row * 4 + col + 1];
});
export function createDots() { return { edges: Array(24).fill(0), boxes: Array(9).fill(0), turn: 1, wait: 0, status: 'playing', last: -1 }; }
export function dotsScore(game) { return [game.boxes.filter(x => x === 1).length, game.boxes.filter(x => x === 2).length]; }
export function moveDots(game, index, player = 1) {
  if (game.status !== 'playing' || game.turn !== player || !Number.isInteger(index) || index < 0 || index >= 24 || game.edges[index]) return game;
  const edges = [...game.edges], boxes = [...game.boxes]; edges[index] = player; let claimed = 0;
  DOT_BOX_EDGES.forEach((sides, box) => { if (!boxes[box] && sides.every(edge => edges[edge])) { boxes[box] = player; claimed++; } });
  const turn = claimed ? player : 3 - player, [human, ai] = dotsScore({ boxes });
  return { ...game, edges, boxes, turn, last: index, wait: turn === 2 ? 450 : 0, status: boxes.every(Boolean) ? human > ai ? 'won' : human < ai ? 'lost' : 'draw' : 'playing' };
}
export function chooseDotsMove(game) {
  let best = -Infinity, choice = -1;
  for (let index = 0; index < 24; index++) {
    if (game.edges[index]) continue;
    let score = 0;
    DOT_BOX_EDGES.forEach((sides, box) => {
      if (game.boxes[box] || !sides.includes(index)) return;
      const used = sides.filter(edge => game.edges[edge]).length;
      if (used === 3) score += 100;
      else if (used === 2) score -= 15;
      else if (used === 1) score -= 1;
    });
    if (score > best) { best = score; choice = index; }
  }
  return choice;
}
export function tickDots(game, ms) {
  if (game.status !== 'playing' || game.turn !== 2) return game;
  const wait = Math.max(0, game.wait - ms);
  return wait ? { ...game, wait } : moveDots(game, chooseDotsMove(game), 2);
}
