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
let conversations = [];
let currentIndex = 0;
let currentDeck = [];
let activeFilter = 'Todos';
let searchQuery = '';
let japaneseVoice = null;
let currentAudio = null;
let conversationPlaybackId = 0;

const cardEl = document.getElementById('card');
const frontText = document.getElementById('front-text');
const backReading = document.getElementById('back-reading');
const backMeaning = document.getElementById('back-meaning');
const typeTag = document.getElementById('type-tag');
const counterEl = document.getElementById('counter');
const gridEl = document.getElementById('cards-grid');
const filtersEl = document.getElementById('filters');
const searchInput = document.getElementById('search-input');
const catalogCount = document.getElementById('catalog-count');
const catalogView = document.getElementById('catalog-view');
const mnemonicsView = document.getElementById('mnemonics-view');
const mnemonicsGrid = document.getElementById('mnemonics-grid');
const mnemonicsCount = document.getElementById('mnemonics-count');
const conversationsView = document.getElementById('conversations-view');
const conversationsList = document.getElementById('conversations-list');
const conversationsCount = document.getElementById('conversations-count');
const practiceView = document.getElementById('practice-view');
const catalogLink = document.getElementById('catalog-link');
const mnemonicsLink = document.getElementById('mnemonics-link');
const conversationsLink = document.getElementById('conversations-link');
const practiceLink = document.getElementById('practice-link');

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('./sw.js').catch(() => {
  });
}

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
  conversations = await loadJson('data/conversations.json');
  currentDeck = [...deck];
}

function refreshVoices() {
  if (!('speechSynthesis' in window)) return;

  const voices = window.speechSynthesis.getVoices();
  japaneseVoice = voices.find((voice) => voice.lang === 'ja-JP')
    || voices.find((voice) => voice.lang.startsWith('ja'))
    || null;
}

function speakJapanese(text) {
  if (!('speechSynthesis' in window)) {
    alert('Seu navegador nao tem suporte a audio por voz.');
    return;
  }

  refreshVoices();
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = 0.82;
  utterance.pitch = 1;

  if (japaneseVoice) {
    utterance.voice = japaneseVoice;
  }

  window.speechSynthesis.speak(utterance);
}

function getAudioText(item) {
  return item.audioText || item.front || item.symbol;
}

function escapeAttribute(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function playPronunciation(audioPath, text) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  if (!audioPath) {
    speakJapanese(text);
    return;
  }

  currentAudio = new Audio(audioPath);
  currentAudio.play().catch(() => speakJapanese(text));
}

function playPronunciationAndWait(audioPath, text) {
  return new Promise((resolve) => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    if (!audioPath) {
      speakJapanese(text);
      setTimeout(resolve, Math.max(1200, String(text).length * 180));
      return;
    }

    currentAudio = new Audio(audioPath);
    currentAudio.addEventListener('ended', resolve, { once: true });
    currentAudio.addEventListener('error', () => {
      speakJapanese(text);
      setTimeout(resolve, Math.max(1200, String(text).length * 180));
    }, { once: true });
    currentAudio.play().catch(() => {
      speakJapanese(text);
      setTimeout(resolve, Math.max(1200, String(text).length * 180));
    });
  });
}

function audioButton(item, color = 'slate') {
  const audioText = escapeAttribute(getAudioText(item));
  const audioPath = escapeAttribute(item.audio);
  const colorClasses = color === 'red'
    ? 'border-red-200 bg-white/80 text-red-600 hover:bg-white'
    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50';

  return `
    <button type="button" title="Ouvir pronuncia" aria-label="Ouvir pronuncia"
      class="inline-flex h-9 w-9 items-center justify-center rounded-full border ${colorClasses} text-sm font-black shadow-sm transition active:scale-95"
      data-audio="${audioPath}" data-text="${audioText}"
      onclick="event.stopPropagation(); playPronunciation(this.dataset.audio, this.dataset.text)">
      ▶
    </button>
  `;
}

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function searchableText(item) {
  return normalizeSearch([
    item.front,
    item.reading,
    item.meaning,
    item.type,
    item.audioText
  ].join(' '));
}

function getFilteredDeck() {
  const query = normalizeSearch(searchQuery);
  const filteredByType = activeFilter === 'Todos' ? deck : deck.filter((item) => item.type === activeFilter);

  if (!query) return filteredByType;

  return filteredByType.filter((item) => searchableText(item).includes(query));
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
  const totalForFilter = activeFilter === 'Todos' ? deck.length : deck.filter((item) => item.type === activeFilter).length;
  catalogCount.innerText = searchQuery
    ? `${items.length} de ${totalForFilter} cards encontrados`
    : `${items.length} cards disponiveis`;

  if (!items.length) {
    gridEl.innerHTML = `
      <div class="rounded-lg border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-500 sm:col-span-2 lg:col-span-3">
        Nada encontrado para "${escapeAttribute(searchQuery)}".
      </div>
    `;
    return;
  }

  gridEl.innerHTML = items.map((item) => `
    <article class="study-card h-56 w-full text-left perspective-1000" tabindex="0" onclick="this.classList.toggle('is-open')" aria-label="Virar ${item.front}">
      <span class="study-card-inner relative block h-full w-full transition-transform duration-500 preserve-3d ${item.type === 'Frase' ? 'text-sm' : ''}">
        <span class="absolute inset-0 flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm backface-hidden">
          <span class="flex items-start justify-between gap-3">
            <span class="text-xs font-black uppercase tracking-widest text-red-500">${item.type}</span>
            ${audioButton(item)}
          </span>
          <span class="flex min-h-24 items-center text-4xl font-black leading-tight text-slate-900 ${item.front.length > 8 ? 'text-2xl' : ''}">${item.front}</span>
          <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Passe o mouse para ver</span>
        </span>
        <span class="absolute inset-0 flex flex-col justify-center rounded-lg border border-red-200 bg-red-50 p-5 text-center shadow-sm backface-hidden rotate-back">
          <span class="absolute right-4 top-4">${audioButton(item, 'red')}</span>
          <span class="mb-3 text-xl font-black leading-tight text-red-600">${item.reading}</span>
          <span class="text-lg font-semibold leading-snug text-slate-700">${item.meaning}</span>
        </span>
      </span>
    </article>
  `).join('');
}

