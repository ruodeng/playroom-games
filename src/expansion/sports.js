import { golf, curling, pool } from './sports-table.js';
import { basketball, penalty, bowling } from './sports-shots.js';
import { skiing, rowing, cycling, relay } from './sports-races.js';

const setups = new Map([
  ['mini-golf', golf],
  ['spot-basketball', basketball],
  ['penalty-kicks', penalty],
  ['curve-bowling', bowling],
  ['ski-slalom', skiing],
  ['rowing-rhythm', rowing],
  ['curling-house', curling],
  ['pocket-pool', pool],
  ['track-cycling', cycling],
  ['sprint-relay', relay],
]);

export function mount(id, host, api) {
  const game = setups.get(id);
  if (game) game(host, api);
}
