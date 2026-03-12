// ============================================================
//  21点 (Blackjack) - Game Logic
//  Real audio files from assets/sounds/
// ============================================================

// ========================
//  AUDIO ENGINE — Real Files
// ========================

// Sound effect map: type → file path
const SFX_FILES = {
  deal: 'assets/sounds/音效/翻牌.mp3',
  flip: 'assets/sounds/音效/翻牌.mp3',
  chip: 'assets/sounds/音效/下注.mp3',
  win: 'assets/sounds/音效/胜利.mp3',
  lose: 'assets/sounds/音效/爆牌.mp3',
  push: 'assets/sounds/音效/下注.mp3',
  blackjack: 'assets/sounds/音效/BlackJack.mp3',
  click: 'assets/sounds/音效/下注.mp3',
  bust: 'assets/sounds/音效/爆牌.mp3',
};

// Preload sound effects
const sfxCache = {};
Object.entries(SFX_FILES).forEach(([key, path]) => {
  const audio = new Audio(path);
  audio.preload = 'auto';
  sfxCache[key] = audio;
});

function playSound(type) {
  try {
    const audio = sfxCache[type];
    if (!audio) return;
    const clone = audio.cloneNode();
    clone.volume = 0.75;
    clone.play().catch(() => { });
  } catch (e) { /* ignore */ }
}

// ========================
//  BGM PLAYER
// ========================
const BGM_TRACKS = [
  { label: 'Jazz', src: 'assets/sounds/BGM/BGM_jazz.mp3' },
  { label: 'Pop', src: 'assets/sounds/BGM/BGM_pop.mp3' },
];

let bgmIndex = 0;
let bgmAudio = null;
let bgmEnabled = true;

function initBGM() {
  bgmAudio = new Audio(BGM_TRACKS[bgmIndex].src);
  bgmAudio.loop = true;
  bgmAudio.volume = 0.35;

  if (bgmEnabled) {
    bgmAudio.play().catch(() => {
      // 浏览器通常会拦截没有用户交互的自动播放
      bgmEnabled = false;
      updateBGMBtn();
    });
  }
  updateBGMBtn();
}

function toggleBGM() {
  if (!bgmAudio) initBGM();
  bgmEnabled = !bgmEnabled;
  if (bgmEnabled) {
    bgmAudio.play().catch(() => { bgmEnabled = false; updateBGMBtn(); });
  } else {
    bgmAudio.pause();
  }
  updateBGMBtn();
}

function switchBGMTrack() {
  bgmIndex = (bgmIndex + 1) % BGM_TRACKS.length;
  const wasPlaying = bgmEnabled;
  if (bgmAudio) { bgmAudio.pause(); bgmAudio = null; }
  initBGM();
  if (wasPlaying) bgmAudio.play().catch(() => { });
  updateBGMBtn();
}

function updateBGMBtn() {
  const btn = document.getElementById('bgmBtn');
  if (!btn) return;
  const track = BGM_TRACKS[bgmIndex];
  btn.innerHTML = bgmEnabled
    ? `🎵 ${track.label} <span class="bgm-on">ON</span>`
    : `🎵 ${track.label} <span class="bgm-off">OFF</span>`;
}


// ========================
//  DECK & CARD LOGIC
// ========================
const SUITS = ['♠', '♣', '♥', '♦'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return shuffle(deck);
}