function setFilter(type) {
  activeFilter = type;
  renderFilters();
  renderCatalog();
}

function setSearchQuery(value) {
  searchQuery = value;
  renderCatalog();
}

function renderMnemonics() {
  mnemonicsCount.innerText = `${mnemonics.length} mnemonicos disponiveis`;
  mnemonicsGrid.innerHTML = mnemonics.map((item) => `
    <article class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div class="mb-4 flex items-start justify-between gap-4">
        <div class="text-6xl font-black leading-none text-slate-900">${item.symbol}</div>
        <div class="flex items-center gap-2">
          <div class="rounded-full bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-red-500">${item.type}</div>
          ${audioButton(item)}
        </div>
      </div>
      <div class="mb-2 text-xl font-black text-red-600">${item.reading}</div>
      <p class="text-sm font-semibold leading-relaxed text-slate-600">${item.hint}</p>
    </article>
  `).join('');
}

function getConversationLineAudioText(line) {
  return line.audioText || line.jp;
}

function lineSpeakerClass(speaker) {
  return speaker === 'A'
    ? 'border-red-100 bg-red-50/70'
    : 'border-slate-200 bg-white';
}

function renderConversations() {
  conversationsCount.innerText = `${conversations.length} dialogos disponiveis`;
  conversationsList.innerHTML = conversations.map((conversation, conversationIndex) => `
    <article class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div class="mb-2 flex flex-wrap items-center gap-2">
            <h3 class="text-xl font-black tracking-tight text-slate-900">${conversation.title}</h3>
            <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-widest text-slate-500">${conversation.setting}</span>
          </div>
          <p class="text-sm font-semibold leading-relaxed text-slate-500">${conversation.summary}</p>
        </div>
        <button type="button"
          class="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 active:scale-95"
          onclick="playConversation(${conversationIndex})">
          Tocar diálogo
        </button>
      </div>

      <div class="flex flex-col gap-3">
        ${conversation.lines.map((line, lineIndex) => `
          <div class="rounded-lg border p-4 ${lineSpeakerClass(line.speaker)}">
            <div class="mb-2 flex items-center justify-between gap-3">
              <div class="text-xs font-black uppercase tracking-widest ${line.speaker === 'A' ? 'text-red-500' : 'text-slate-500'}">
                ${line.speaker} · ${line.name}
              </div>
              ${audioButton({
                audio: line.audio,
                front: getConversationLineAudioText(line),
                audioText: getConversationLineAudioText(line)
              }, line.speaker === 'A' ? 'red' : 'slate')}
            </div>
            <div class="text-2xl font-black leading-snug text-slate-900">${line.jp}</div>
            <div class="mt-2 text-sm font-bold leading-relaxed text-red-600">${line.romaji}</div>
            <div class="mt-1 text-sm font-semibold leading-relaxed text-slate-600">${line.pt}</div>
          </div>
        `).join('')}
      </div>
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

function speakCurrentCard() {
  if (!currentDeck.length) return;

  const item = currentDeck[currentIndex];
  playPronunciation(item.audio, getAudioText(item));
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
  const isConversations = window.location.hash === '#conversas';
  catalogView.classList.toggle('hidden', isPractice || isMnemonics || isConversations);
  mnemonicsView.classList.toggle('hidden', !isMnemonics);
  mnemonicsView.classList.toggle('flex', isMnemonics);
  conversationsView.classList.toggle('hidden', !isConversations);
  conversationsView.classList.toggle('flex', isConversations);
  practiceView.classList.toggle('hidden', !isPractice);
  catalogLink.setAttribute('aria-current', !isPractice && !isMnemonics && !isConversations ? 'page' : 'false');
  mnemonicsLink.setAttribute('aria-current', isMnemonics ? 'page' : 'false');
  conversationsLink.setAttribute('aria-current', isConversations ? 'page' : 'false');
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

async function playConversation(conversationIndex) {
  const conversation = conversations[conversationIndex];
  if (!conversation) return;

  conversationPlaybackId++;
  const playbackId = conversationPlaybackId;

  for (const line of conversation.lines) {
    if (playbackId !== conversationPlaybackId) return;
    await playPronunciationAndWait(line.audio, getConversationLineAudioText(line));
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
}

window.addEventListener('hashchange', showView);
searchInput.addEventListener('input', (event) => setSearchQuery(event.target.value));

if ('speechSynthesis' in window) {
  refreshVoices();
  window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
}

loadStudyData()
  .then(() => {
    renderFilters();
    renderCatalog();
    renderMnemonics();
    renderConversations();
    updateCard();
    showView();
    registerServiceWorker();
  })
  .catch(renderLoadError);
