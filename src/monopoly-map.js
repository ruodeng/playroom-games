// Coordinates are in a 1000 × 760 illustrated landscape. Property IDs remain stable for old saves.
export const MAP_POINTS = Object.freeze([
  [150, 660], [260, 610], [350, 525], [295, 420], [180, 440], [105, 345],
  [180, 245], [115, 135], [230, 90], [340, 135], [420, 220], [425, 345],
  [555, 305], [550, 180], [655, 95], [780, 130], [865, 235], [790, 350],
  [895, 450], [820, 545], [720, 480], [640, 570], [545, 455], [430, 610],
].map(Object.freeze));
export const FORKS = Object.freeze({
  6: Object.freeze([{ next: 7, name: '林间小径', detail: '经过花屋与画廊', shortcut: false }, { next: 10, name: '山谷近路', detail: '跨过山谷，直达乐坊', shortcut: true }]),
  16: Object.freeze([{ next: 17, name: '海湾漫游', detail: '经过别墅与海滨酒店', shortcut: false }, { next: 22, name: '河上栈桥', detail: '穿越河湾，直达日光大厦', shortcut: true }]),
});
export const nextStops = index => FORKS[index]?.map(option => option.next) || [(index + 1) % MAP_POINTS.length];
export const TERRAIN = Object.freeze({
  'old-town': { name: '老街', description: '暖色屋顶与石板路，热闹的小镇商业街。' },
  woodland: { name: '森林', description: '穿过松林和花园，在山谷岔路选择下一站。' },
  hills: { name: '山丘', description: '沿山坡拾级而上，乐坊与露天剧场藏在绿意中。' },
  riverside: { name: '河岸', description: '拱桥、庭院与花园，沿着河流慢慢经营。' },
  seaside: { name: '海湾', description: '沙滩、灯塔与度假酒店，也可以选择河上近路。' },
  station: { name: '车站', description: '连接小镇的两座车站，持有越多租金越高。' },
  'town-park': { name: '市政花园', description: '广场、喷泉和公园，是小镇居民相遇的地方。' },
});
export const TILE_TERRAIN = Object.freeze(['town-park', 'old-town', 'old-town', 'station', 'old-town', 'old-town',
  'woodland', 'woodland', 'woodland', 'woodland', 'hills', 'hills', 'town-park', 'riverside', 'riverside', 'station',
  'riverside', 'seaside', 'town-park', 'seaside', 'seaside', 'seaside', 'riverside', 'old-town']);
export const terrainFor = index => ({ ...TERRAIN[TILE_TERRAIN[index]], image: `/assets/monopoly/${TILE_TERRAIN[index]}.png` });

// Every edge has a deliberate bend; the two dashed routes are playable shortcuts.
export function roadPath(from, to = (from + 1) % 24) {
  const [x, y] = MAP_POINTS[from], [tx, ty] = MAP_POINTS[to];
  if (from === 6 && to === 10) return `M ${x} ${y} C 250 300 330 280 ${tx} ${ty}`;
  if (from === 16 && to === 22) return `M ${x} ${y} C 685 220 675 410 ${tx} ${ty}`;
  if (from === 23 && to === 0) return `M ${x} ${y} C 340 735 230 725 ${tx} ${ty}`;
  const bend = from % 2 ? 12 : -12;
  return `M ${x} ${y} Q ${(x + tx) / 2 + bend} ${(y + ty) / 2 - bend} ${tx} ${ty}`;
}
