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

// TTS语音系统 - 内嵌语音映射，无需网络请求
const VOICE_MAPPING = {
    "让你们来吧": "assets/voices/让你们来吧_df2bb5f8.wav",
    "我就看看": "assets/voices/我就看看_25098ecb.wav",
    "这手牌一般般": "assets/voices/这手牌一般般_315025e3.wav",
    "不叫": "assets/voices/不叫_0c712120.wav",
    "手牌不太行": "assets/voices/手牌不太行_d713c2e6.wav",
    "先观望一下": "assets/voices/先观望一下_a60722e5.wav",
    "试试看": "assets/voices/试试看_bb5e4c8d.wav",
    "叫一分": "assets/voices/叫一分_6324e44a.wav",
    "我来试试": "assets/voices/我来试试_efe9deb6.wav",
    "好牌必须叫": "assets/voices/好牌必须叫_97433d99.wav",
    "两分": "assets/voices/两分_aa2d006a.wav",
    "这手牌不错": "assets/voices/这手牌不错_17520179.wav",
    "三分到底": "assets/voices/三分到底_ddad80e9.wav",
    "必胜之局": "assets/voices/必胜之局_14bf332e.wav",
    "这把稳了": "assets/voices/这把稳了_ae1b8538.wav",
    "不要": "assets/voices/不要_498957b3.wav",
    "跟不起": "assets/voices/跟不起_1853f730.wav",
    "让你过": "assets/voices/让你过_9948dfb9.wav",
    "先等等": "assets/voices/先等等_ebd602fb.wav",
    "不出": "assets/voices/不出_72447182.wav",
    "等等看": "assets/voices/等等看_57e2bce2.wav",
    "炸弹来了": "assets/voices/炸弹来了_1c7aba83.wav",
    "爆炸": "assets/voices/爆炸_0652742f.wav",
    "哈哈炸弹": "assets/voices/哈哈炸弹_68eb7811.wav",
    "王炸": "assets/voices/王炸_aceffeef.wav",
    "双王出击": "assets/voices/双王出击_a08adb98.wav",
    "无敌了": "assets/voices/无敌了_cf3b5298.wav",
    "长牌压制": "assets/voices/长牌压制_7652253b.wav",
    "顺子走起": "assets/voices/顺子走起_e3be537c.wav",
    "连牌漂亮": "assets/voices/连牌漂亮_5610c30a.wav",
    "大牌压制": "assets/voices/大牌压制_09c8fc48.wav",
    "2来了": "assets/voices/2来了_dc1976d5.wav",
    "压你一手": "assets/voices/压你一手_824ae647.wav",
    "出张小牌": "assets/voices/出张小牌_5cbf6376.wav",
    "试探一下": "assets/voices/试探一下_0b98377a.wav",
    "先出个小的": "assets/voices/先出个小的_295a0a03.wav",
    "跟上": "assets/voices/跟上_9a977c6d.wav",
    "出牌": "assets/voices/出牌_50fecc59.wav",
    "来了": "assets/voices/来了_0424ac2f.wav",
    "接着": "assets/voices/接着_7c90c225.wav"
};

let voiceMapping = VOICE_MAPPING;
let audioCache = {};
let audioEnabled = false;
let audioUnlocked = false;

// 文档级别点击解锁 —— 覆盖所有用户交互场景
function _unlockAudioOnce() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    // 预创建全部语音 Audio 对象，确保在用户手势上下文中完成
    Object.entries(VOICE_MAPPING).forEach(([text, path]) => {
        try {
            const a = new Audio(encodeURI(path));
            a.preload = 'auto';
            a.volume = 0.7;
            audioCache[text] = a;
        } catch (e) { /* ignore */ }
    });
    console.log('音频已解锁，预创建', Object.keys(audioCache).length, '个语音对象');
}
document.addEventListener('click', _unlockAudioOnce, { once: true });

// 初始化音频系统（游戏开始时调用）
function initAudioSystem() {
    _unlockAudioOnce();   // 确保在按钮点击上下文中运行
    audioEnabled = true;
    console.log('音频系统已激活');
}

// 加载语音映射文件（内嵌映射已就绪，此函数保留作兼容用途）
async function loadVoiceMapping() {
    console.log('语音映射已就绪:', Object.keys(voiceMapping).length, '个语音文件');
}

