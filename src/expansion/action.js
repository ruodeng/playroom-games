import { glider, lunar, raft } from './action-flight.js';
import { gravity, lava, pendulum, ruin } from './action-platform.js';
import { drill, shadow, stealth } from './action-rooms.js';

const mounts = {
  'ruin-treasure': ruin,
  'pendulum-tower': pendulum,
  'gravity-flip': gravity,
  'rock-drill': drill,
  'shadow-mechanism': shadow,
  'stealth-key': stealth,
  'lava-escape': lava,
  'lunar-landing': lunar,
  'river-raft': raft,
  'glider-gates': glider,
};

export function mount(id, host, api) {
  mounts[id](host, api);
}
