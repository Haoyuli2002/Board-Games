import json
from openai import AsyncOpenAI
import os
from typing import List, Dict, Any

class AIAgent:
    def __init__(self, player_id: int, name: str, api_key: str, base_url: str):
        self.player_id = player_id
        self.name = name
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.messages: List[Dict[str, str]] = []
        self.last_seen_round_index = -1

    def reset_context(self):
        """Clear conversation history for a new game."""
        self.messages = []
        self.last_seen_round_index = -1
        print(f"Agent {self.name} (ID: {self.player_id}) context reset.")

    def add_message(self, role: str, content: str):
        """Add a message to the agent's history."""
        self.messages.append({"role": role, "content": content})
        # Keep context manageable (optional: truncate if too long)
        if len(self.messages) > 20:
             self.messages = self.messages[-20:]

    async def get_decision(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        """Get a JSON decision from DeepSeek using current context."""
        try:
            # Combine current status/prompt with history
            # We don't necessarily want to keep the system prompt in the long-term history if it changes per phase
            # But the agent's personality remains the same.
            
            messages = [{"role": "system", "content": system_prompt}] + self.messages + [{"role": "user", "content": user_prompt}]
            
            # Debug: Print Agent History
            print(f"\n>>>> [Debug] {self.name} (ID: {self.player_id}) 的上下文明细:")
            for m in messages:
                role = m['role'].upper()
                content = m['content'].replace('\n', ' ')
                print(f"     [{role}] {content[:100]}{'...' if len(content) > 100 else ''}")
                # print(f"     [{role}] {content}")
            print("<<<<\n", flush=True)
            
            response = await self.client.chat.completions.create(
                model="deepseek-chat",
                messages=messages,
                response_format={"type": "json_object"},
                temperature=1.3,
                frequency_penalty=1.0,
                presence_penalty=0.6
            )
            
            content = response.choices[0].message.content
            return json.loads(content)
        except Exception as e:
            print(f"Error in Agent {self.name} decision: {e}")
            raise e
