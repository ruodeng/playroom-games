import { chooseMove } from './gomoku.js';

self.onmessage = ({ data: { id, game, difficulty } }) => {
  try {
    self.postMessage({ id, move: chooseMove(game, difficulty) });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
