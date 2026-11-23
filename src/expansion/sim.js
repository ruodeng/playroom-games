import { breakfast, books, market } from './sim-shop.js';
import { greenhouse, inn } from './sim-care.js';
import { gridDispatch, recycling, theater } from './sim-systems.js';
import { auction, island } from './sim-harbor.js';

const setups = new Map([
  ['breakfast-stall', breakfast],
  ['four-season-greenhouse', greenhouse],
  ['corner-bookshop', books],
  ['mountain-inn', inn],
  ['night-market-produce', market],
  ['community-grid', gridDispatch],
  ['city-recycling', recycling],
  ['little-theater', theater],
  ['fishing-port-auction', auction],
  ['island-town', island],
]);

export function mount(id, host, api) {
  const setup = setups.get(id);
  if (!setup) throw new RangeError(`Unknown simulation game: ${id}`);
  setup(host, api);
}
