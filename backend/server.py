import os
import io
import json
import base64
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Any
from dotenv import load_dotenv
from openai import AsyncOpenAI
import random
import edge_tts

# Load environment variables
load_dotenv()
API_KEY = os.getenv("DeepSeek_API_KEY")

# Initialize DeepSeek client (using OpenAI compatible SDK)
client = AsyncOpenAI(
    api_key=API_KEY,
    base_url="https://api.deepseek.com/v1"
)

app = FastAPI()
print("\n✅ [AI Server] 启动成功，当前版本：独立实体人物强化版 (含 last_play_text 修复)", flush=True)

# Allow CORS for local frontend testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========================
#  DIALOGUE GENERATION (per-player voice mapping aware)
# ========================

# AI1 (playerId=1) - 云希: 豪迈侠客
BIDDING_LINES_AI1 = {
    0: ["不叫", "先观望一下", "牌太臭了，不要", "低调点，过"],
    1: ["试试看", "叫一分", "我来试试"],
    2: ["好牌必须叫", "两分", "这手牌不错"],
    3: ["三分到底", "地主我当定了", "不装了，我全要"],
}

PLAYING_LINES_AI1 = {
    "pass":      ["不要", "不出", "跟不起", "让你过", "让队友来压吧", "先稳一手", "这种小牌不值得我出手", "且看你们表演"],
    "bomb":      ["哈哈炸弹", "炸弹来了", "见识下火力的厉害", "雷霆一出，谁与争锋", "开火！"],
    "rocket":    ["王炸", "无敌了", "炸得你怀疑人生", "双王降临，寸草不生", "结束了"],
    "straight":  ["顺子走起", "一条龙送给你", "顺风顺水", "步步为营"],
    "bigCard":   ["大牌压制", "压你一手", "顶级单张", "看谁敢拦我", "这就是实力"],
    "smallCard": ["出张小牌", "先出个小的", "抛砖引玉", "试试深浅"],
    "normal":    ["跟上", "出牌", "来了", "看招", "轮到我了"],
}

# AI2 (playerId=2) - 晓伊: 聪慧俏皮
BIDDING_LINES_AI2 = {
    0: ["你们来吧", "牌散得像沙子", "我就看看风景"],
    1: ["试试看", "一分吧", "看在运气的份上"],
    2: ["这手牌不错", "感觉能打，两分"],
    3: ["这把稳了", "地主是我的", "三分全满"],
}

PLAYING_LINES_AI2 = {
    "pass":      ["不要", "过", "稳住别浪", "让队友来压吧", "等个机会", "这张就不跟了", "且慢"],
    "bomb":      ["炸弹", "轰你一下", "这手牌够硬吧", "让你感受下艺术的爆炸", "砰！"],
    "rocket":    ["王炸", "直接送走", "这个最高级", "胜负已定"],
    "straight":  ["顺子送上", "长龙过境", "一顺到底", "看我的长队"],
    "bigCard":   ["压你一手", "压死", "别想溜", "大牌来喽", "拦得住吗"],
    "smallCard": ["出张小牌", "轻轻放一张", "从小打起", "引蛇出洞"],
    "normal":    ["跟上", "过一张", "轮到我了", "接招吧"],
}

# AI Identity Settings
AI_NAMES = {
    1: "云希",
    2: "晓伊"
}

