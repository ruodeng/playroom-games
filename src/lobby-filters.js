export function initLobbyFilters() {
  const library = document.querySelector('.library-grid');
  const filters = document.querySelectorAll('[data-game-filter]');
  const search = document.querySelector('#library-search');
  const clear = document.querySelector('#library-search-clear');
  const empty = document.querySelector('#library-empty');
  const count = document.querySelector('#library-count');
  const type = document.querySelector('#library-type');
  const reset = document.querySelector('#library-reset');
  if (!library || !search || !clear || !empty || !count || !type || !reset) return;
  const cards = [...library.querySelectorAll('.game-card')].map(card => ({ card, text: card.textContent.toLocaleLowerCase() }));
  if (type.options.length === 1) {
    for (const value of new Set(cards.map(({ card }) => card.dataset.type))) {
      if (value) type.add(new Option(value, value));
    }
  }
  let category = 'all';
  function update() {
    const query = search.value.trim().toLocaleLowerCase();
    let visible = 0;
    for (const { card, text } of cards) {
      const matches = category === 'all' || (category === 'new' ? card.dataset.new === 'true' : card.dataset.category === category);
      card.hidden = !matches || (type.value && card.dataset.type !== type.value) || !text.includes(query);
      if (!card.hidden) visible++;
    }
    clear.hidden = !search.value;
    empty.hidden = visible !== 0;
    count.textContent = query ? `找到 ${visible} 款游戏` : `${visible} 款小游戏，打开就能玩`;
  }
  filters.forEach(button => button.addEventListener('click', () => {
    category = button.dataset.gameFilter;
    filters.forEach(item => { const selected = item === button; item.setAttribute('aria-pressed', String(selected)); item.classList.toggle('selected', selected); });
    update();
  }));
  search.addEventListener('input', update);
  type.addEventListener('change', update);
  clear.addEventListener('click', () => { search.value = ''; update(); search.focus(); });
  reset.addEventListener('click', () => {
    search.value = ''; type.value = ''; category = 'all';
    filters.forEach(item => { const selected = item.dataset.gameFilter === 'all'; item.setAttribute('aria-pressed', String(selected)); item.classList.toggle('selected', selected); });
    update();
  });
  update();
}
