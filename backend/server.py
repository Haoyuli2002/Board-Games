import os
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Any
from dotenv import load_dotenv
from openai import AsyncOpenAI

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

@app.get("/")
async def root():
    return {
        "message": "斗地主AI后端服务器正在运行",
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
    hand: List[Any]
    maxBid: Optional[int] = None
    mustPlay: Optional[bool] = None
    lastRealPlay: Optional[Any] = None
    pastRounds: Optional[List[Any]] = []


@app.post("/api/ai-play")
async def get_ai_decision(request: AIRequest):
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
            
            prompt = f"""你是一个专业的斗地主玩家。

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
{{"bid": {valid_bids}中的一个数字}}
"""
            
            response = await client.chat.completions.create(
                model="deepseek-chat",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            content = response.choices[0].message.content
            # try parsing
            resp_json = json.loads(content)
            bid = resp_json.get("bid", 0)
            
            # 验证叫分是否合法
            if bid not in valid_bids:
                print(f"AI返回了无效叫分: {bid}, 有效范围: {valid_bids}")
                # 使用保守策略：如果AI叫分无效，默认不叫
                bid = 0
            
            return {"decision": bid}

        # Phase 2: Playing
        elif request.phase == "playing":
            must_play_text = "是" if request.mustPlay else "否"
            last_play_text = json.dumps(request.lastRealPlay, ensure_ascii=False) if request.lastRealPlay else "无（你是首出）"
            
            prompt = f"""你是一个专业的斗地主玩家。

当前阶段：出牌
你的手牌：{json.dumps(request.hand, ensure_ascii=False)}
是否必须出牌：{must_play_text}
需要压过的牌型：{last_play_text}
历史出牌记录：{json.dumps(request.pastRounds, ensure_ascii=False)}

出牌规则：
- 如果必须出牌：你获得了出牌权，必须从手牌中出一个合法牌型
- 如果不必须出牌：你需要出比上家更大的同类型牌型，或者选择"不要"（pass）

出牌策略建议：
- 必须出牌时：通常出最小的牌型，保存强牌到后面
- 跟牌时：如果能轻松压过且不浪费强牌，可以跟牌
- 如果需要用强牌（如2、王、炸弹）才能跟牌，建议"不要"
- 手牌较少时（5张以下），应该更积极出牌

请分析局势并做出最佳决策，必须返回以下JSON格式之一：
- 不要：{{"action": "pass"}}
- 出牌：{{"action": "play", "cards": [从你手牌中选择的确切卡牌对象数组]}}

注意：cards数组中的每个卡牌对象必须完全来自你的手牌数组，包括suit、rank、value等所有字段。
"""

            response = await client.chat.completions.create(
                model="deepseek-chat", # DeepSeek standard model
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            content = response.choices[0].message.content
            resp_json = json.loads(content)
            
            if resp_json.get("action", "").lower() == "pass":
                return {"decision": "PASS"}
            elif resp_json.get("action", "").lower() == "play" and "cards" in resp_json:
                return {"decision": resp_json["cards"]}
            else:
                return {"decision": "PASS"} # Fallback

    except Exception as e:
        print("Error calling DeepSeek API:", e)
        # Return HTTP 500 equivalent message or fallback instruction
        return {"error": str(e), "decision": "FALLBACK"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5000)
    
