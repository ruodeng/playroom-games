export const CODE_COLORS = Object.freeze(['松绿', '陶红', '麦黄', '湖蓝', '藕紫', '栗棕']);
export const CODE_ATTEMPTS = 10;

export function createCode(random = Math.random) {
  return { secret: Array.from({ length: 4 }, () => Math.floor(random() * 6)), current: [null, null, null, null], guesses: [], score: 0, status: 'playing', error: '' };
}

export function evaluateCode(secret, guess) {
  let exact = 0;
  const remainingSecret = Array(6).fill(0), remainingGuess = Array(6).fill(0);
  for (let i = 0; i < 4; i++) {
    if (secret[i] === guess[i]) exact++;
    else { remainingSecret[secret[i]]++; remainingGuess[guess[i]]++; }
  }
  const elsewhere = remainingSecret.reduce((total, count, color) => total + Math.min(count, remainingGuess[color]), 0);
  return { exact, elsewhere };
}

export function setCodePeg(game, index, color) {
  if (game.status !== 'playing' || !Number.isInteger(index) || index < 0 || index > 3 || (color !== null && (!Number.isInteger(color) || color < 0 || color > 5))) return game;
  if (game.current[index] === color && !game.error) return game;
  const current = [...game.current]; current[index] = color;
  return { ...game, current, error: '' };
}

export function submitCode(game) {
  if (game.status !== 'playing') return game;
  if (game.current.some(color => color === null)) return { ...game, error: '先选齐 4 个颜色，再提交这一排。' };
  const feedback = evaluateCode(game.secret, game.current);
  const guesses = [...game.guesses, { colors: [...game.current], ...feedback }];
  const status = feedback.exact === 4 ? 'won' : guesses.length === CODE_ATTEMPTS ? 'lost' : 'playing';
  return { ...game, guesses, current: [null, null, null, null], status, score: status === 'won' ? (CODE_ATTEMPTS + 1 - guesses.length) * 100 : 0, error: '' };
}
