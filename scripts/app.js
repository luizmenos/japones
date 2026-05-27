const dataFiles = [
  'hiragana',
  'katakana',
  'kanji',
  'verbs',
  'adjectives',
  'particles',
  'words',
  'phrases'
];

let deck = [];
let mnemonics = [];
let currentIndex = 0;
let currentDeck = [];
let activeFilter = 'Todos';

const cardEl = document.getElementById('card');
const frontText = document.getElementById('front-text');
const backReading = document.getElementById('back-reading');
const backMeaning = document.getElementById('back-meaning');
const typeTag = document.getElementById('type-tag');
const counterEl = document.getElementById('counter');
const gridEl = document.getElementById('cards-grid');
const filtersEl = document.getElementById('filters');
const catalogCount = document.getElementById('catalog-count');
const catalogView = document.getElementById('catalog-view');
const mnemonicsView = document.getElementById('mnemonics-view');
const mnemonicsGrid = document.getElementById('mnemonics-grid');
const mnemonicsCount = document.getElementById('mnemonics-count');
const practiceView = document.getElementById('practice-view');
const catalogLink = document.getElementById('catalog-link');
const mnemonicsLink = document.getElementById('mnemonics-link');
const practiceLink = document.getElementById('practice-link');

async function loadJson(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Nao foi possivel carregar ${path}`);
  }

  return response.json();
}

async function loadStudyData() {
  const cardGroups = await Promise.all(dataFiles.map((name) => loadJson(`data/${name}.json`)));
  deck = cardGroups.flat();
  mnemonics = await loadJson('data/mnemonics.json');
  currentDeck = [...deck];
}

function getFilteredDeck() {
  return activeFilter === 'Todos' ? deck : deck.filter((item) => item.type === activeFilter);
}

function renderFilters() {
  const types = ['Todos', ...new Set(deck.map((item) => item.type))];
  filtersEl.innerHTML = types.map((type) => {
    const count = type === 'Todos' ? deck.length : deck.filter((item) => item.type === type).length;

    return `
      <button class="filter-button rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:border-slate-400"
        aria-pressed="${type === activeFilter}" onclick="setFilter('${type}')">
        ${type} <span class="text-slate-400">${count}</span>
      </button>
    `;
  }).join('');
}

function renderCatalog() {
  const items = getFilteredDeck();
  catalogCount.innerText = `${items.length} cards disponiveis`;
  gridEl.innerHTML = items.map((item) => `
    <button class="study-card h-56 w-full text-left perspective-1000" type="button" onclick="this.classList.toggle('is-open')" aria-label="Virar ${item.front}">
      <span class="study-card-inner relative block h-full w-full transition-transform duration-500 preserve-3d ${item.type === 'Frase' ? 'text-sm' : ''}">
        <span class="absolute inset-0 flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm backface-hidden">
          <span class="text-xs font-black uppercase tracking-widest text-red-500">${item.type}</span>
          <span class="flex min-h-24 items-center text-4xl font-black leading-tight text-slate-900 ${item.front.length > 8 ? 'text-2xl' : ''}">${item.front}</span>
          <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Passe o mouse para ver</span>
        </span>
        <span class="absolute inset-0 flex flex-col justify-center rounded-lg border border-red-200 bg-red-50 p-5 text-center shadow-sm backface-hidden rotate-back">
          <span class="mb-3 text-xl font-black leading-tight text-red-600">${item.reading}</span>
          <span class="text-lg font-semibold leading-snug text-slate-700">${item.meaning}</span>
        </span>
      </span>
    </button>
  `).join('');
}

function setFilter(type) {
  activeFilter = type;
  renderFilters();
  renderCatalog();
}

function renderMnemonics() {
  mnemonicsCount.innerText = `${mnemonics.length} mnemonicos disponiveis`;
  mnemonicsGrid.innerHTML = mnemonics.map((item) => `
    <article class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div class="mb-4 flex items-start justify-between gap-4">
        <div class="text-6xl font-black leading-none text-slate-900">${item.symbol}</div>
        <div class="rounded-full bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-red-500">${item.type}</div>
      </div>
      <div class="mb-2 text-xl font-black text-red-600">${item.reading}</div>
      <p class="text-sm font-semibold leading-relaxed text-slate-600">${item.hint}</p>
    </article>
  `).join('');
}

function updateCard() {
  if (!currentDeck.length) return;

  cardEl.classList.remove('flipped');
  setTimeout(() => {
    const item = currentDeck[currentIndex];
    frontText.innerText = item.front;
    backReading.innerText = item.reading;
    backMeaning.innerText = item.meaning;
    typeTag.innerText = item.type;
    counterEl.innerText = `Carta ${currentIndex + 1} de ${currentDeck.length}`;
  }, 150);
}

function flipCard() {
  if (!currentDeck.length) return;

  cardEl.classList.toggle('flipped');
}

function nextCard() {
  if (!currentDeck.length) return;

  currentIndex = (currentIndex + 1) % currentDeck.length;
  updateCard();
}

function prevCard() {
  if (!currentDeck.length) return;

  currentIndex = (currentIndex - 1 + currentDeck.length) % currentDeck.length;
  updateCard();
}

function shuffleCards() {
  if (!currentDeck.length) return;

  for (let i = currentDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [currentDeck[i], currentDeck[j]] = [currentDeck[j], currentDeck[i]];
  }

  currentIndex = 0;
  updateCard();
}

function showView() {
  const isPractice = window.location.hash === '#treino';
  const isMnemonics = window.location.hash === '#mnemonicos';
  catalogView.classList.toggle('hidden', isPractice || isMnemonics);
  mnemonicsView.classList.toggle('hidden', !isMnemonics);
  mnemonicsView.classList.toggle('flex', isMnemonics);
  practiceView.classList.toggle('hidden', !isPractice);
  catalogLink.setAttribute('aria-current', !isPractice && !isMnemonics ? 'page' : 'false');
  mnemonicsLink.setAttribute('aria-current', isMnemonics ? 'page' : 'false');
  practiceLink.setAttribute('aria-current', isPractice ? 'page' : 'false');
}

function renderLoadError(error) {
  catalogCount.innerText = 'Nao consegui carregar os cards.';
  gridEl.innerHTML = `
    <div class="rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-semibold leading-relaxed text-red-700 sm:col-span-2 lg:col-span-3">
      ${error.message}. Se voce abriu o arquivo direto no navegador, rode um servidor local ou publique no GitHub Pages.
    </div>
  `;
}

document.addEventListener('keydown', (e) => {
  if (window.location.hash !== '#treino') return;
  if (e.code === 'Space') { e.preventDefault(); flipCard(); }
  if (e.code === 'ArrowRight') nextCard();
  if (e.code === 'ArrowLeft') prevCard();
});

window.addEventListener('hashchange', showView);

loadStudyData()
  .then(() => {
    renderFilters();
    renderCatalog();
    renderMnemonics();
    updateCard();
    showView();
  })
  .catch(renderLoadError);
