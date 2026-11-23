import { mountLandlord } from './cards-landlord.js';
import { mountTricks } from './cards-tricks.js';
import { mountDominoes, mountRummikub } from './cards-melds.js';
import { mountMahjong, mountPyramid, mountSet, mountYacht } from './cards-puzzles.js';
import { mountBackgammon } from './cards-backgammon.js';

const mounts = {
  landlord: mountLandlord,
  hearts: (host, api) => mountTricks('hearts', host, api),
  'draw-dominoes': mountDominoes,
  rummikub: mountRummikub,
  'mahjong-waits': mountMahjong,
  'pyramid-thirteen': mountPyramid,
  'yacht-dice': mountYacht,
  backgammon: mountBackgammon,
  'three-attribute-set': mountSet,
  'oh-hell': (host, api) => mountTricks('oh-hell', host, api),
};

export function mount(id, host, api) {
  const start = mounts[id];
  if (!start) throw new Error('未知牌桌：' + id);
  start(host, api);
}
