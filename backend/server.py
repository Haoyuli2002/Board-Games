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
            prompt = f"""You are a professional Doudizhu player.
Current Phase: Bidding (叫地主)
Your Hand: {json.dumps(request.hand, ensure_ascii=False)}
Current Max Bid: {request.maxBid}

Evaluate your hand strength. A strong hand has many 2s, Jokers, bombs, or very smooth sequences.
Respond ONLY with a valid JSON object in this format:
{{"bid": [0, 1, 2, or 3]}}
If your hand is poor or mediocre, bid 0. If it's extremely strong, bid 3. You must bid higher than Max Bid (if you want to bid), otherwise bid 0.
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
            return {"decision": bid}

        # Phase 2: Playing
        elif request.phase == "playing":
            prompt = f"""You are a professional Doudizhu player.
Current Phase: Playing Cards (出牌)
Your Hand: {json.dumps(request.hand, ensure_ascii=False)}
Are you forced to play any valid combo because you have control? (mustPlay): {request.mustPlay}
Last Real Play to beat: {json.dumps(request.lastRealPlay, ensure_ascii=False) if request.lastRealPlay else "None"}
Past Rounds History: {json.dumps(request.pastRounds, ensure_ascii=False)}

If you are forced to play (mustPlay is true), you must put down a valid combination of cards from your hand (smallest valid combo is usually preferred to start).
If mustPlay is false, you must beat the "Last Real Play" using a valid combination from your hand that is strictly greater in rule value, OR you can pass.
If you decide to pass, output {{"action": "pass"}}.
If you decide to play, output {{"action": "play", "cards": [{{"suit": "...", "rank": "...", "value": ...}}, ...]}}. The "cards" list must ONLY contain exact objects from your Hand array.

Respond EXACTLY with valid JSON.
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
    
