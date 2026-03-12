// ============================================================
//  斗地主 (Dou Di Zhu) - Complete Game Logic
// ============================================================

// ========================
//  CARD DEFINITIONS
// ========================
const SUITS = ['♣', '♦', '♥', '♠'];
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

// Card value for comparisons (3 lowest, 2 highest before jokers)
const RANK_VALUE = { '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14, '2': 15, '小王': 16, '大王': 17 };

function isRed(suit) { return suit === '♥' || suit === '♦'; }

function createDeck() {
    const deck = [];
    for (const rank of RANKS) {
        for (const suit of SUITS) {
            deck.push({ rank, suit, value: RANK_VALUE[rank] });
        }
    }
    deck.push({ rank: '小王', suit: '', value: 16 });
    deck.push({ rank: '大王', suit: '', value: 17 });
    return shuffle(deck);
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function sortCards(cards) {
    return [...cards].sort((a, b) => a.value - b.value || SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit));
}

// ========================
//  PATTERN DETECTION
// ========================
// Returns: { type, mainValue, length, kickers } or null if invalid
function detectPattern(cards) {
    if (!cards || cards.length === 0) return null;
    const n = cards.length;
    const vals = cards.map(c => c.value);
    const sorted = [...vals].sort((a, b) => a - b);

    // Frequency map
    const freq = {};
    for (const v of sorted) freq[v] = (freq[v] || 0) + 1;
    const groups = Object.entries(freq).map(([v, cnt]) => ({ v: +v, cnt }));
    groups.sort((a, b) => a.v - b.v);

    const counts = groups.map(g => g.cnt).sort((a, b) => a - b);
    const triples = groups.filter(g => g.cnt === 3);
    const pairs = groups.filter(g => g.cnt === 2);
    const quads = groups.filter(g => g.cnt === 4);

    // ROCKET (王炸)
    if (n === 2 && sorted[0] === 16 && sorted[1] === 17) {
        return { type: 'rocket', mainValue: 17, length: 2 };
    }

    // BOMB (炸弹)
    if (n === 4 && counts.every(c => c === 4)) {
        return { type: 'bomb', mainValue: sorted[0], length: 4 };
    }

    // SINGLE
    if (n === 1) return { type: 'single', mainValue: sorted[0], length: 1 };

    // PAIR
    if (n === 2 && counts[0] === 2) return { type: 'pair', mainValue: sorted[0], length: 2 };

    // TRIPLE (三张)
    if (n === 3 && counts[0] === 3) return { type: 'triple', mainValue: sorted[0], length: 3 };

    // TRIPLE + 1 (三带一)
    if (n === 4 && triples.length === 1 && groups.length === 2) {
        return { type: 'triple1', mainValue: triples[0].v, length: 4 };
    }

    // TRIPLE + 2 (三带二)
    if (n === 5 && triples.length === 1 && pairs.length === 1) {
        return { type: 'triple2', mainValue: triples[0].v, length: 5 };
    }

    // STRAIGHT (顺子): 5+ single, no 2 or joker, consecutive
    if (n >= 5 && groups.length === n) {
        // All unique, no 2 or joker
        if (sorted[sorted.length - 1] <= 14) {
            if (isConsecutive(sorted)) {
                return { type: 'straight', mainValue: sorted[0], length: n };
            }
        }
    }

    // CONSECUTIVE PAIRS (连对): 3+ pairs, consecutive
    if (n >= 6 && n % 2 === 0 && pairs.length === n / 2 && groups.length === n / 2) {
        const pVals = pairs.map(p => p.v);
        if (pVals[pVals.length - 1] <= 14 && isConsecutive(pVals)) {
            return { type: 'consepair', mainValue: pVals[0], length: n };
        }
    }

    // AIRPLANE (飞机): 2+ triples, consecutive, no kickers
    if (n >= 6 && triples.length >= 2 && triples.length * 3 === n) {
        const tVals = triples.map(t => t.v);
        if (tVals[tVals.length - 1] <= 14 && isConsecutive(tVals)) {
            return { type: 'plane', mainValue: tVals[0], length: n };
        }
    }

    // AIRPLANE + singles (飞机带单): 2+ triples + equal singles
    if (n >= 8) {
        const tCount = triples.length;
        const singleCount = groups.filter(g => g.cnt === 1).length;
        if (tCount >= 2 && tCount + singleCount === groups.length && tCount * 3 + singleCount === n) {
            const tVals = triples.map(t => t.v);
            if (tVals[tVals.length - 1] <= 14 && isConsecutive(tVals)) {
                return { type: 'plane1', mainValue: tVals[0], length: n };
            }
        }
    }

    // AIRPLANE + pairs (飞机带对): 2+ triples + equal pairs
    if (n >= 10) {
        const tCount = triples.length;
        const pCount = pairs.length;
        if (tCount >= 2 && tCount === pCount && tCount * 3 + pCount * 2 === n) {
            const tVals = triples.map(t => t.v);
            if (tVals[tVals.length - 1] <= 14 && isConsecutive(tVals)) {
                return { type: 'plane2', mainValue: tVals[0], length: n };
            }
        }
    }

    // QUAD + 2 singles (四带二)
    if (n === 6 && quads.length === 1 && groups.length === 3) {
        return { type: 'quad2', mainValue: quads[0].v, length: 6 };
    }

    // QUAD + 2 pairs (四带双)
    if (n === 8 && quads.length === 1 && pairs.length === 2) {
        return { type: 'quad2p', mainValue: quads[0].v, length: 8 };
    }

    return null; // Invalid
}

function isConsecutive(sortedVals) {
    for (let i = 1; i < sortedVals.length; i++) {
        if (sortedVals[i] !== sortedVals[i - 1] + 1) return false;
    }
    return true;
}

// ========================
//  PLAY COMPARISON
// ========================
function canBeat(newPlay, lastPlay) {
    if (!newPlay) return false;
    // Rocket beats everything
    if (newPlay.type === 'rocket') return true;
    // Bomb beats everything except rocket/bigger bomb
    if (newPlay.type === 'bomb') {
        if (lastPlay.type === 'rocket') return false;
        if (lastPlay.type === 'bomb') return newPlay.mainValue > lastPlay.mainValue;
        return true;
    }
    if (lastPlay.type === 'rocket') return false;
    if (lastPlay.type === 'bomb') return false;
    // Must match type and length
    if (newPlay.type !== lastPlay.type) return false;
    if (newPlay.length !== lastPlay.length) return false;
    return newPlay.mainValue > lastPlay.mainValue;
}

// ========================
//  GAME STATE
// ========================
let G = {
    phase: 'idle',   // idle | dealing | bidding | playing | result
    deck: [],
    hands: [[], [], []],  // 0=player, 1=ai1(left), 2=ai2(top)
    kitty: [],
    bidder: -1,       // who bids first
    landlord: -1,     // 0/1/2
    bids: [0, 0, 0],
    maxBid: 0,
    baseScore: 0,
    multiplier: 1,
    currentTurn: -1,  // 0/1/2
    lastPlay: null,         // { cards, pattern, player }
    lastRealPlay: null,     // last non-pass play
    passCount: 0,
    totalScore: 0,
    sortDescending: true,   // player's hand sort direction
    isPaused: false,        // global pause state
    aiMode: 'normal',       // normal | master
    pastRounds: []          // history of plays for LLM context: [{player, cards, pattern}]
};

const PLAYER = 0, AI1 = 1, AI2 = 2;
const NAMES = ['你', '右家（AI）', '上家（AI）'];
const ZONE_IDS = ['zone-player', 'zone-ai1', 'zone-ai2'];

// ========================
//  AUDIO (reuse existing files)
// ========================
const sfx = {
    deal: new Audio('assets/sounds/音效/翻牌.mp3'),
    chip: new Audio('assets/sounds/音效/下注.mp3'),
    win: new Audio('assets/sounds/音效/胜利.mp3'),
    lose: new Audio('assets/sounds/音效/爆牌.mp3'),
};

// BGM
const doudizhuBgm = new Audio('assets/斗地主牌桌序曲.mp3');
doudizhuBgm.loop = true;
doudizhuBgm.volume = 0.4;
let isBgmPlaying = false;

function toggleDoudizhuBgm() {
    isBgmPlaying = !isBgmPlaying;
    const span = document.querySelector('#doudizhuBgmBtn span');
    if (isBgmPlaying) {
        doudizhuBgm.play().catch(() => { });
        if (span) { span.textContent = 'ON'; span.style.color = '#4ade80'; }
    } else {
        doudizhuBgm.pause();
        if (span) { span.textContent = 'OFF'; span.style.color = '#fff'; }
    }
}

function playSound(type) {
    try {
        const a = sfx[type];
        if (!a) return;
        const c = a.cloneNode();
        c.volume = 0.6;
        c.play().catch(() => { });
    } catch (e) { }
}

// ========================
//  UI HELPERS
// ========================
function $(id) { return document.getElementById(id); }

/**
 * Enhanced sleep that respects global pause state
 */
async function sleep(ms) {
    let elapsed = 0;
    const interval = 100;
    while (elapsed < ms) {
        if (!G.isPaused) {
            elapsed += interval;
        }
        await new Promise(r => setTimeout(r, interval));
    }
}

function togglePause() {
    G.isPaused = !G.isPaused;
    const btn = $('btnPause');
    if (btn) {
        btn.textContent = G.isPaused ? '继续' : '暂停';
        btn.classList.toggle('paused', G.isPaused);
    }

    // Optional: show a pause overlay
    if (G.isPaused) {
        setTurnIndicator('游戏已暂停', false);
    } else {
        setTurnIndicator(G.currentTurn === PLAYER ? '轮到你' : `${NAMES[G.currentTurn]} 正在行动...`, G.currentTurn === PLAYER);
    }
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

/**
 * Switch AI mode between 'normal' and 'master'
 */
function setAiMode(mode) {
    G.aiMode = mode;
    console.log(`AI Mode switched to: ${mode}`);
}

function toggleRules() {
    $('rulesPanel').classList.toggle('open');
}

// Build a card DOM element
function makeCard(card, size = 'md') {
    const el = document.createElement('div');
    const isJoker = card.rank === '大王' || card.rank === '小王';
    const colorClass = isJoker ? (card.rank === '大王' ? 'joker-big' : 'joker-small') : (isRed(card.suit) ? 'red-card' : 'black-card');
    el.className = `play-card size-${size} ${colorClass}`;
    el.dataset.value = card.value;
    el.dataset.rank = card.rank;
    el.dataset.suit = card.suit;

    if (isJoker) {
        el.innerHTML = `<span class="card-rank card-rank-joker">JOKER</span><span class="card-suit">${card.rank === '大王' ? '🃏' : '🃏'}</span>`;
    } else {
        el.innerHTML = `<span class="card-rank">${card.rank}</span><span class="card-suit">${card.suit}</span><span class="card-center">${card.suit}</span>`;
    }
    return el;
}

function makeCardBack() {
    const el = document.createElement('div');
    el.className = 'ai-card-back';
    return el;
}

function renderAIHand(playerId, count) {
    const el = $(`hand-ai${playerId}`);
    el.innerHTML = '';
    for (let i = 0; i < count; i++) {
        el.appendChild(makeCardBack());
    }
}

/**
 * Core LLM decision function.
 * Connects to the local Python FastAPI server which acts as the anti-corruption layer for the LLM API.
 */
async function getLLMDecision(context) {
    const pfx = context.playerId === AI1 ? 'AI1' : 'AI2';
    setTurnIndicator(`${NAMES[context.playerId]} 正在思考大局...`, false);

    try {
        const response = await fetch('http://127.0.0.1:5000/api/ai-play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(context)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const decision = data.decision;

        if (decision === 'FALLBACK') {
            throw new Error("Backend triggered fallback mode.");
        }

        return decision;

    } catch (e) {
        console.warn("Failed to connect to AI server, falling back to rule-based:", e);
        // Rule-based Fallback directly here since it failed to get a valid response
        if (context.phase === 'bidding') {
            const strength = evaluateHand(context.hand);
            if (strength > 70) return 3;
            if (strength > 40 && context.maxBid < 2) return 2;
            return 0;
        }

        if (context.phase === 'playing') {
            if (context.mustPlay) return aiFindBestPlay(context.hand);
            return findBestPlay(context.hand, context.lastRealPlay ? context.lastRealPlay.pattern : null);
        }
    }
    return null;
}

function renderPlayerHand() {
    const el = $('hand-player');
    el.innerHTML = '';
    let sortedHand = sortCards(G.hands[PLAYER]);
    if (!G.sortDescending) {
        sortedHand = sortedHand.slice().reverse();
    }
    sortedHand.forEach((card, i) => {
        const cardEl = makeCard(card, 'lg');
        cardEl.dataset.idx = i;
        cardEl.onclick = () => toggleSelect(cardEl);
        el.appendChild(cardEl);
    });
    $('playerCardCount').textContent = G.hands[PLAYER].length;
}

function toggleSelect(cardEl) {
    if (G.phase !== 'playing' || G.currentTurn !== PLAYER) return;
    cardEl.classList.toggle('selected');
}

function toggleSort() {
    G.sortDescending = !G.sortDescending;
    renderPlayerHand();
}

function getSelectedCards() {
    const selected = [];
    const sortedHand = sortCards(G.hands[PLAYER]);
    document.querySelectorAll('#hand-player .play-card.selected').forEach(el => {
        const rank = el.dataset.rank;
        const suit = el.dataset.suit;
        const card = sortedHand.find(c => c.rank === rank && c.suit === suit && !selected.includes(c));
        if (card) selected.push(card);
    });
    return selected;
}

function showLastPlay(playerId, cards, isPass) {
    const pfx = playerId === PLAYER ? 'player' : `ai${playerId}`;
    const cardsEl = $(`lastplaycards-${pfx}`);
    const passEl = $(`pass-${pfx}`);

    // 只更新当前玩家的区域，保留其他玩家的展示
    cardsEl.innerHTML = '';
    passEl.style.display = 'none';

    if (isPass) {
        passEl.style.display = 'block';
    } else if (cards && cards.length > 0) {
        cards.forEach(card => cardsEl.appendChild(makeCard(card, 'sm')));
    }
}

function clearAllLastPlays() {
    [0, 1, 2].forEach(pid => {
        const pfx = pid === PLAYER ? 'player' : `ai${pid}`;
        $(`lastplaycards-${pfx}`).innerHTML = '';
        $(`pass-${pfx}`).style.display = 'none';
    });
}

function setTurnIndicator(msg, active = false) {
    const el = $('turnIndicator');
    el.textContent = msg;
    el.className = 'turn-indicator' + (active ? ' active' : '');
}

function updateScoreUI() {
    $('baseScore').textContent = G.baseScore > 0 ? G.baseScore + '分' : '—';
    $('multiplier').textContent = '×' + G.multiplier;
}

function setRoleBadge(playerId, role) {
    const pfx = playerId === PLAYER ? 'player' : `ai${playerId}`;
    const el = $(`role-${pfx}`);
    el.textContent = role === 'landlord' ? '地主' : '农民';
    el.className = 'role-badge ' + role;

    // 切换头像图片
    const avatarImg = $(`avatar-${pfx}`);
    if (avatarImg) {
        avatarImg.src = role === 'landlord'
            ? 'assets/landlord_avatar.png'
            : 'assets/farmer_avatar.png';
        avatarImg.classList.toggle('is-landlord', role === 'landlord');
    }
}

// 高亮当前出牌玩家的头像
function setActiveAvatar(playerId) {
    [0, 1, 2].forEach(i => {
        const pfx = i === PLAYER ? 'player' : `ai${i}`;
        const img = $(`avatar-${pfx}`);
        if (img) img.classList.toggle('is-active', i === playerId);
    });
}

function showBidArea(options) {
    $('bidArea').style.display = 'flex';
    $('playArea').style.display = 'none';
    $('startArea').style.display = 'none';
    // Enable/disable bid options based on maxBid
    $('bid1').disabled = G.maxBid >= 1;
    $('bid2').disabled = G.maxBid >= 2;
    $('bid3').disabled = G.maxBid >= 3;
}

function showPlayArea(canPass = true) {
    $('bidArea').style.display = 'none';
    $('playArea').style.display = 'flex';
    $('startArea').style.display = 'none';
    $('btnPass').disabled = !canPass;
    $('btnPlay').disabled = false;
    $('playHint').textContent = canPass ? '选择要出的牌，或跳过' : '必须出牌（你控场）';
}

function showStartArea() {
    $('bidArea').style.display = 'none';
    $('playArea').style.display = 'none';
    $('startArea').style.display = 'flex';
}

function renderKitty(reveal = false) {
    const el = $('kittyCards');
    el.innerHTML = '';
    if (reveal) {
        G.kitty.forEach(c => el.appendChild(makeCard(c, 'md')));
    } else {
        el.innerHTML = '<span class="kitty-hidden">● ● ●</span>';
    }
}

// ========================
//  GAME FLOW
// ========================
async function startGame() {
    // Reset state, preserving global settings
    G = {
        phase: 'dealing',
        deck: createDeck(),
        hands: [[], [], []],
        kitty: [],
        bidder: Math.floor(Math.random() * 3),
        landlord: -1,
        bids: [0, 0, 0],
        maxBid: 0,
        baseScore: 0,
        multiplier: 1,
        currentTurn: -1,
        lastPlay: null,
        lastRealPlay: null,
        passCount: 0,
        totalScore: G.totalScore || 0,
        sortDescending: G.sortDescending !== undefined ? G.sortDescending : true,
        isPaused: G.isPaused || false,
        aiMode: G.aiMode || 'normal',
        pastRounds: []
    };

    // Reset labels
    [0, 1, 2].forEach(i => {
        const pfx = i === PLAYER ? 'player' : `ai${i}`;
        const roleEl = $(`role-${pfx}`);
        if (roleEl) { roleEl.className = 'role-badge'; roleEl.textContent = ''; }
        const bidBadge = $(`bid-${pfx}`);
        if (bidBadge) { bidBadge.style.display = 'none'; bidBadge.textContent = ''; }
    });

    clearAllLastPlays();
    showStartArea();
    $('startArea').style.display = 'none';
    $('resultOverlay').style.display = 'none';
    setTurnIndicator('发牌中...', false);
    updateScoreUI();
    renderKitty(false);

    // Deal cards
    await sleep(300);
    playSound('deal');

    // 17 cards each, 3 kitty
    for (let i = 0; i < 17; i++) {
        G.hands[0].push(G.deck.pop());
        G.hands[1].push(G.deck.pop());
        G.hands[2].push(G.deck.pop());
    }
    G.kitty = [G.deck.pop(), G.deck.pop(), G.deck.pop()];

    renderPlayerHand();
    renderAIHand(1, G.hands[1].length);
    renderAIHand(2, G.hands[2].length);
    renderKitty(false);

    await sleep(400);
    G.phase = 'bidding';
    await runBidding();
}

// ========================
//  BIDDING PHASE
// ========================
async function runBidding() {
    let turn = G.bidder;
    let round = 0;

    while (round < 3) {
        G.currentTurn = turn;
        // 高亮当前叫分者
        ZONE_IDS.forEach((id, i) => $(id).classList.toggle('bidding-active', i === turn));

        if (turn === PLAYER) {
            setTurnIndicator('轮到你叫地主', true);
            showBidArea();
            await waitForPlayerBid();
            $('bidArea').style.display = 'none';
            await sleep(1800); // 给玩家叫分结果留出显示时间
        } else {
            setTurnIndicator(`${NAMES[turn]} 正在叫地主...`, false);
            await sleep(2000 + Math.random() * 2000); // 增加 AI 思考感
            const bid = await aiBid(turn);
            G.bids[turn] = bid;
            if (bid > G.maxBid) {
                G.maxBid = bid;
                G.landlord = turn;
            }
            showBidToast(turn, bid);
            await sleep(2000); // 增加显示结果时间
        }

        // If someone bid 3 (max), stop
        if (G.maxBid === 3) break;

        turn = (turn + 1) % 3;
        round++;
    }
    // 清除高亮
    ZONE_IDS.forEach(id => $(id).classList.remove('bidding-active'));

    // If no one bid, restart bidding (all pass scenario)
    if (G.landlord === -1) {
        // Auto-assign landlord to bidder
        G.landlord = G.bidder;
        G.maxBid = 1;
    }

    await assignLandlord();
}

let bidResolve = null;
function waitForPlayerBid() {
    return new Promise(r => { bidResolve = r; });
}

function playerBid(score) {
    if (G.phase !== 'bidding' || G.currentTurn !== PLAYER) return;
    G.bids[PLAYER] = score;
    if (score > G.maxBid) {
        G.maxBid = score;
        G.landlord = PLAYER;
    }
    $('bidArea').style.display = 'none';
    showBidToast(PLAYER, score);
    if (bidResolve) { bidResolve(); bidResolve = null; }
}

async function aiBid(playerId) {
    // If master mode, try LLM first
    if (G.aiMode === 'master') {
        try {
            const decision = await getLLMDecision({
                phase: 'bidding',
                playerId: playerId,
                hand: G.hands[playerId],
                maxBid: G.maxBid
            });
            if (typeof decision === 'number' && decision >= 0 && decision <= 3) {
                return decision;
            }
        } catch (e) {
            console.error('LLM Bidding Error, falling back to rule-based:', e);
        }
    }

    // Rule-based fallback
    const hand = G.hands[playerId];
    const score = evaluateHand(hand);
    const maxAllowed = G.maxBid;

    if (score >= 80 && maxAllowed < 3) return 3;
    if (score >= 55 && maxAllowed < 2) return 2;
    if (score >= 35 && maxAllowed < 1) return 1;
    // 30% chance to bid 1 if ok hand
    if (score >= 25 && maxAllowed < 1 && Math.random() > 0.5) return 1;
    return 0; // pass
}

function evaluateHand(hand) {
    let score = 0;
    for (const c of hand) {
        if (c.value === 17) score += 20; // big joker
        else if (c.value === 16) score += 15; // small joker
        else if (c.value === 15) score += 10; // 2
        else if (c.value === 14) score += 7;  // A
        else if (c.value === 13) score += 5;  // K
        else if (c.value >= 10) score += 3;

        // Bonus for pairs/triples
    }
    const freq = {};
    hand.forEach(c => freq[c.value] = (freq[c.value] || 0) + 1);
    Object.values(freq).forEach(cnt => {
        if (cnt === 4) score += 20; // bomb
        else if (cnt === 3) score += 8;
        else if (cnt === 2) score += 3;
    });
    return score;
}

function showBidToast(playerId, bid) {
    const pfx = playerId === PLAYER ? 'player' : `ai${playerId}`;
    const badge = $(`bid-${pfx}`);
    if (!badge) return;

    badge.style.display = 'block';
    badge.textContent = bid === 0 ? '不叫' : `叫 ${bid} 分`;

    if (bid > 0) {
        badge.style.background = bid >= 3 ? 'linear-gradient(135deg, #ff8c00, #ff4500)' :
            bid >= 2 ? 'linear-gradient(135deg, #fde68a, #fbbf24)' :
                'linear-gradient(135deg, #d9f99d, #84cc16)';
        badge.style.color = bid >= 3 ? '#fff' : '#92400e';
    } else {
        badge.style.background = 'linear-gradient(135deg, #e5e7eb, #9ca3af)';
        badge.style.color = '#374151';
    }
}

async function assignLandlord() {
    G.baseScore = G.maxBid;
    setTurnIndicator(`${NAMES[G.landlord]} 成为地主！`, true);

    // Give kitty to landlord
    G.hands[G.landlord].push(...G.kitty);
    renderKitty(true);
    await sleep(800);

    // Set roles
    [0, 1, 2].forEach(i => setRoleBadge(i, i === G.landlord ? 'landlord' : 'farmer'));

    // Hide bid badges
    [0, 1, 2].forEach(i => {
        const pfx = i === PLAYER ? 'player' : `ai${i}`;
        const badge = $(`bid-${pfx}`);
        if (badge) badge.style.display = 'none';
    });

    updateScoreUI();
    clearAllLastPlays();

    if (G.landlord === PLAYER) {
        renderPlayerHand();
    } else {
        renderAIHand(G.landlord, G.hands[G.landlord].length);
    }

    await sleep(600);
    playSound('deal');

    G.phase = 'playing';
    G.currentTurn = G.landlord;
    G.lastRealPlay = null;
    G.passCount = 0;
    G.passCount = 0;
    await runPlay();
}

// ========================
//  PLAY PHASE
// ========================
async function runPlay() {
    while (G.phase === 'playing') {
        const winner = checkWinner();
        if (winner !== -1) {
            await endGame(winner);
            return;
        }

        G.currentTurn = G.currentTurn % 3;

        if (G.currentTurn === PLAYER) {
            const mustPlay = (G.lastRealPlay === null || G.lastRealPlay.player === PLAYER);
            setTurnIndicator('轮到你出牌', true);
            setActiveAvatar(PLAYER);
            showPlayArea(!mustPlay ? true : false);
            // Wait for player
            await waitForPlayerPlay();
        } else {
            setTurnIndicator(`${NAMES[G.currentTurn]} 出牌中...`, false);
            setActiveAvatar(G.currentTurn);
            $('playArea').style.display = 'none';
            await sleep(700 + Math.random() * 700);
            try {
                await doAIPlay(G.currentTurn);
            } catch (e) {
                console.warn('AI 出牌出错，强制跳过', e);
                // 强制跳过，避免游戏卡死
                G.passCount++;
                showLastPlay(G.currentTurn, [], true);
                if (G.passCount >= 2) {
                    G.lastRealPlay = null;
                    G.passCount = 0;
                    clearAllLastPlays();
                }
            }
        }

        const winner2 = checkWinner();
        if (winner2 !== -1) {
            await endGame(winner2);
            return;
        }

        G.currentTurn = (G.currentTurn + 1) % 3;
    }
}

let playResolve = null;
function waitForPlayerPlay() {
    $('btnPlay').disabled = false;
    return new Promise(r => { playResolve = r; });
}

async function playerPlay() {
    if (G.phase !== 'playing' || G.currentTurn !== PLAYER) return;
    const selected = getSelectedCards();
    if (selected.length === 0) {
        $('playHint').textContent = '⚠ 请先选择要出的牌';
        return;
    }
    const pattern = detectPattern(selected);
    if (!pattern) {
        $('playHint').textContent = '⚠ 牌型不合法';
        return;
    }

    const mustPlay = (G.lastRealPlay === null || G.lastRealPlay.player === PLAYER);
    if (!mustPlay && !canBeat(pattern, G.lastRealPlay.pattern)) {
        $('playHint').textContent = '⚠ 出的牌打不过上家';
        return;
    }

    // Execute play
    removeCardsFromHand(PLAYER, selected);
    G.lastRealPlay = { cards: selected, pattern, player: PLAYER };
    G.passCount = 0;

    if (pattern.type === 'bomb' || pattern.type === 'rocket') {
        G.multiplier *= 2;
        updateScoreUI();
        playSound('chip');
    } else {
        playSound('deal');
    }

    showLastPlay(PLAYER, selected, false);
    renderPlayerHand();
    $('playArea').style.display = 'none';

    if (playResolve) { playResolve(); playResolve = null; }

    // Record for LLM history
    G.pastRounds.push({
        player: PLAYER,
        playerName: NAMES[PLAYER],
        cards: [...selected],
        pattern: detectPattern(selected)
    });
}

async function playerPass() {
    if (G.phase !== 'playing' || G.currentTurn !== PLAYER) return;
    const mustPlay = (G.lastRealPlay === null || G.lastRealPlay.player === PLAYER);
    if (mustPlay) {
        $('playHint').textContent = '⚠ 你控场，必须出牌';
        return;
    }

    G.passCount++;
    showLastPlay(PLAYER, [], true);
    $('playArea').style.display = 'none';

    // Record for LLM history
    G.pastRounds.push({
        player: PLAYER,
        playerName: NAMES[PLAYER],
        cards: [],
        pattern: { type: 'pass' }
    });

    // If everyone passed the last real play, reset
    if (G.passCount >= 2) {
        G.lastRealPlay = null;
        G.passCount = 0;
        clearAllLastPlays();
    }

    if (playResolve) { playResolve(); playResolve = null; }
}

function playerHint() {
    const hand = G.hands[PLAYER];
    const mustPlay = (G.lastRealPlay === null || G.lastRealPlay.player === PLAYER);
    let suggestion;
    if (mustPlay) {
        // Find smallest single
        suggestion = [sortCards(hand)[0]];
    } else {
        suggestion = findBestPlay(hand, G.lastRealPlay.pattern);
    }
    if (!suggestion) {
        $('playHint').textContent = '提示：没有可出的牌，跳过';
        return;
    }
    // Auto-select hinted cards
    document.querySelectorAll('#hand-player .play-card').forEach(el => el.classList.remove('selected'));
    const sortedHand = sortCards(hand);
    suggestion.forEach(card => {
        const el = [...document.querySelectorAll('#hand-player .play-card')]
            .find(e => e.dataset.rank === card.rank && e.dataset.suit === card.suit && !e.classList.contains('selected'));
        if (el) el.classList.add('selected');
    });
    $('playHint').textContent = '提示已选出，确认后点击「出牌」';
}

async function doAIPlay(playerId) {
    const hand = G.hands[playerId];
    const mustPlay = (G.lastRealPlay === null || G.lastRealPlay.player === playerId);

    let chosen = null;

    // If master mode, try LLM first
    if (G.aiMode === 'master') {
        try {
            const decision = await getLLMDecision({
                phase: 'playing',
                playerId: playerId,
                hand: hand,
                mustPlay: mustPlay,
                lastRealPlay: G.lastRealPlay,
                pastRounds: G.pastRounds
            });
            if (decision === 'PASS') {
                chosen = null;
            } else if (Array.isArray(decision)) {
                // Validate if cards are in hand and get actual card objects with .value
                const validCards = decision.map(c => hand.find(h => h.rank === c.rank && h.suit === c.suit)).filter(Boolean);
                if (validCards.length === decision.length) {
                    chosen = validCards;
                }
            }
        } catch (e) {
            console.error('LLM Playing Error, falling back to rule-based:', e);
        }
    }

    // Rule-based fallback (if LLM failed or in normal mode)
    if (G.aiMode === 'normal' || !chosen) {
        if (mustPlay) {
            chosen = aiFindBestPlay(hand);
        } else {
            chosen = findBestPlay(hand, G.lastRealPlay.pattern);
        }
    }

    // 安全检查：过滤掉任何 undefined 的牌（防止 findBeat* 函数返回异常值）
    if (chosen) {
        chosen = chosen.filter(c => c != null && c.rank != null);
        if (chosen.length === 0) chosen = null;
    }

    if (!chosen) {
        // Pass
        G.passCount++;
        showLastPlay(playerId, [], true);
        if (G.passCount >= 2) {
            G.lastRealPlay = null;
            G.passCount = 0;
            clearAllLastPlays();
        }

        // Record for LLM history
        G.pastRounds.push({
            player: playerId,
            playerName: NAMES[playerId],
            cards: [],
            pattern: { type: 'pass' }
        });
    } else {
        const pattern = detectPattern(chosen);
        if (!pattern) {
            // 检测到非法牌型，强制跳过
            G.passCount++;
            showLastPlay(playerId, [], true);
            if (G.passCount >= 2) {
                G.lastRealPlay = null;
                G.passCount = 0;
                clearAllLastPlays();
            }
            return;
        }
        G.passCount = 0;
        G.lastRealPlay = { cards: chosen, pattern, player: playerId };
        removeCardsFromHand(playerId, chosen);

        if (pattern.type === 'bomb' || pattern.type === 'rocket') {
            G.multiplier *= 2;
            updateScoreUI();
            playSound('chip');
        } else {
            playSound('deal');
        }

        showLastPlay(playerId, chosen, false);
        renderAIHand(playerId, hand.length);

        // Record for LLM history
        G.pastRounds.push({
            player: playerId,
            playerName: NAMES[playerId],
            cards: [...chosen],
            pattern: pattern
        });
    }
}

// ========================
//  AI STRATEGY (Greedy)
// ========================
function aiFindBestPlay(hand) {
    const sorted = sortCards(hand);
    const smallest = sorted[0];
    const freq = getFreqMap(hand);

    // 如果最小的牌有对子，就出对子；否则出单张
    if (freq[smallest.value] >= 2) {
        return hand.filter(c => c.value === smallest.value).slice(0, 2);
    }
    return [smallest];
}

function findBestPlay(hand, lastPattern) {
    if (!lastPattern) return null;
    const sorted = sortCards(hand);

    // Try bomb first only if last pattern is strong
    if (lastPattern.type !== 'bomb' && lastPattern.type !== 'rocket') {
        const bomb = tryFindBomb(hand);
        if (bomb && Math.random() > 0.6) return bomb; // 40% chance AI uses bomb conservatively
    }

    if (lastPattern.type === 'rocket') return null; // Can't beat rocket

    // Try matching pattern
    switch (lastPattern.type) {
        case 'single': return findBeatSingle(hand, lastPattern);
        case 'pair': return findBeatPair(hand, lastPattern);
        case 'triple': return findBeatTriple(hand, lastPattern);
        case 'triple1': return findBeatTriple1(hand, lastPattern);
        case 'triple2': return findBeatTriple2(hand, lastPattern);
        case 'straight': return findBeatStraight(hand, lastPattern);
        case 'consepair': return findBeatConsePair(hand, lastPattern);
        case 'plane': return findBeatPlane(hand, lastPattern);
        case 'bomb': return tryFindBiggerBomb(hand, lastPattern);
        default: return null;
    }
}

function findBeatSingle(hand, last) {
    const sorted = sortCards(hand);
    const found = sorted.find(c => c.value > last.mainValue);
    return found ? [found] : null;
}

function findBeatPair(hand, last) {
    const freq = getFreqMap(hand);
    for (const [v, cnt] of sortedFreqEntries(freq)) {
        if (v > last.mainValue && cnt >= 2) {
            return hand.filter(c => c.value === v).slice(0, 2);
        }
    }
    return null;
}

function findBeatTriple(hand, last) {
    const freq = getFreqMap(hand);
    for (const [v, cnt] of sortedFreqEntries(freq)) {
        if (v > last.mainValue && cnt >= 3) {
            return hand.filter(c => c.value === v).slice(0, 3);
        }
    }
    return null;
}

function findBeatTriple1(hand, last) {
    const triple = findBeatTriple(hand, { mainValue: last.mainValue });
    if (!triple) return null;
    const tripleVal = triple[0].value;
    const kicker = hand.find(c => c.value !== tripleVal);
    if (!kicker) return null;
    return [...triple, kicker];
}

function findBeatTriple2(hand, last) {
    const triple = findBeatTriple(hand, { mainValue: last.mainValue });
    if (!triple) return null;
    const tripleVal = triple[0].value;
    const freq = getFreqMap(hand.filter(c => c.value !== tripleVal));
    for (const [v, cnt] of sortedFreqEntries(freq)) {
        if (cnt >= 2) {
            const pair = hand.filter(c => c.value === v).slice(0, 2);
            return [...triple, ...pair];
        }
    }
    return null;
}

function findBeatStraight(hand, last) {
    const len = last.length;
    const minVal = last.mainValue + 1;
    const sorted = sortCards(hand.filter(c => c.value <= 14));
    for (let startVal = minVal; startVal <= 14 - len + 1; startVal++) {
        const straight = [];
        for (let v = startVal; v < startVal + len; v++) {
            const c = sorted.find(card => card.value === v && !straight.includes(card));
            if (!c) break;
            straight.push(c);
        }
        if (straight.length === len) return straight;
    }
    return null;
}

function findBeatConsePair(hand, last) {
    const pairCount = last.length / 2;
    const minVal = last.mainValue + 1;
    const sorted = sortCards(hand.filter(c => c.value <= 14));
    const freq = getFreqMap(hand);
    for (let startVal = minVal; startVal <= 14 - pairCount + 1; startVal++) {
        const pairs = [];
        for (let v = startVal; v < startVal + pairCount; v++) {
            if ((freq[v] || 0) >= 2) {
                pairs.push(...hand.filter(c => c.value === v).slice(0, 2));
            } else break;
        }
        if (pairs.length === last.length) return pairs;
    }
    return null;
}

function findBeatPlane(hand, last) {
    const tripleCount = last.length / 3;
    const minVal = last.mainValue + 1;
    const freq = getFreqMap(hand);
    const tripleVals = Object.entries(freq).filter(([v, cnt]) => cnt >= 3 && +v <= 14 && +v >= minVal).map(([v]) => +v).sort((a, b) => a - b);
    for (let i = 0; i <= tripleVals.length - tripleCount; i++) {
        const seq = tripleVals.slice(i, i + tripleCount);
        if (isConsecutive(seq)) {
            return seq.flatMap(v => hand.filter(c => c.value === v).slice(0, 3));
        }
    }
    return null;
}

function tryFindBomb(hand) {
    const freq = getFreqMap(hand);
    for (const [v, cnt] of sortedFreqEntries(freq)) {
        if (cnt === 4) return hand.filter(c => c.value === +v);
    }
    // Try rocket
    const bj = hand.find(c => c.value === 16);
    const sj = hand.find(c => c.value === 17);
    // NOTE: small joker is 16, big joker is 17 (wait, let me check... RANK_VALUE: 小王:16, 大王:17)
    const smallJ = hand.find(c => c.rank === '小王');
    const bigJ = hand.find(c => c.rank === '大王');
    if (smallJ && bigJ) return [smallJ, bigJ];
    return null;
}

function tryFindBiggerBomb(hand, last) {
    const freq = getFreqMap(hand);
    for (const [v, cnt] of sortedFreqEntries(freq)) {
        if (cnt === 4 && +v > last.mainValue) return hand.filter(c => c.value === +v);
    }
    const smallJ = hand.find(c => c.rank === '小王');
    const bigJ = hand.find(c => c.rank === '大王');
    if (smallJ && bigJ && last.type !== 'rocket') return [smallJ, bigJ];
    return null;
}

function getFreqMap(hand) {
    const freq = {};
    hand.forEach(c => freq[c.value] = (freq[c.value] || 0) + 1);
    return freq;
}

function sortedFreqEntries(freq) {
    return Object.entries(freq).map(([v, cnt]) => [+v, cnt]).sort((a, b) => a[0] - b[0]);
}

// ========================
//  REMOVE CARDS FROM HAND
// ========================
function removeCardsFromHand(playerId, cards) {
    cards.forEach(card => {
        const idx = G.hands[playerId].findIndex(c => c.rank === card.rank && c.suit === card.suit);
        if (idx !== -1) G.hands[playerId].splice(idx, 1);
    });
}

// ========================
//  WIN CHECK
// ========================
function checkWinner() {
    for (let i = 0; i < 3; i++) {
        if (G.hands[i].length === 0) return i;
    }
    return -1;
}

// ========================
//  GAME END
// ========================
async function endGame(winner) {
    G.phase = 'result';
    $('playArea').style.display = 'none';

    const landlordWon = winner === G.landlord;
    const scorePerFarmer = G.baseScore * G.multiplier;
    let scoreDelta = 0;

    if (winner === PLAYER) {
        scoreDelta = (G.landlord === PLAYER) ? scorePerFarmer * 2 : scorePerFarmer;
        playSound('win');
    } else {
        scoreDelta = (G.landlord === PLAYER) ? -scorePerFarmer * 2 : -scorePerFarmer;
        playSound('lose');
    }

    G.totalScore += scoreDelta;

    // Final render (show all hands)
    if (G.landlord !== PLAYER) renderPlayerHand();

    await sleep(600);

    const isWin = scoreDelta > 0;
    const emoji = isWin ? '🎉' : '😞';
    const title = isWin ? '你赢了！' : '你输了';
    const roleStr = NAMES[G.landlord] + '是地主';
    const winnerStr = NAMES[winner] + '先出完牌';
    const sub = `${roleStr}｜${winnerStr}`;

    $('resultEmoji').textContent = emoji;
    $('resultTitle').textContent = title;
    $('resultSub').textContent = sub;
    $('resultScore').textContent = (scoreDelta > 0 ? '+' : '') + scoreDelta;
    $('resultScore').style.color = scoreDelta > 0 ? '#4ade80' : '#f87171';
    $('resultTotal').lastChild && ($('resultTotal').innerHTML = `<span>累计积分</span><span>${G.totalScore}</span>`);
    $('resultOverlay').style.display = 'flex';
}

// ========================
//  INIT
// ========================
window.addEventListener('load', () => {
    showStartArea();
    setTurnIndicator('点击「开始游戏」开始对局');
    renderKitty(false);
    updateScoreUI();
    $('myScore').textContent = '0';

    // Attempt Auto-play BGM
    doudizhuBgm.play().then(() => {
        isBgmPlaying = true;
        const span = document.querySelector('#doudizhuBgmBtn span');
        if (span) { span.textContent = 'ON'; span.style.color = '#4ade80'; }
    }).catch(() => { });
});
