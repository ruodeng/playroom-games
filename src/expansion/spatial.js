import { mountTangram } from './spatial-tangram.js';
import { mountDiamond, mountLaser, mountPipes, mountRolling } from './spatial-grid-games.js';
import { mountBalance, mountKnot, mountPaper } from './spatial-workshop.js';
import { mountBridge, mountGears } from './spatial-machines.js';
import { element } from './spatial-ui.js';

const mounts = new Map([
  ['tangram', mountTangram],
  ['laser-mirrors', mountLaser],
  ['untangle-knots', mountKnot],
  ['rolling-block', mountRolling],
  ['pipe-network', mountPipes],
  ['diamond-solitaire', mountDiamond],
  ['balance-weights', mountBalance],
  ['gear-room', mountGears],
  ['paper-fold-holes', mountPaper],
  ['bridge-load', mountBridge],
]);

export function mount(id, host, api) {
  host.replaceChildren();
  const game = element(host, 'div', 'spatial-games');
  mounts.get(id)(game, api);
}
