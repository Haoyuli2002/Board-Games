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
    pastRounds: [],         // history of plays for LLM context: [{player, cards, pattern}]
    bgmVolume: 0.5,
    voiceVolume: 0.8
};

const PLAYER = 0, AI1 = 1, AI2 = 2;
const NAMES = ['小明', '云希', '晓伊'];
const ZONE_IDS = ['zone-player', 'zone-ai1', 'zone-ai2'];

const AVATAR_MAP = {
    [AI1]: {
        farmer: 'assets/avatars/yunxi_farmer.png',
        landlord: 'assets/avatars/yunxi_landlord.png'
    },
    [AI2]: {
        farmer: 'assets/avatars/xiaoyi_farmer.png',
        landlord: 'assets/avatars/xiaoyi_landlord.png'
    },
    [PLAYER]: {
        farmer: 'assets/farmer_avatar.png',
        landlord: 'assets/landlord_avatar.png'
    }
};


// 移除本地语音音源映射，全面使用 Edge TTS
const VOICE_MAPPINGS = null;

// 已移除本地语音音源映射，全面使用 Edge TTS

/**
 * Update player and AI avatars based on their current role (Farmer/Landlord)
 */
function updateAvatars() {
    [PLAYER, AI1, AI2].forEach(id => {
        const pfx = id === PLAYER ? 'player' : `ai${id}`;
        const img = document.getElementById(`avatar-${pfx}`);
        if (!img) return;

        const role = (G.landlord === id) ? 'landlord' : 'farmer';
        if (AVATAR_MAP[id] && AVATAR_MAP[id][role]) {
            img.src = AVATAR_MAP[id][role];
        }
    });
}

let audioCache = {};
let audioEnabled = false;
let audioUnlocked = false;
let aiDialogueEnabled = true; // AI语音交互，默认开启

function toggleAIDialogue() {
    aiDialogueEnabled = !aiDialogueEnabled;
    const label = document.getElementById('aiDialogueLabel');
    if (label) {
        label.textContent = aiDialogueEnabled ? 'AI交互 ON' : 'AI交互 OFF';
        label.style.color = aiDialogueEnabled ? '#4ade80' : '';
    }
    console.log('AI语音:', aiDialogueEnabled ? '开启' : '关闭');
}

// 文档级别点击解锁 —— 覆盖所有用户交互场景
function _unlockAudioOnce() {
    if (audioUnlocked) return;
    audioUnlocked = true;

    // 预创建无声片段以激活浏览器的音频上下文
    const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
    silentAudio.play().catch(() => { });

    console.log('音频系统已通过用户交互解锁');
}
document.addEventListener('mousedown', _unlockAudioOnce, { once: true });
document.addEventListener('touchstart', _unlockAudioOnce, { once: true });
document.addEventListener('keydown', _unlockAudioOnce, { once: true });

// 初始化音频系统（游戏开始时调用）
function initAudioSystem() {
    _unlockAudioOnce();   // 确保在按钮点击上下文中运行
    audioEnabled = true;
    console.log('音频系统已激活');
}

// 加载语音映射文件（内嵌映射已就绪，此函数保留作兼容用途）
async function loadVoiceMapping() {
    console.log('音频系统已就绪（Edge TTS 模式）');
}

