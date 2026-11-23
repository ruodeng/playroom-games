import { mountCrossword, mountGroups, mountIdioms, mountRadicals } from './words-chinese.js';
import { mountCipher, mountLadder, mountSearch } from './words-letters.js';
import { mountSequence, mountTwentyFour, mountWitness } from './words-logic.js';

const games = new Map([
  ['idiom-fill', mountIdioms],
  ['chinese-crossword', mountCrossword],
  ['radical-builder', mountRadicals],
  ['word-groups', mountGroups],
  ['word-ladder', mountLadder],
  ['word-search', mountSearch],
  ['cipher-letter', mountCipher],
  ['witness-logic', mountWitness],
  ['twenty-four', mountTwentyFour],
  ['sequence-detective', mountSequence],
]);

export function mount(id, host, api) {
  const game = games.get(id);
  if (game && !api.signal.aborted) game(id, host, api);
}