// 播放语音
function playVoice(text) {
    if (!audioEnabled) {
        console.log('音频系统未激活，跳过语音播放:', text);
        return;
    }

    if (!VOICE_MAPPING[text]) {
        console.log('没有找到语音文件:', text);
        return;
    }

    const play = (audio) => {
        audio.currentTime = 0;
        const p = audio.play();
        if (p && typeof p.catch === 'function') {
            p.catch(err => console.warn('语音播放失败 [' + text + ']:', err.message));
        }
    };

    // 优先使用预创建的缓存对象
    if (audioCache[text]) {
        play(audioCache[text]);
        return;
    }

    // 回退：即时创建（应该不会走到这里）
    const audio = new Audio(encodeURI(VOICE_MAPPING[text]));
    audio.volume = 0.7;
    audioCache[text] = audio;
    play(audio);
}

// ========================
//  AUDIO (reuse existing files)
// ========================
const sfx = {
    deal: new Audio('assets/sounds/音效/翻牌.mp3'),
    chip: new Audio('assets/sounds/音效/下注.mp3'),
    win: new Audio('assets/sounds/音效/胜利.mp3'),
    lose: new Audio('assets/sounds/音效/爆牌.mp3'),
    bomb: new Audio('assets/bomb.mp3'),
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
//  DIALOGUE SYSTEM
// ========================
function generateLocalBiddingDialogue(bid, maxBid, hand) {
    if (bid === 0) {
        if (maxBid >= 2) {
            return ['让你们来吧', '我就看看', '这手牌一般般'][Math.floor(Math.random() * 3)];
        } else {
            return ['不叫', '手牌不太行', '先观望一下'][Math.floor(Math.random() * 3)];
        }
    } else if (bid === 1) {
        return ['试试看', '叫一分', '我来试试'][Math.floor(Math.random() * 3)];
    } else if (bid === 2) {
        return ['好牌必须叫', '两分', '这手牌不错'][Math.floor(Math.random() * 3)];
    } else if (bid === 3) {
        return ['三分到底', '必胜之局', '这把稳了'][Math.floor(Math.random() * 3)];
    }
    return '';
}

function generateLocalPlayingDialogue(action, lastRealPlay, isLandlord, playedCards = null) {
    if (action === "pass") {
        if (lastRealPlay) {
            return ['不要', '跟不起', '让你过', '先等等'][Math.floor(Math.random() * 4)];
        } else {
            return ['不出', 'pass', '等等看'][Math.floor(Math.random() * 3)];
        }
    } else if (action === "play" && playedCards) {
        const cardCount = playedCards.length;
        
        // Detect if it's a special play
        if (cardCount === 4) { // Possible bomb
            return ['炸弹来了', '爆炸', '哈哈炸弹'][Math.floor(Math.random() * 3)];
        } else if (cardCount === 2 && playedCards.some(c => c.rank === '小王' || c.rank === '大王')) { // Rocket
            return ['王炸', '双王出击', '无敌了'][Math.floor(Math.random() * 3)];
        } else if (cardCount >= 5) { // Long sequence
            return ['长牌压制', '顺子走起', '连牌漂亮'][Math.floor(Math.random() * 3)];
        } else if (cardCount === 1) {
            if (playedCards[0].value >= 15) { // 2 or joker
                return ['大牌压制', '2来了', '压你一手'][Math.floor(Math.random() * 3)];
            } else {
                return ['出张小牌', '试探一下', '先出个小的'][Math.floor(Math.random() * 3)];
            }
        } else {
            return ['跟上', '出牌', '来了', '接着'][Math.floor(Math.random() * 4)];
        }
    }
    
    return '';
}

function showAIDialogue(playerId, dialogue) {
    if (!dialogue || dialogue.trim() === '') return;
    
    const pfx = playerId === PLAYER ? 'player' : `ai${playerId}`;
    const avatarElement = $(`avatar-${pfx}`);
    
    if (!avatarElement) return;
    
    // 播放语音
    playVoice(dialogue);
    
    // Create dialogue bubble
    const bubble = document.createElement('div');
    bubble.className = 'ai-dialogue-bubble';
    
    // 智能分类对话样式
    const dialogueType = classifyDialogue(dialogue);
    if (dialogueType !== 'normal') {
        bubble.classList.add(dialogueType);
    }
    
    // 直接设置文本内容，不使用打字机效果
    bubble.textContent = dialogue;
    
    // Position the bubble relative to the avatar
    const container = avatarElement.closest('.player-zone') || avatarElement.closest('.player-info-row');
    
    if (container) {
        container.style.position = 'relative';
        bubble.style.position = 'absolute';
        
        if (playerId === AI2) { // Top AI
            bubble.style.bottom = '100%';
            bubble.style.left = '50%';
            bubble.style.transform = 'translateX(-50%)';
            bubble.style.marginBottom = '8px';
        } else if (playerId === AI1) { // Right AI
            bubble.style.right = '100%';
            bubble.style.top = '50%';
            bubble.style.transform = 'translateY(-50%)';
            bubble.style.marginRight = '8px';
        } else { // Player (shouldn't happen, but just in case)
            bubble.style.top = '100%';
            bubble.style.left = '50%';
            bubble.style.transform = 'translateX(-50%)';
            bubble.style.marginTop = '8px';
        }
        
        // Remove any existing dialogue bubbles from this player
        const existingBubble = container.querySelector('.ai-dialogue-bubble');
        if (existingBubble) {
            existingBubble.remove();
        }
        
        container.appendChild(bubble);
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (bubble && bubble.parentNode) {
                bubble.style.opacity = '0';
                setTimeout(() => {
                    if (bubble && bubble.parentNode) {
                        bubble.remove();
                    }
                }, 300);
            }
        }, 3000);
    }
}