function shuffle(deck) {
  // Fisher-Yates
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardValue(rank) {
  if (rank === 'A') return 11;
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  return parseInt(rank);
}

function handTotal(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    total += cardValue(card.rank);
    if (card.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function isRed(suit) {
  return suit === '♥' || suit === '♦';
}

// ========================
//  GAME STATE
// ========================
let state = {
  deck: [],
  playerHand: [],
  dealerHand: [],
  chips: 1000,
  bet: 0,
  phase: 'betting',   // 'betting' | 'player' | 'dealer' | 'result'
  dealerRevealed: false,
};

// ========================
//  UI HELPERS
// ========================
function $(id) { return document.getElementById(id); }

function setDisplay(id, val) { $(id).style.display = val; }

function updateChipsUI() {
  const el = $('chipsDisplay');
  el.textContent = state.chips;
  el.classList.remove('updated');
  void el.offsetWidth; // reflow
  el.classList.add('updated');
}

function updateBetUI() {
  $('betDisplay').textContent = state.bet;
}

function setScoreBadge(who, text, cls) {
  const el = $(who === 'player' ? 'playerScore' : 'dealerScore');
  el.textContent = text;
  el.className = 'score-badge';
  if (cls) el.classList.add(cls);
}

function showResult(text, cls) {
  const el = $('resultBanner');
  el.textContent = text;
  el.className = 'result-banner';
  if (cls) el.classList.add(cls);
  void el.offsetWidth;
  el.classList.add('show');
}

function hideResult() {
  const el = $('resultBanner');
  el.className = 'result-banner';
}

// ========================
//  CARD DOM RENDERING
// ========================
function createCardEl(card, faceDown = false) {
  const wrapper = document.createElement('div');
  wrapper.className = 'card-wrapper';

  const cardEl = document.createElement('div');
  cardEl.className = 'card' + (faceDown ? ' face-down' : '');

  // Front face
  const front = document.createElement('div');
  front.className = 'card-front' + (isRed(card.suit) ? ' red' : ' black');

  const topCorner = document.createElement('div');
  topCorner.className = 'card-corner';
  topCorner.innerHTML = `<span class="card-rank">${card.rank}</span><span class="card-suit-corner">${card.suit}</span>`;

  const botCorner = document.createElement('div');
  botCorner.className = 'card-corner bottom';
  botCorner.innerHTML = `<span class="card-rank">${card.rank}</span><span class="card-suit-corner">${card.suit}</span>`;

  const center = document.createElement('div');
  center.className = 'card-center-suit';
  center.textContent = card.suit;

  front.appendChild(topCorner);
  front.appendChild(center);
  front.appendChild(botCorner);

  // Back face
  const back = document.createElement('div');
  back.className = 'card-back';

  cardEl.appendChild(front);
  cardEl.appendChild(back);
  wrapper.appendChild(cardEl);
  return wrapper;
}

function renderHands() {
  // Player cards
  const playerArea = $('playerCards');
  playerArea.innerHTML = '';
  state.playerHand.forEach((card, i) => {
    const el = createCardEl(card, false);
    el.querySelector('.card').classList.add('flip');
    playerArea.appendChild(el);
  });

  // Dealer cards
  const dealerArea = $('dealerCards');
  dealerArea.innerHTML = '';
  state.dealerHand.forEach((card, i) => {
    const faceDown = !state.dealerRevealed && i === 1;
    const el = createCardEl(card, faceDown);
    el.querySelector('.card').classList.add('flip');
    dealerArea.appendChild(el);
  });
}

function updateScores() {
  const playerTotal = handTotal(state.playerHand);
  const isBust = playerTotal > 21;
  const isBlackjack21 = playerTotal === 21;
  setScoreBadge('player', playerTotal, isBust ? 'bust' : isBlackjack21 ? 'blackjack' : null);

  if (state.dealerRevealed) {
    const dealerTotal = handTotal(state.dealerHand);
    const isDealerBust = dealerTotal > 21;
    setScoreBadge('dealer', dealerTotal, isDealerBust ? 'bust' : null);
  } else {
    setScoreBadge('dealer', '?', null);
  }
}

// ========================
//  GAME ACTIONS
// ========================
function placeBet(amount) {
  playSound('chip');
  if (state.phase !== 'betting') return;
  if (state.chips < state.bet + amount) {
    // Can't bet more than available chips
    flashElement('chipsDisplay');
    return;
  }
  state.bet += amount;
  updateBetUI();
}

function clearBet() {
  if (state.phase !== 'betting') return;
  playSound('click');
  state.bet = 0;
  updateBetUI();
}

function flashElement(id) {
  const el = $(id);
  el.style.color = '#f87171';
  setTimeout(() => { el.style.color = ''; }, 400);
}

function dealOneCard() {
  if (state.deck.length < 10) {
    state.deck = createDeck();
  }
  return state.deck.pop();
}

async function startGame() {
  if (state.bet === 0) {
    flashElement('betDisplay');
    return;
  }
  if (state.chips < state.bet) return;
  playSound('click');

  // Deduct bet from chips
  state.chips -= state.bet;
  updateChipsUI();

  // Reset
  state.playerHand = [];
  state.dealerHand = [];
  state.dealerRevealed = false;
  state.phase = 'player';
  hideResult();

  // Deal 4 cards: P, D, P, D
  state.playerHand.push(dealOneCard());
  state.dealerHand.push(dealOneCard());
  state.playerHand.push(dealOneCard());
  state.dealerHand.push(dealOneCard());

  renderHands();
  updateScores();
  playSound('deal');

  // Check for Blackjack
  const playerTotal = handTotal(state.playerHand);
  const dealerTotal = handTotal(state.dealerHand);

  if (playerTotal === 21 || dealerTotal === 21) {
    // Reveal dealer
    await sleep(600);
    revealDealer();
    await sleep(400);
    endRound();
    return;
  }

  // Show player action buttons  
  setDisplay('bettingArea', 'none');
  setDisplay('actionArea', 'flex');

  // Only allow double if player has exactly 2 cards and enough chips
  $('doubleBtn').disabled = state.chips < state.bet;
}

async function playerHit() {
  if (state.phase !== 'player') return;
  playSound('deal');

  // After first hit, double is no longer available
  $('doubleBtn').disabled = true;

  state.playerHand.push(dealOneCard());
  renderHands();
  updateScores();

  const total = handTotal(state.playerHand);
  if (total >= 21) {
    await sleep(400);
    if (total > 21) {
      playSound('bust');
      setScoreBadge('player', total, 'bust');
    }
    await sleep(300);
    revealDealer();
    await sleep(300);
    endRound();
  }
}

async function playerStand() {
  if (state.phase !== 'player') return;
  playSound('click');
  state.phase = 'dealer';
  setDisplay('actionArea', 'none');

  revealDealer();
  await sleep(600);
  await runDealer();
  await sleep(300);
  endRound();
}

async function playerDouble() {
  if (state.phase !== 'player') return;
  if (state.chips < state.bet) return;

  playSound('chip');
  // Double the bet
  state.chips -= state.bet;
  state.bet *= 2;
  updateChipsUI();
  updateBetUI();

  // Deal one card, then stand
  $('doubleBtn').disabled = true;
  $('hitBtn').disabled = true;
  $('standBtn').disabled = true;

  await sleep(200);
  playSound('deal');
  state.playerHand.push(dealOneCard());
  renderHands();
  updateScores();

  await sleep(600);
  state.phase = 'dealer';
  setDisplay('actionArea', 'none');

  const pTotal = handTotal(state.playerHand);
  if (pTotal > 21) {
    playSound('bust');
    revealDealer();
    await sleep(400);
    endRound();
    return;
  }

  revealDealer();
  await sleep(600);
  await runDealer();
  await sleep(300);
  endRound();
}

async function runDealer() {
  // Dealer hits until 17+
  while (handTotal(state.dealerHand) < 17) {
    await sleep(600);
    playSound('deal');
    state.dealerHand.push(dealOneCard());
    renderHands();
    updateScores();
  }
}

function revealDealer() {
  state.dealerRevealed = true;
  playSound('flip');
  renderHands();
  updateScores();
}

function endRound() {
  state.phase = 'result';
  const pTotal = handTotal(state.playerHand);
  const dTotal = handTotal(state.dealerHand);
  const isNaturalBJ = pTotal === 21 && state.playerHand.length === 2;

  let result, soundType, chipsDelta = 0;

  if (pTotal > 21) {
    // Player bust — lose
    result = '💥 爆牌！';
    soundType = 'lose';
    chipsDelta = 0;
  } else if (dTotal > 21) {
    // Dealer bust — player wins
    chipsDelta = state.bet * 2;
    result = '🎉 庄家爆牌，你赢了！';
    soundType = 'win';
  } else if (pTotal === 21 && state.playerHand.length === 2 && !(dTotal === 21 && state.dealerHand.length === 2)) {
    // Player Blackjack (and dealer doesn't have Blackjack)
    chipsDelta = Math.floor(state.bet * 2.5); // 1.5x profit
    result = '🃏 Blackjack！ 赢得 1.5倍！';
    soundType = 'blackjack';
  } else if (pTotal > dTotal) {
    chipsDelta = state.bet * 2;
    result = '✨ 你赢了！';
    soundType = 'win';
  } else if (pTotal < dTotal) {
    chipsDelta = 0;
    result = '😞 你输了';
    soundType = 'lose';
  } else {
    // Push
    chipsDelta = state.bet; // return bet
    result = '🤝 平局';
    soundType = 'push';
  }

  state.chips += chipsDelta;
  updateChipsUI();

  const cls = soundType === 'blackjack' ? 'blackjack' :
    soundType === 'win' ? 'win' :
      soundType === 'lose' ? 'lose' : 'push';
  showResult(result, cls);
  playSound(soundType);

  // Show replay button
  setTimeout(() => {
    setDisplay('newRoundArea', 'flex');
  }, 800);

  // If chips gone, reset
  if (state.chips <= 0) {
    setTimeout(() => {
      state.chips = 1000;
      state.bet = 0;
      updateChipsUI();
      updateBetUI();
      showResult('筹码用完了！重置为 1000', 'push');
    }, 2000);
  }
}

function newRound() {
  state.bet = 0;
  state.phase = 'betting';
  state.playerHand = [];
  state.dealerHand = [];
  state.dealerRevealed = false;

  $('playerCards').innerHTML = '';
  $('dealerCards').innerHTML = '';
  hideResult();
  updateBetUI();
  setScoreBadge('player', '0', null);
  setScoreBadge('dealer', '?', null);

  setDisplay('newRoundArea', 'none');
  setDisplay('actionArea', 'none');
  setDisplay('bettingArea', 'flex');

  // Re-enable double button
  $('doubleBtn').disabled = false;
  $('hitBtn').disabled = false;
  $('standBtn').disabled = false;
}

// ========================
//  RULES PANEL
// ========================
function toggleRules() {
  const panel = $('rulesPanel');
  panel.classList.toggle('open');
  playSound('click');
}

// ========================
//  UTILITIES
// ========================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function goLobby() {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;z-index:9999;transition:opacity 0.4s ease;';
  document.body.appendChild(ov);
  requestAnimationFrame(() => {
    ov.style.opacity = '1';
    setTimeout(() => window.location.href = 'lobby.html', 400);
  });
}

// ========================
//  INIT
// ========================
window.addEventListener('load', () => {
  state.deck = createDeck();
  updateChipsUI();
  updateBetUI();
  setScoreBadge('dealer', '?', null);
  setScoreBadge('player', '0', null);
  initBGM();
});