def get_system_prompt(player_id, is_landlord, phase="playing"):
    name = AI_NAMES.get(player_id, f"AI {player_id}")
    other_ai_id = 2 if player_id == 1 else 1
    other_ai_name = AI_NAMES.get(other_ai_id)
    
    if player_id == 1: # 云希
        base = "你叫云希，是一位豪爽阔达、自信直率的古风侠客，说话带有豪迈侠气。"
        if phase == "bidding":
            personality = "现在是叫号（抢地主）环节。一旦你叫分胜出，你将成为【地主】，独自一人对抗两个农民（小明和晓伊）。如果你不想承担风险，可以不叫分。"
        elif is_landlord:
            personality = "现在你是地主，独自对抗两个农民。你变得极其狂妄、自大，视对手如无物，台词应充满嘲讽和压迫感。"
        else:
            personality = f"现在你是农民。你正与队友（农民 {other_ai_name}）并肩作战对抗地主。台词应展现侠肝义胆和团队协作。"
    else: # 晓伊
        base = "你叫晓伊，是一位温婉聪慧、睿智从容的古风少女，性格里带着一丝灵动和俏皮。"
        if phase == "bidding":
            personality = "现在是叫号（抢地主）环节。一旦你叫分胜出，你将成为【地主】，独自一人对抗两个农民（小明和云希）。请根据手牌智慧决策。"
        elif is_landlord:
            personality = "现在你是地主。你变得腹黑、高傲、优雅地嘲讽，视对手为股掌间的玩物，台词带着掌控全局的冷淡感。"
        else:
            personality = f"现在你是农民。你正与队友（农民 {other_ai_name}）共商破敌之策。台词应从容优雅，展现智谋。"

    return f"""{base}
{personality}
你的终极目标是赢得这场斗地主比赛。
你会收到之前的历史记录，请根据这些记录维持对话的连贯性，**严禁连续重复之前说过的原话**。
在对话时，请清楚意识到你自己的身份以及谁是你的队友，谁是你的对手。

**重要禁令（台词规则）**：
- **字数上限：必须特别极其简短，严格限制在 20 个字以内（包括标点）！**
- **禁止动作描述**：绝对严禁使用括号 `(...)` 或 `（...）` 描述动作或神情。
- **对话导向**：不要自言自语，你的台词应该是说给场上其他两个人听的。
- **严禁泄露具体牌面**：绝不能提及具体的点数或花色。
- **语义一致性**：台词提到的牌型必须与实际出的牌一致。
"""


def generate_bidding_dialogue(bid, max_bid, hand, player_id=1):
    """Generate dialogue for bidding phase, matching frontend voice mapping per player"""
    pool = BIDDING_LINES_AI2 if player_id == 2 else BIDDING_LINES_AI1
    lines = pool.get(bid, [])
    return random.choice(lines) if lines else ""


def generate_playing_dialogue(action, last_real_play, is_landlord, played_cards=None, player_id=1):
    """Generate dialogue for playing phase, matching frontend voice mapping per player"""
    pool = PLAYING_LINES_AI2 if player_id == 2 else PLAYING_LINES_AI1

    def pick(key):
        arr = pool.get(key, [])
        return random.choice(arr) if arr else ""

    if action == "pass":
        return pick("pass")

    if action == "play" and played_cards:
        card_count = len(played_cards)

        # Bomb (4 same cards)
        if card_count == 4:
            return pick("bomb")
        # Rocket (双王)
        if card_count == 2 and any(c.get('rank') in ['小王', '大王'] for c in played_cards):
            return pick("rocket")
        # Long sequence (5+)
        if card_count >= 5:
            return pick("straight")
        # Single card
        if card_count == 1:
            val = played_cards[0].get('value', 0)
            if val >= 13:
                return pick("bigCard")
            if val <= 6:
                return pick("smallCard")
            return pick("normal")
        return pick("normal")

    return ""

# ========================
#  EDGE-TTS: Real-time Text-to-Speech
# ========================

# Voice settings per player
TTS_VOICES = {
    1: "zh-CN-YunxiNeural",      # AI1: 男声（云希）
    2: "zh-CN-XiaoyiNeural",     # AI2: 女声（晓伊）
}

async def text_to_speech_base64(text: str, player_id: int = 1) -> str:
    """
    Convert text to speech using Edge TTS, return base64-encoded mp3.
    """
    if not text or not text.strip():
        return ""
    
    try:
        voice = TTS_VOICES.get(player_id, "zh-CN-YunxiNeural")
        # 优化：为不同性格定制语速和语调
        # 云希 (Male): 稍微低沉一点，表现侠客风范
        # 晓伊 (Female): 稍微灵动一点
        rate = "+10%" if player_id == 2 else "+5%"
        pitch = "+0Hz" if player_id == 1 else "+2Hz" 
        
        communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
        
        # Collect audio bytes
        audio_bytes = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_bytes.write(chunk["data"])
        
        audio_bytes.seek(0)
        audio_data = audio_bytes.read()
        
        if len(audio_data) == 0:
            print(f"[TTS] Warning: Empty audio for text: {text}", flush=True)
            return ""
        
        encoded = base64.b64encode(audio_data).decode("utf-8")
        print(f"[TTS] Generated audio for '{text}' ({len(audio_data)} bytes, player {player_id})", flush=True)
        return encoded
    
    except Exception as e:
        print(f"[TTS] Error generating speech for '{text}': {e}", flush=True)
        return ""


@app.get("/")
async def root():
    return {
        "message": "AI后端服务器正在运行",
        "status": "active",
        "endpoints": {
            "ai_decision": "/api/ai-play",
            "health": "/health"
        }
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "api_key_configured": bool(API_KEY)}


