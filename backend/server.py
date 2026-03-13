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
from dotenv import load_dotenv
from openai import AsyncOpenAI
import random
import edge_tts
from prompts import (
    BIDDING_LINES_AI1, PLAYING_LINES_AI1,
    BIDDING_LINES_AI2, PLAYING_LINES_AI2,
    AI_NAMES, TTS_VOICES,
    get_system_prompt, get_bidding_prompt, get_playing_prompt
)
from agents import AIAgent

# Load environment variables
load_dotenv()
API_KEY = os.getenv("DeepSeek_API_KEY")
BASE_URL = "https://api.deepseek.com/v1"

# Initialize Agents
yunxi_agent = AIAgent(1, "云希", API_KEY, BASE_URL)
xiaoyi_agent = AIAgent(2, "晓伊", API_KEY, BASE_URL)

# Initialize DeepSeek client (for general use if needed, though agents have their own)
client = AsyncOpenAI(
    api_key=API_KEY,
    base_url=BASE_URL
)

app = FastAPI()
print("\n✅ [AI Server] 启动成功。当前版本：AI Agent", flush=True)

# Allow ALL origins for local development (supports file:// and local IP)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Set to False when allow_origins is ["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)



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



@app.post("/api/reset-game")
async def reset_game():
    print("\n[Backend] 收到重置请求，清空 AI Agent 上下文", flush=True)
    yunxi_agent.reset_context()
    xiaoyi_agent.reset_context()
    return {"status": "success", "message": "Agents memory cleared"}

def sync_agent_history(agent: AIAgent, request: AIRequest):
    """Update agent's internal message history from the request's pastRounds."""
    # current_rounds is the list of provided history.
    # We only add rounds that hasn't been seen yet.
    history = request.pastRounds if request.pastRounds else []
    
    # Simple synchronization: if history is longer than what we've seen
    # We could also use the length of history to determine new messages
    if len(history) > agent.last_seen_round_index + 1:
        new_rounds = history[agent.last_seen_round_index + 1:]
        for r in new_rounds:
            p_id = r.get("player")
            p_cards = r.get("cards", [])
            p_dialogue = r.get("content", r.get("dialogue", "")) # Support both keys
            
            cards_str = ",".join([c.get('rank', '') for c in p_cards]) if isinstance(p_cards, list) else str(p_cards)
            
            if p_id == agent.player_id:
                name_label = "你"
            elif p_id == 0:
                name_label = "小明"
            else:
                name_label = AI_NAMES.get(p_id, f"玩家 {p_id}")
            
            # 确定身份 (Identity)
            is_p_landlord = (p_id == request.landlordId)
            identity_label = "地主" if is_p_landlord else "农民"
            
            # 格式：名字 (身份): "台词"
            content = f"{name_label} ({identity_label}): \"{p_dialogue}\""
            
            # If it was the agent itself, label as assistant for better LLM adherence
            role = "assistant" if p_id == agent.player_id else "user"
            agent.add_message(role, content)
            
        agent.last_seen_round_index = len(history) - 1

@app.post("/api/ai-play")
async def get_ai_decision(request: AIRequest):
    print(f"\n[Backend] 收到 AI 请求: Player {request.playerId}, Phase: {request.phase}, Mode: Master", flush=True)
    
    agent = xiaoyi_agent if request.playerId == 2 else yunxi_agent
    
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
            
            system_prompt = get_system_prompt(request.playerId, False, landlord_id=request.landlordId, phase="bidding")
            
            prompt = get_bidding_prompt(request.hand, request.maxBid if request.maxBid else 0, valid_bids)
            
            print(f"DeepSeek 正在调用 (Bidding, Player {request.playerId}, Agent Stateful)...", flush=True)
            
            resp_json = await agent.get_decision(system_prompt, prompt)
            
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

            system_prompt = get_system_prompt(request.playerId, is_landlord, landlord_id=request.landlordId)
            
            # 同步历史记录到 Agent
            sync_agent_history(agent, request)
            
            # 格式化历史记录（即便 Agent 有内存，Prompt 里的历史也很重要，作为短期参考）
            formatted_history = []
            for r in request.pastRounds:
                p_id = r.get("player")
                p_cards = r.get("cards", [])
                p_dialogue = r.get("dialogue", "")
                
                if p_id == request.playerId:
                    speaker = "你(你自己)"
                elif p_id == 0:
                    # 小明 (p_id=0) 在你作为农民且他也是农民时是队友
                    if not is_landlord and request.landlordId != 0:
                        speaker = "小明(你的队友)"
                    else:
                        speaker = "小明(你的对手)" if is_landlord else "小明(地主)"
                else:
                    speaker = AI_NAMES.get(p_id, f"AI {p_id}")
                    if not is_landlord:
                        speaker += "(你的队友)" if p_id != request.landlordId else "(地主)"
                
                cards_str = ",".join([c.get('rank', '') for c in p_cards]) if isinstance(p_cards, list) else str(p_cards)
                formatted_history.append(f"{speaker}: 出牌 [{cards_str}], 台词: \"{p_dialogue}\"")

            prompt = get_playing_prompt(request.hand, request.mustPlay, last_play_desc, teammate_caution, formatted_history, must_play_warning)

            print(f"DeepSeek 正在调用 (Playing, Player {request.playerId}, Agent Stateful, mustPlay={request.mustPlay})...", flush=True)
            
            resp_json = await agent.get_decision(system_prompt, prompt)
            
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

class ChatRequest(BaseModel):
    playerId: int
    playerMessage: str
    landlordId: int
    pastRounds: List[dict]

@app.post("/api/ai-chat")
async def get_ai_chat(request: ChatRequest):
    print(f"\n[Backend] 收到 AI 聊天请求: Player {request.playerId}, Content: {request.playerMessage}", flush=True)
    
    agent = xiaoyi_agent if request.playerId == 2 else yunxi_agent
    
    try:
        # 同步历史记录
        sync_agent_history(agent, request)
        
        is_landlord = (request.playerId == request.landlordId)
        system_prompt = get_system_prompt(request.playerId, is_landlord, landlord_id=request.landlordId, phase="chat")
        
        # 构建历史描述用于 Prompt
        formatted_history = []
        for r in request.pastRounds:
            p_id = r.get("player")
            p_dialogue = r.get("dialogue", "")
            name_label = "你(你自己)" if p_id == request.playerId else ("小明" if p_id == 0 else AI_NAMES.get(p_id, f"AI {p_id}"))
            formatted_history.append(f"{name_label}: \"{p_dialogue}\"")
        
        from prompts import get_chat_prompt
        prompt = get_chat_prompt(request.playerMessage, formatted_history)
        
        print(f"DeepSeek 正在调用 (Chat, Player {request.playerId})...", flush=True)
        resp_json = await agent.get_decision(system_prompt, prompt)
        
        dialogue = resp_json.get("dialogue", "...")[:20]
        audio_base64 = await text_to_speech_base64(dialogue, request.playerId)
        
        # 聊天响应也记录到 Agent 的内存中（作为 assistant 的回复）
        agent.add_message("assistant", f"你 ({'地主' if is_landlord else '农民'}): \"{dialogue}\"")
        
        return {"dialogue": dialogue, "audio_base64": audio_base64}
        
    except Exception as e:
        print("Error in AI chat:", e)
        return {"dialogue": "我现在没空理你。", "audio_base64": ""}

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
