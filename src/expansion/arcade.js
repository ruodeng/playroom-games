import { asteroidDrift, fruitSlice, pinball } from './arcade-motion.js';
import { bouncePaint, riverSquad, towerStack } from './arcade-grid.js';
import { beatKeys, goldMine, streetRings, toyClaw } from './arcade-timing.js';

const mounts = new Map([
  ['pinball', pinball],
  ['river-squad', riverSquad],
  ['fruit-slice', fruitSlice],
  ['tower-stack', towerStack],
  ['toy-claw', toyClaw],
  ['gold-mine', goldMine],
  ['bounce-paint', bouncePaint],
  ['beat-keys', beatKeys],
  ['street-rings', streetRings],
  ['asteroid-drift', asteroidDrift],
]);

export function mount(id, host, api) {
  const game = mounts.get(id);
  if (!game) throw new RangeError(`Unknown arcade game: ${id}`);
  game(host, api);
}