class AIRequest(BaseModel):
    phase: str
    playerId: int
    hand: List[dict]
    maxBid: Optional[int] = 0
    landlordId: Optional[int] = -1
    mustPlay: Optional[bool] = False
    lastRealPlay: Optional[dict] = None
    pastRounds: Optional[List[dict]] = []



@app.post("/api/ai-play")
async def get_ai_decision(request: AIRequest):
    print(f"\n[Backend] 收到 AI 请求: Player {request.playerId}, Phase: {request.phase}, Mode: Master", flush=True)
    try:
        # Phase 1: Bidding
        if request.phase == "bidding":
            # 计算允许的叫分范围
            min_valid_bid = (request.maxBid or 0) + 1
            max_valid_bid = 3
            
            if min_valid_bid > max_valid_bid:
                # 如果已经叫到3分，只能不叫
                valid_bids = [0]
            else:
                valid_bids = [0] + list(range(min_valid_bid, max_valid_bid + 1))
            
            system_prompt = get_system_prompt(request.playerId, False, phase="bidding")
            
            prompt = f"""当前阶段：叫地主
你的手牌：{json.dumps(request.hand, ensure_ascii=False)}
当前最高叫分：{request.maxBid if request.maxBid else 0}分

叫地主规则：
- 当前最高叫分是{request.maxBid if request.maxBid else 0}分
- 你只能叫以下分数之一：{valid_bids}
- 如果叫分，必须比当前最高分更高
评估手牌实力：
- 强牌（大王、小王、两个以上的2、长顺子、炸弹）：你应该果断抢庄，直接叫2-3分。
- 中等牌（有一个大/小王，或者有一些2，或者有炸弹但散牌多）：可以叫1-2分，敢于承担地主风险。
- 如果手牌确实非常烂（全是小牌且不连贯）：叫0分。
- **目标**：要求台词多样且符合性格，严禁直接复制粘贴之前的说话风格！
- **重要限制**：台词必须在 **20 个字以内**，且是说给场上的“小明”或另一个 AI 听的。

请根据你的手牌实力决定叫分，必须返回以下JSON格式：
{{"bid": {valid_bids}中的一个数字, "dialogue": "你作为牌手说的一句简短台词（20字以内，对外交流口吻，不要自言自语）"}}
"""
            
            print(f"DeepSeek 正在调用 (Bidding, Player {request.playerId})...", flush=True)
            response = await client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=1.3,
                frequency_penalty=1.0,
                presence_penalty=0.6
            )
            content = response.choices[0].message.content
            resp_json = json.loads(content)
            bid = resp_json.get("bid", 0)
            print(f"DeepSeek 调用成功 (Bidding): Player {request.playerId} 叫分: {bid}", flush=True)
            
            if bid not in valid_bids:
                bid = 0
            
            dialogue = resp_json.get("dialogue", "叫分。")[:20]
            if not dialogue or dialogue == "叫分。":
                dialogue = generate_bidding_dialogue(bid, request.maxBid, request.hand, player_id=request.playerId)
            
            dialogue = dialogue[:20]
            audio_base64 = await text_to_speech_base64(dialogue, request.playerId)
            return {"decision": bid, "dialogue": dialogue, "audio_base64": audio_base64}

        # Phase 2: Playing
        elif request.phase == "playing":
            # 优化提示词：将上家出牌格式化为人类易读的文字，提升大模型策略理解
            last_play_cards = request.lastRealPlay.get("cards", []) if request.lastRealPlay else []
            if last_play_cards:
                cards_readable = ",".join([c.get('rank', '') for c in last_play_cards])
                last_play_desc = f"玩家 {request.lastRealPlay.get('player')} 出了 [{cards_readable}]"
            else:
                last_play_desc = "无（你是首出）"

            is_landlord = (request.playerId == request.landlordId)
            role_text = "地主" if is_landlord else "农民"
            
            last_player_is_teammate = False
            if not is_landlord and request.lastRealPlay:
                lp_id = request.lastRealPlay.get("player")
                if lp_id is not None and lp_id != request.landlordId and lp_id != request.playerId:
                    last_player_is_teammate = True
            
            teammate_caution = ""
            if last_player_is_teammate:
                teammate_caution = "\n特别注意：上家出的牌是你的队友（另一个农民）出的。如果队友的牌很大且能确保继续掌控出牌权，你可以选择Pass；但如果你手里有能更快跑掉的牌型，或者你想通过接管出牌权来改变节奏（比如队友在出单张而你有对子），请果断压住队友，接管比赛。不要总是让牌！"
            
            landlord_role_desc = "你是地主，独自对抗两个农民。" if is_landlord else f"你是农民，与另一个农民配合对抗玩家 {request.landlordId}（地主）。"
            
            must_play_warning = ""
            if request.mustPlay:
                must_play_warning = "\n⚠️ 绝对指令：当前你获得了出牌权。你必须从手牌中选择牌打出，严禁选择“不要”（pass）。"

            system_prompt = get_system_prompt(request.playerId, is_landlord)
            
            # 格式化历史记录，让 AI 更有“代入感”
            formatted_history = []
            for r in request.pastRounds:
                p_id = r.get("player")
                p_cards = r.get("cards", [])
                p_dialogue = r.get("dialogue", "")
                
                if p_id == request.playerId:
                    speaker = "你(你自己)"
                elif p_id == 0:
                    speaker = "小明(你的对手)" if is_landlord else "小明(地主)"
                else:
                    speaker = AI_NAMES.get(p_id, f"AI {p_id}")
                    if not is_landlord:
                        speaker += "(你的队友)" if p_id != request.landlordId else "(地主)"
                
                cards_str = ",".join([c.get('rank', '') for c in p_cards]) if isinstance(p_cards, list) else str(p_cards)
                formatted_history.append(f"{speaker}: 出牌 [{cards_str}], 台词: \"{p_dialogue}\"")

            prompt = f"""当前阶段：出牌
你的手牌：{json.dumps(request.hand, ensure_ascii=False)}
是否必须出牌：{"是" if request.mustPlay else "否"}{must_play_warning}
需要压过的牌：{last_play_desc}{teammate_caution}
历史记录（从最近到过去）：
{chr(10).join(formatted_history[:10])}

出牌规则与策略：
1. **首要目标**：赢得比赛！不管是地主还是农民，你的任务是把牌出完。
2. **主动性**：作为大师级别AI，你应该尽可能掌控出牌权。严禁在有能力接管比赛时盲目选择“不要（Pass）”。
3. **农民配合**：
   - 队友（农民）出牌时，如果你手中的牌更顺或者更有把握连出，请果断接过来。
   - 如果地主（小明）Pass了，你作为农民必须尽力压住队友的小牌，由你来重新发牌，绝不能让出牌权白白回到地主手中。
4. **管牌逻辑**：要有预见性。如果地主报牌（剩余牌少），必须不惜一切代价（炸弹等）管住地主。
5. **台词要求**：**20 字以内**，必须是对外交流（对小明或队友说的话），不要重复之前说过的台词，严禁描述心理活动。

请做出决策，必须返回以下JSON格式：
- 不要：{{"action": "pass", "dialogue": "台词"}}
- 出牌：{{"action": "play", "cards": [精确的对象数组], "dialogue": "台词"}}
"""

            print(f"DeepSeek 正在调用 (Playing, Player {request.playerId}, mustPlay={request.mustPlay})...", flush=True)
            response = await client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=1.3,
                frequency_penalty=1.0,
                presence_penalty=0.6
            )
            content = response.choices[0].message.content
            resp_json = json.loads(content)
            
            action = resp_json.get("action", "").lower()
            dialogue = resp_json.get("dialogue", "出牌。")[:20]

            if action == "pass":
                if request.mustPlay:
                    print(f"Warning: AI {request.playerId} tried to PASS on mustPlay. TRIGGER FALLBACK.", flush=True)
                    return {"decision": "FALLBACK"}
                audio_base64 = await text_to_speech_base64(dialogue, request.playerId)
                return {"decision": "PASS", "dialogue": dialogue, "audio_base64": audio_base64}
            elif action == "play" and "cards" in resp_json:
                audio_base64 = await text_to_speech_base64(dialogue, request.playerId)
                return {"decision": resp_json["cards"], "dialogue": dialogue, "audio_base64": audio_base64}
            else:
                return {"decision": "FALLBACK"}

    except Exception as e:
        print("Error calling DeepSeek API:", e)
        return {"error": str(e), "decision": "FALLBACK", "dialogue": ""}

class TTSRequest(BaseModel):
    text: str
    playerId: int

@app.post("/api/tts")
async def get_tts(request: TTSRequest):
    audio_base64 = await text_to_speech_base64(request.text, request.playerId)
    return {"audio_base64": audio_base64}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5000)
