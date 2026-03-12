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
    "pass":      ["不要", "不出", "跟不起", "让你过"],
    "bomb":      ["哈哈炸弹", "炸弹来了", "见识下火力的厉害"],
    "rocket":    ["王炸", "无敌了", "炸得你怀疑人生"],
    "straight":  ["顺子走起", "一条龙送给你", "顺风顺水"],
    "bigCard":   ["大牌压制", "压你一手", "顶级单张"],
    "smallCard": ["出张小牌", "先出个小的", "抛砖引玉"],
    "normal":    ["跟上", "出牌", "来了", "看招"],
}

# AI2 (playerId=2) - 晓伊: 聪慧俏皮
BIDDING_LINES_AI2 = {
    0: ["你们来吧", "牌散得像沙子", "我就看看风景"],
    1: ["试试看", "一分吧", "看在运气的份上"],
    2: ["这手牌不错", "感觉能打，两分"],
    3: ["这把稳了", "地主是我的", "三分全满"],
}

PLAYING_LINES_AI2 = {
    "pass":      ["不要", "过", "稳住别浪"],
    "bomb":      ["炸弹", "轰你一下", "这手牌够硬吧"],
    "rocket":    ["王炸", "直接送走", "这个最高级"],
    "straight":  ["顺子送上", "长龙过境", "一顺到底"],
    "bigCard":   ["压你一手", "压死", "别想溜"],
    "smallCard": ["出张小牌", "轻轻放一张", "从小打起"],
    "normal":    ["跟上", "过一张", "轮到我了"],
}

# AI_CHARACTERS: Define personality based on (playerId, is_landlord)
def get_character_prompt(player_id, is_landlord):
    if player_id == 1: # 云希
        if is_landlord:
            return "你叫云希，现在你是地主。你变得极其狂妄、自大，认为自己天下无敌。你的台词应该充满嘲讽、傲慢，视农民如无物，带有强烈的压迫感。"
        else:
            return "你叫云希，现在你是农民。你是一位英俊豪爽、自信直率的古风侠客。你的台词应该豪迈、果断，带点侠气，并表达出与队友（另一个农民）并肩作战的决心。"
    elif player_id == 2: # 晓伊
        if is_landlord:
            return "你叫晓伊，现在你是地主。你变得腹黑、高傲、优雅地嘲讽。你视对手为股掌间的玩物，台词应该带着一种掌控全局的冷淡感，以及对他人的轻蔑。"
        else:
            return "你叫晓伊，现在你是农民。你是一位温婉聪慧、睿智从容的古风少女，性格里带着一丝灵动和俏皮。台词应该优雅且充满智谋，偶尔开个小玩笑，与队友共商破敌之策。"
    return "你是一个专业的斗地主玩家"


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
        communicate = edge_tts.Communicate(text, voice, rate="+10%")
        
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
            
            character_desc = get_character_prompt(request.playerId, False)
            
            prompt = f"""{character_desc}
你正在参加一场古风背景的斗地主比赛。

当前阶段：叫地主
你的手牌：{json.dumps(request.hand, ensure_ascii=False)}
当前最高叫分：{request.maxBid if request.maxBid else 0}分

叫地主规则：
- 当前最高叫分是{request.maxBid if request.maxBid else 0}分
- 你只能叫以下分数之一：{valid_bids}
- 如果叫分，必须比当前最高分更高
- 评估手牌实力：强牌（多个2、大小王、炸弹、长顺子）可以考虑叫地主
- 如果手牌一般或较弱，建议叫0分（不叫）

手牌评估标准：
- 有大小王或多个2：手牌较强
- 有炸弹（四张相同）：手牌较强  
- 有长顺子或多个连对：手牌不错
- 牌型分散、缺少大牌：手牌较弱

请根据你的手牌实力决定叫分，必须返回以下JSON格式：
{{"bid": {valid_bids}中的一个数字, "dialogue": "你作为牌手说的一句简短台词（10个字以内，用中文，表达你对手牌的感受或叫分态度）"}}
"""
            
            print(f"DeepSeek 正在调用 (Bidding)...", flush=True)
            response = await client.chat.completions.create(
                model="deepseek-chat",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            content = response.choices[0].message.content
            resp_json = json.loads(content)
            bid = resp_json.get("bid", 0)
            print(f"DeepSeek 调用成功 (Bidding): Player {request.playerId} 叫分: {bid}", flush=True)
            
            if bid not in valid_bids:
                bid = 0
            
            dialogue = resp_json.get("dialogue", "")
            if not dialogue:
                dialogue = generate_bidding_dialogue(bid, request.maxBid, request.hand, player_id=request.playerId)
            
            audio_base64 = await text_to_speech_base64(dialogue, request.playerId)
            return {"decision": bid, "dialogue": dialogue, "audio_base64": audio_base64}

        # Phase 2: Playing
        elif request.phase == "playing":
            is_landlord = (request.playerId == request.landlordId)
            role_text = "地主" if is_landlord else "农民"
            
            last_player_is_teammate = False
            if not is_landlord and request.lastRealPlay:
                lp_id = request.lastRealPlay.get("player")
                if lp_id is not None and lp_id != request.landlordId and lp_id != request.playerId:
                    last_player_is_teammate = True
            
            teammate_caution = ""
            if last_player_is_teammate:
                teammate_caution = "\n特别注意：上家出的牌是你的队友（另一个农民）出的。为了配合队友，除非你认为出的牌能显著增加赢面，否则通常建议选择“不要”（pass）。"
            
            landlord_role_desc = "你是地主，独自对抗两个农民。" if is_landlord else f"你是农民，与另一个农民配合对抗玩家 {request.landlordId}（地主）。"
            
            must_play_warning = ""
            if request.mustPlay:
                must_play_warning = "\n⚠️ 绝对指令：当前你获得了出牌权。你必须从手牌中选择牌打出，严禁选择“不要”（pass）。"

            last_play_text = json.dumps(request.lastRealPlay, ensure_ascii=False) if request.lastRealPlay else "无（你是首出）"
            character_desc = get_character_prompt(request.playerId, is_landlord)

            prompt = f"""{character_desc}
你正在参加一场古风背景的斗地主比赛。
你的角色：{role_text}
{landlord_role_desc}

当前阶段：出牌
你的手牌：{json.dumps(request.hand, ensure_ascii=False)}
是否必须出牌：{"是" if request.mustPlay else "否"}{must_play_warning}
需要压过的牌型：{last_play_text}{teammate_caution}
历史出牌及台词记录：{json.dumps(request.pastRounds, ensure_ascii=False)}

出牌规则：
- 当“是否必须出牌”为“是”时：你获得了出牌权，必须从手牌中出一个合法牌型。格式：{{"action": "play", "cards": [...]}}。
- 当“是否必须出牌”为“否”时：可以压牌，或者选择 {{"action": "pass"}}。

请分析局势并做出最佳决策，必须返回以下JSON格式之一：
- 不要：{{"action": "pass", "dialogue": "一句简短台词"}}
- 出牌：{{"action": "play", "cards": [选择的确切卡牌对象数组], "dialogue": "一句简短台词"}}
"""

            print(f"DeepSeek 正在调用 (Playing, mustPlay={request.mustPlay})...", flush=True)
            response = await client.chat.completions.create(
                model="deepseek-chat",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            content = response.choices[0].message.content
            resp_json = json.loads(content)
            
            action = resp_json.get("action", "").lower()
            dialogue = resp_json.get("dialogue", "")

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