// 播放语音（向后端请求 Edge TTS）
async function playVoice(text, playerId) {
    if (!audioEnabled || !aiDialogueEnabled) return Promise.resolve();

    try {
        const response = await fetch('http://127.0.0.1:5000/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, playerId })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.audio_base64) {
                // Await audio to finish
                await playBase64Audio(data.audio_base64);
            }
        }
    } catch (e) {
        console.warn('TTS请求失败:', e);
    }
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
    const label = document.getElementById('bgmLabel');
    if (isBgmPlaying) {
        doudizhuBgm.play().catch(() => { });
        if (label) {
            label.textContent = 'BGM ON';
            label.style.color = '#4ade80';
        }
    } else {
        doudizhuBgm.pause();
        if (label) {
            label.textContent = 'BGM OFF';
            label.style.color = '';
        }
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
// 每个AI的台词池（只含有对应语音文件的台词）
const BIDDING_LINES = {
    [AI1]: {
        0: ['不叫', '先观望一下', '手牌不太行', '我就看看', '让你们来吧', '这把我不掺和', '牌太臭了，不要', '低调点，过'],
        1: ['试试看', '叫一分', '我来试试', '一分意思一下', '小跟一把', '牌一般，弄点彩头'],
        2: ['好牌必须叫', '两分', '这手牌不错', '我感觉有戏', '两分走起'],
        3: ['三分到底', '必胜之局', '这把稳了', '地主我当定了', '给你们个惊喜，三分', '不装了，我全要'],
    },
    [AI2]: {
        0: ['你们来吧', '这手牌一般', '你们争吧', '不叫，等下把', '我就看看风景', '牌散得像沙子'],
        1: ['试试看', '我来试试', '一分吧', '看在运气的份上', '牌还行，叫个一分'],
        2: ['这手牌不错', '两分拿捏', '感觉能打，两分', '既然你们不叫，我来'],
        3: ['这把稳了', '地主是我的', '三分全满', '手握重兵，三分', '让你们见识下什么叫地主'],
    },
};

function generateLocalBiddingDialogue(bid, maxBid, hand, playerId) {
    const pool = BIDDING_LINES[playerId] || BIDDING_LINES[AI1];
    const lines = pool[bid] || [];
    if (lines.length === 0) return '';
    return lines[Math.floor(Math.random() * lines.length)];
}

const PLAYING_LINES = {
    [AI1]: {
        pass: ['不要', '不出', '跟不起', '让你过', '先等等', '等等看', '这手真大，过', '队友加油', '牌好也让你'],
        bomb: ['哈哈炸弹', '炸弹来了', '爆炸', '见识下火力的厉害', '这下整齐了'],
        rocket: ['王炸', '双王出击', '无敌了', '炸得你怀疑人生', '全场最高级'],
        straight: ['顺子走起', '连牌漂亮', '长牌压制', '一条龙送给你', '顺风顺水'],
        bigCard: ['大牌压制', '压你一手', '这手总该我大了', '顶级单张'],
        smallCard: ['出张小牌', '先出个小的', '试探一下', '投石问路', '抛砖引玉'],
        normal: ['跟上', '出牌', '来了', '接着', '再接再厉', '看招'],
    },
    [AI2]: {
        pass: ['不要', '过', '不要，让你', '这牌我也接不动', '看你的了', '稳住别浪'],
        bomb: ['炸弹', '轰你一下', '炸飞你', '这手牌够硬吧'],
        rocket: ['王炸', '双王出击', '这个最大，没道理', '直接送走'],
        straight: ['顺子送上', '龙牌出击', '长龙过境', '一顺到底'],
        bigCard: ['压你一手', '压死', '别想溜', '这手牌我看谁大'],
        smallCard: ['出张小牌', '小牌开路', '试个小的', '轻轻放一张', '从小打起'],
        normal: ['跟上', '过一张', '轮到我了', '继续出', '轮换一下'],
    },
};

function generateLocalPlayingDialogue(action, lastRealPlay, isLandlord, playedCards, playerId) {
    const pool = PLAYING_LINES[playerId] || PLAYING_LINES[AI1];
    const pick = arr => arr.length ? arr[Math.floor(Math.random() * arr.length)] : '';

    if (action === "pass") {
        return pick(pool.pass);
    }
    if (action === "play" && playedCards) {
        const pattern = detectPattern(playedCards);
        if (pattern && pattern.type === 'bomb') return pick(pool.bomb);
        if (pattern && pattern.type === 'rocket') return pick(pool.rocket);
        if (playedCards.length >= 5) return pick(pool.straight);
        if (playedCards.length === 1) {
            const val = playedCards[0].value;
            if (val >= 13) return pick(pool.bigCard);
            if (val <= 6) return pick(pool.smallCard);
            return pick(pool.normal);
        }
        return pick(pool.normal);
    }
    return '';
}

// Play base64-encoded audio (mp3) from backend TTS
function playBase64Audio(base64Data) {
    return new Promise((resolve) => {
        if (!base64Data) return resolve();
        if (!audioEnabled || !aiDialogueEnabled) {
            console.log('语音播放被禁用');
            return resolve();
        }
        try {
            const audioSrc = 'data:audio/mp3;base64,' + base64Data;
            const audio = new Audio(audioSrc);
            audio.volume = G.voiceVolume; // 使用全局音量设置

            audio.onended = resolve;
            audio.onerror = (e) => {
                console.warn('Audio playback error:', e);
                resolve();
            };

            const p = audio.play();
            if (p && typeof p.catch === 'function') {
                p.catch(err => {
                    console.warn('Base64 TTS播放失败:', err.message);
                    resolve();
                });
            }
        } catch (e) {
            console.warn('Base64 audio decode error:', e);
            resolve();
        }
    });
}

// 展示 AI 对话气泡并播放语音
async function showAIDialogue(playerId, dialogue, skipVoice = false) {
    if (!dialogue || dialogue.trim() === '') return;

    const pfx = playerId === PLAYER ? 'player' : `ai${playerId}`;
    const avatarElement = $(`avatar-${pfx}`);

    if (!avatarElement) return;

    // 延迟显示气泡，以主观同步音频开始的时机
    setTimeout(() => {
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

        // Position the bubble relative to the avatar icon
        const container = avatarElement.parentElement; // .player-avatar

        if (container) {
            bubble.style.position = 'absolute';

            if (playerId === AI2) { // Top AI (上家)
                // Move to the LEFT of avatar to stay horizontal
                bubble.style.right = '100%';
                bubble.style.top = '50%';
                bubble.style.transform = 'translateY(-50%)';
                bubble.style.marginRight = '12px';
            } else if (playerId === AI1) { // Right AI (云希)
                // Move ABOVE avatar to avoid overlap with played cards on the left
                bubble.style.bottom = '100%';
                bubble.style.right = '0';
                bubble.style.marginBottom = '12px';
            } else { // Player
                bubble.style.bottom = '100%';
                bubble.style.left = '50%';
                bubble.style.transform = 'translateX(-50%)';
                bubble.style.marginBottom = '12px';
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
    }, 300);

    // 播放语音并等待读完（Edge TTS 实时生成）
    if (!skipVoice) {
        await playVoice(dialogue, playerId);
    }
}

/**
 * 根据对话内容智能分类样式
 */
function classifyDialogue(dialogue) {
    const excited = ['炸弹', '王炸', '双王出击', '稳了'];
    const confident = ['好牌必须叫', '压你一手', '压死', '两分拿下', '顺子走起'];
    const casual = ['试试看', '叫一分', '我来试试', '出张小牌', '试探一下', '小牌开路', '有点意思', '该我了'];

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

/**
 * Completely reset the game and UI to initial state
 */
function resetGameToInitial() {
    // Reset global state G
    G.phase = 'idle';
    G.hands = [[], [], []];
    G.kitty = [];
    G.landlord = -1;
    G.currentTurn = -1;
    G.maxBid = 0;
    G.baseScore = 0;
    G.multiplier = 1;
    G.passCount = 0;
    G.lastRealPlay = null;
    G.pastRounds = [];
    G.totalScore = 0;
    G.isPaused = false;

    // Clear UI components
    clearAllLastPlays();
    $('hand-player').innerHTML = '';
    $('hand-ai1').innerHTML = '';
    $('hand-ai1').className = 'ai-hand vertical'; // Ensure vertical class is restored
    $('hand-ai2').innerHTML = '';
    $('resultOverlay').style.display = 'none';

    // Hide role badges
    [0, 1, 2].forEach(pid => {
        const pfx = pid === PLAYER ? 'player' : `ai${pid}`;
        const badge = $(`role-${pfx}`);
        if (badge) {
            badge.textContent = '';
            badge.className = 'role-badge';
        }
        const bidBadge = $(`bid-badge-${pfx}`);
        if (bidBadge) bidBadge.textContent = '';
    });

    // Reset avatars to Farmer
    updateAvatars();

    // Reset indicators and areas
    showStartArea();
    renderKitty(false);
    updateScoreUI();
    setTurnIndicator('点击「开始游戏」开始对局');
    $('myScore').textContent = '0';

    // Re-enable mode selection
    const modeSelect = $('aiModeSelect');
    if (modeSelect) modeSelect.disabled = false;

    console.log("Game reset to initial state.");
}

/**
 * Exit the game and return to initial state
 */
function exitGame() {
    resetGameToInitial();
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
    const rules = $('rulesPanel');
    if (rules) {
        rules.classList.toggle('open');
        // If opening rules, ensure result overlay is hidden to avoid overlapping
        if (rules.classList.contains('open')) closeResult();
    }
}

/**
 * Close the result overlay
 */
function closeResult() {
    const overlay = $('resultOverlay');
    if (overlay) overlay.style.display = 'none';
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
    const countEl = $(`ai${playerId}CardCount`);
    if (countEl) countEl.textContent = count;
}

/**
 * Core LLM decision function.
 * Connects to the local Python FastAPI server which acts as the anti-corruption layer for the LLM API.
 */
async function getLLMDecision(context) {
    const pfx = context.playerId === AI1 ? 'AI1' : 'AI2';
    setTurnIndicator(`${NAMES[context.playerId]} 出牌中...`, false);

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

        // Display AI dialogue and play TTS audio if available
        // NOTE: Dialogue manifestation is now deferred to doAIPlay to ensure decision is valid first

        // Return all components for confirmation in doAIPlay
        return {
            decision,
            dialogue: data.dialogue || "",
            audio_base64: data.audio_base64 || ""
        };

    } catch (e) {
        console.warn("Failed to connect to AI server, falling back to rule-based:", e);
        // Rule-based Fallback directly here since it failed to get a valid response
        if (context.phase === 'bidding') {
            const strength = evaluateHand(context.hand);
            let decision = 0;
            if (strength > 70) decision = 3;
            else if (strength > 40 && context.maxBid < 2) decision = 2;
            return { decision, dialogue: "" };
        }

        if (context.phase === 'playing') {
            let decision;
            if (context.mustPlay) decision = aiFindBestPlay(context.hand);
            else decision = findBestPlay(context.hand, context.lastRealPlay ? context.lastRealPlay.pattern : null);
            return { decision, dialogue: "" };
        }
    }
    return { decision: null, dialogue: "" };
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
        bgmVolume: G.bgmVolume !== undefined ? G.bgmVolume : 0.5,
        voiceVolume: G.voiceVolume !== undefined ? G.voiceVolume : 0.8,
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
    updateAvatars();

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

    // If no one bid, reshuffle and redeal
    if (G.landlord === -1) {
        setTurnIndicator("无人叫分，重新发牌...", true);
        await sleep(2000);
        return startGame();
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
            const { decision: result, dialogue: llmDialogue, audio_base64 } = await getLLMDecision({
                phase: 'bidding',
                playerId: playerId,
                hand: G.hands[playerId],
                maxBid: G.maxBid,
                landlordId: G.landlord
            });
            if (typeof result === 'number' && result >= 0 && result <= 3) {
                decision = result;
                // Manifest dialogue and audio
                if (llmDialogue) {
                    showAIDialogue(playerId, llmDialogue, true);
                    if (audio_base64) {
                        playBase64Audio(audio_base64);
                    }
                }
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

    // 叫地主阶段：100%触发对话（需开启语音开关）
    if (aiDialogueEnabled) {
        dialogue = generateLocalBiddingDialogue(decision, G.maxBid, hand, playerId);
        if (dialogue) {
            await showAIDialogue(playerId, dialogue);
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
    updateAvatars();
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
        pattern: detectPattern(selected),
        dialogue: "" // Player currently doesn't have dialogue, but we keep field consistent
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
        pattern: { type: 'pass' },
        dialogue: ""
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
    let llmDialogueShown = false;
    let llmDecisionValid = false;
    let finalDialogue = "";

    // If master mode, try LLM first
    if (G.aiMode === 'master') {
        try {
            const llmResult = await getLLMDecision({
                phase: 'playing',
                playerId: playerId,
                hand: hand,
                mustPlay: mustPlay,
                lastRealPlay: G.lastRealPlay,
                landlordId: G.landlord,
                pastRounds: G.pastRounds
            });

            const { decision, dialogue, audio_base64 } = llmResult;
            finalDialogue = dialogue;

            if (decision === 'PASS') {
                if (mustPlay) {
                    console.warn(`AI ${playerId} (Master) tried to PASS on mustPlay. Falling back to rule-based.`);
                    llmDialogueShown = false;
                    finalDialogue = "";
                } else {
                    chosen = null;
                    llmDecisionValid = true;
                    // Success: manifest dialogue
                    if (finalDialogue) {
                        llmDialogueShown = true;
                        showAIDialogue(playerId, finalDialogue, true);
                        if (audio_base64) playBase64Audio(audio_base64);
                    }
                }
            } else if (Array.isArray(decision)) {
                const validCards = decision.map(c => hand.find(h => h.rank === c.rank && h.suit === c.suit)).filter(Boolean);
                if (validCards.length === decision.length) {
                    const pattern = detectPattern(validCards);
                    if (pattern && (mustPlay || canBeat(pattern, G.lastRealPlay.pattern))) {
                        chosen = validCards;
                        llmDecisionValid = true;
                        // Success: manifest dialogue
                        if (finalDialogue) {
                            llmDialogueShown = true;
                            showAIDialogue(playerId, finalDialogue, true);
                            if (audio_base64) playBase64Audio(audio_base64);
                        }
                    } else {
                        console.warn(`AI ${playerId} (Master) returned illegal move (cannot beat or invalid pattern). Falling back.`);
                        llmDialogueShown = false;
                        finalDialogue = "";
                    }
                } else {
                    console.warn(`AI ${playerId} (Master) returned cards not in hand. Falling back.`);
                    llmDialogueShown = false;
                    finalDialogue = "";
                }
            }
        } catch (e) {
            console.error('LLM Playing Error, falling back to rule-based:', e);
            llmDialogueShown = false;
            finalDialogue = "";
        }
    }

    // Rule-based fallback: only if normal mode OR master mode LLM failed
    if (G.aiMode === 'normal' || !llmDecisionValid) {
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
        if (aiDialogueEnabled && !llmDialogueShown) {
            const dialogue = generateLocalPlayingDialogue("pass", G.lastRealPlay, G.landlord === playerId, null, playerId);
            if (dialogue) {
                finalDialogue = dialogue;
                await showAIDialogue(playerId, dialogue);
            }
        }

        // Pass
        G.passCount++;
        showLastPlay(playerId, [], true);

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
            pattern: { type: 'pass' },
            dialogue: finalDialogue
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
        if (aiDialogueEnabled && !llmDialogueShown) {
            const dialogue = generateLocalPlayingDialogue("play", G.lastRealPlay, G.landlord === playerId, chosen, playerId);
            if (dialogue) {
                finalDialogue = dialogue;
                await showAIDialogue(playerId, dialogue);
            }
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

        // Record for LLM history
        G.pastRounds.push({
            player: playerId,
            playerName: NAMES[playerId],
            cards: [...chosen],
            pattern: pattern,
            dialogue: finalDialogue
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
    const title = isWin ? '恭喜！小明赢了' : '抱歉，小明输了';
    const winnerName = (winner === PLAYER) ? '小明' : NAMES[winner];
    const roleStr = NAMES[G.landlord] + '是地主';
    const winnerStr = winnerName + '赢得了本局';
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

    // 同步玩家名称显示
    $('label-player').textContent = NAMES[PLAYER];
    $('label-ai1').textContent = NAMES[AI1];
    $('label-ai2').textContent = NAMES[AI2];

    updateAvatars();

    // 加载语音映射
    loadVoiceMapping();

    // 初始化音量
    doudizhuBgm.volume = G.bgmVolume;

    // 绑定音量调节事件
    const bgmSlider = $('bgmVolumeSlider');
    if (bgmSlider) {
        bgmSlider.value = G.bgmVolume;
        bgmSlider.oninput = (e) => {
            G.bgmVolume = parseFloat(e.target.value);
            doudizhuBgm.volume = G.bgmVolume;
        };
    }
    const voiceSlider = $('voiceVolumeSlider');
    if (voiceSlider) {
        voiceSlider.value = G.voiceVolume;
        voiceSlider.oninput = (e) => {
            G.voiceVolume = parseFloat(e.target.value);
        };
    }
    // Attempt Auto-play BGM
    doudizhuBgm.play().then(() => {
        isBgmPlaying = true;
        const label = document.getElementById('bgmLabel');
        if (label) {
            label.textContent = 'BGM ON';
            label.style.color = '#4ade80';
        }
    }).catch(() => { });
});

// 切换音量控制面板显示 (抽屉式)
function toggleVolumePanel() {
    const panel = document.getElementById('volumeControls');
    if (panel) {
        panel.classList.toggle('visible');
    }
}