/**
 * 根据对话内容智能分类样式
 */
function classifyDialogue(dialogue) {
    const excited = ['炸弹', '王炸', '爆炸', '哈哈', '三分到底', '必胜', '稳了', '无敌'];
    const confident = ['好牌必须叫', '大牌压制', '压你一手', '来了', '2来了', '必胜之局'];
    const casual = ['试试看', '叫一分', '我来试试', '出张小牌', '试探一下', '先出个小的'];
    
    for (const keyword of excited) {
        if (dialogue.includes(keyword)) return 'excited';
    }
    
    for (const keyword of confident) {
        if (dialogue.includes(keyword)) return 'confident';
    }
    
    for (const keyword of casual) {
        if (dialogue.includes(keyword)) return 'casual';
    }
    
    return 'normal';
}


// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    // No-op
});

/**
 * Restart the game immediately
 */
function restartGame() {
    if (confirm('确定要重新开始当前对局吗？')) {
        // Clear all visuals
        clearAllLastPlays();
        $('resultOverlay').style.display = 'none';

        // Re-enable AI mode selection just in case
        const modeSelect = $('aiModeSelect');
        if (modeSelect) modeSelect.disabled = false;

        // Reset scores if you want a clean slate, or keep them? 
        // Typically "Restart" means reset current game board, so let's just trigger startGame
        startGame();
    }
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
    if (G.phase !== 'idle' && G.phase !== 'result') {
        console.warn('Cannot switch AI mode during a game.');
        // Revert UI to match current G.aiMode
        const select = $('aiModeSelect');
        if (select) select.value = G.aiMode;
        return;
    }
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

        // Display AI dialogue if available
        if (data.dialogue) {
            showAIDialogue(context.playerId, data.dialogue);
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
    // 初始化音频系统（用户点击开始游戏时）
    initAudioSystem();
    
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

    // Disable AI mode selection
    const modeSelect = $('aiModeSelect');
    if (modeSelect) modeSelect.disabled = true;

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
            await sleep(1500); // 玩家叫分结果显示
        } else {
            setTurnIndicator(`${NAMES[turn]} 正在叫地主...`, false);
            await sleep(1500 + Math.random() * 800); // AI 叫分思考 1.5~2.3秒
            const bid = await aiBid(turn);
            G.bids[turn] = bid;
            if (bid > G.maxBid) {
                G.maxBid = bid;
                G.landlord = turn;
            }
            showBidToast(turn, bid);
            await sleep(1500); // 叫分结果显示
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
    let decision;
    let dialogue = '';

    // If master mode, try LLM first
    if (G.aiMode === 'master') {
        try {
            const result = await getLLMDecision({
                phase: 'bidding',
                playerId: playerId,
                hand: G.hands[playerId],
                maxBid: G.maxBid,
                landlordId: G.landlord
            });
            if (typeof result === 'number' && result >= 0 && result <= 3) {
                decision = result;
                // Dialogue already handled in getLLMDecision
                return decision;
            }
        } catch (e) {
            console.error('LLM Bidding Error, falling back to rule-based:', e);
        }
    }

    // Rule-based fallback (for normal mode or LLM failure)
    const hand = G.hands[playerId];
    const score = evaluateHand(hand);
    const maxAllowed = G.maxBid;

    if (score >= 80 && maxAllowed < 3) decision = 3;
    else if (score >= 55 && maxAllowed < 2) decision = 2;
    else if (score >= 35 && maxAllowed < 1) decision = 1;
    else if (score >= 25 && maxAllowed < 1 && Math.random() > 0.5) decision = 1;
    else decision = 0;

    // Generate dialogue for normal mode (100% chance)
    if (G.aiMode === 'normal' && Math.random() < 1.0) {
        dialogue = generateLocalBiddingDialogue(decision, G.maxBid, hand);
        if (dialogue) {
            showAIDialogue(playerId, dialogue);
        }
    }

    return decision;
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
            await sleep(1500 + Math.random() * 500); // AI 出牌思考 1.5~2秒
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
        playSound('bomb');
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

    await sleep(1500);

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
                landlordId: G.landlord,
                pastRounds: G.pastRounds
            });

            // Enforce mandatory play: if LLM says PASS but it's its turn to lead, ignore LLM
            if (decision === 'PASS') {
                if (mustPlay) {
                    console.warn(`AI ${playerId} (Master) tried to PASS on mustPlay. Falling back to rule-based.`);
                    chosen = null; // Fall through to rule-based
                } else {
                    chosen = null;
                }
                // Validate if cards are in hand and get actual card objects with .value
                const validCards = decision.map(c => hand.find(h => h.rank === c.rank && h.suit === c.suit)).filter(Boolean);
                if (validCards.length === decision.length) {
                    // CRITICAL FIX: Validate that the LLM move actually follows game rules
                    const pattern = detectPattern(validCards);
                    if (pattern && (mustPlay || canBeat(pattern, G.lastRealPlay.pattern))) {
                        chosen = validCards;
                    } else {
                        console.warn(`AI ${playerId} (Master) returned illegal move:`, decision, "Falling back to rule-based.");
                        chosen = null; // Trigger fallback
                    }
                }
            }
        } catch (e) {
            console.error('LLM Playing Error, falling back to rule-based:', e);
        }
    }

    // Rule-based fallback (if LLM failed, returned invalid cards, or incorrectly PASSed on mustPlay)
    if (G.aiMode === 'normal' || !chosen) {
        if (mustPlay) {
            chosen = aiFindBestPlay(hand);
        } else {
            chosen = findBestPlay(hand, G.lastRealPlay ? G.lastRealPlay.pattern : null);
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
        
        // Generate dialogue for normal mode when passing (100% chance)
        if (G.aiMode === 'normal' && Math.random() < 1.0) {
            const dialogue = generateLocalPlayingDialogue("pass", G.lastRealPlay, G.landlord === playerId);
            if (dialogue) {
                showAIDialogue(playerId, dialogue);
            }
        }
        
        await sleep(1500);
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
            await sleep(1500);
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
            playSound('bomb');
        } else {
            playSound('deal');
        }

        showLastPlay(playerId, chosen, false);
        renderAIHand(playerId, hand.length);

        // Generate dialogue for normal mode when playing cards (100% chance)
        if (G.aiMode === 'normal' && Math.random() < 1.0) {
            const dialogue = generateLocalPlayingDialogue("play", G.lastRealPlay, G.landlord === playerId, chosen);
            if (dialogue) {
                showAIDialogue(playerId, dialogue);
            }
        }

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

    // Re-enable AI mode selection
    const modeSelect = $('aiModeSelect');
    if (modeSelect) modeSelect.disabled = false;
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

    // 加载语音映射
    loadVoiceMapping();

    // Attempt Auto-play BGM
    doudizhuBgm.play().then(() => {
        isBgmPlaying = true;
        const span = document.querySelector('#doudizhuBgmBtn span');
        if (span) { span.textContent = 'ON'; span.style.color = '#4ade80'; }
    }).catch(() => { });
});
