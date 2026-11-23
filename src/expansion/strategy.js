import { mountForest } from './strategy-defense.js';
import { mountRail, mountSignal } from './strategy-traffic.js';
import { mountSurvey, mountFire } from './strategy-terrain.js';
import { mountTruck, mountGarage } from './strategy-parking.js';
import { mountRelay, mountTide } from './strategy-routes.js';
import { mountRover } from './strategy-rover.js';

const mountGame = {
  'forest-defense': mountForest,
  'rail-meet': mountRail,
  'signal-crossing': mountSignal,
  'abyss-survey': mountSurvey,
  firebreak: mountFire,
  'moving-truck': mountTruck,
  'garage-exit': mountGarage,
  'express-relay': mountRelay,
  'tide-evacuation': mountTide,
  'command-rover': mountRover,
};

export function mount(id, host, api) {
  mountGame[id](host, api);
}
