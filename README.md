# 🎲 棋牌游戏大厅

> 一个基于原生前端技术 + Python AI 后端 + AI陪玩的在线棋牌游戏合集，目前包含 **21点 (Blackjack)** 和 **斗地主 (Dou Di Zhu)** 两款经典卡牌游戏。

<p align="center">
  <img src="assets/blackjack_cover.png" width="45%" alt="21点封面" />
  <img src="assets/doudizhu_cover.png" width="45%" alt="斗地主封面" />
</p>

---

## ✨ 项目亮点

- 🎰 **纯前端即玩** — 双击 `lobby.html` 即可开始，无需安装任何依赖
- 🤖 **AI陪玩** — 斗地主可接入 DeepSeek 大语言模型，体验个性鲜明的AI陪玩，与大模型进行博弈。
- 🎵 **沉浸式音效** — AI 生成的背景音乐 (Jazz/Pop)、游戏音效与 Edge TTS 语音播报
- 🎨 **精美视效** — CSS3 动画驱动的发牌、出牌、爆炸等动态效果

---

## 🎮 游戏介绍

### 🃏 21点 (Blackjack)

| 特性 | 说明 |
|------|------|
| 入口 | `index.html` |
| 玩法 | Hit（要牌）/ Stand（停牌）/ Double Down（加倍） |
| 规则 | 标准赌场规则，庄家 <17 必须补牌，Ace 弹性计 1 或 11 |
| 赔率 | Blackjack 1.5 倍赔率 |
| 特效 | 筹码动画、发牌动效、BGM 双轨切换 (Jazz/Pop)、5 种拟真音效 |

### 🀄 斗地主

| 特性 | 说明 |
|------|------|
| 入口 | `doudizhu.html` |
| 玩法 | 完整三人斗地主，叫分抢地主 → 出牌对战 → 积分结算 |
| 牌型 | 单张、对子、三带、顺子、连对、飞机、炸弹、火箭等全牌型校验 |
| 🟢 普通模式 | 前端贪心算法引擎，规则匹配"刚好压死上家"的最优出牌 |
| 🔴 大师模式 | DeepSeek LLM 驱动，携带全局手牌 + 历史出牌记录进行推理决策 |
| 🎙️ 语音 | Edge TTS 中文语音播报（叫分、出牌、炸弹等语音反馈） |

#### 两位 AI 陪玩角色

游戏中有两位性格鲜明的 AI 角色陪你对战，且每位角色会根据身份（地主/农民）展现截然不同的人格：

| | **云希** — 豪迈侠客 | **晓伊** — 聪慧俏皮 |
|---|---|---|
| 位置 | 右侧 (AI1) | 上方 (AI2) |
| 语音 | `zh-CN-YunxiNeural` 男声 | `zh-CN-XiaoyiNeural` 女声 |
| 🌾 **农民人格** | 英俊豪爽、自信直率的古风侠客，台词豪迈果断，带着侠气，与队友并肩作战 | 温婉聪慧、睿智从容的古风少女，优雅且充满智谋，偶尔开个小玩笑，与队友共商破敌之策 |
| 👑 **地主人格** | 极其狂妄自大，认为自己天下无敌，台词充满嘲讽傲慢，视农民如无物 | 腹黑高傲，优雅地嘲讽，视对手为股掌间的玩物，带着掌控全局的冷淡与轻蔑 |
| 头像 | 农民/地主双形态专属头像，随身份动态切换 | 农民/地主双形态专属头像，随身份动态切换 |

---

## 📂 项目结构

```
Board-Games/
├── lobby.html                  # 🏠 游戏大厅总入口
├── index.html                  # 🃏 21点游戏页面
├── doudizhu.html               # 🀄 斗地主游戏页面
├── README.md                   # 📖 项目说明文档
│
├── css/                        # 🎨 样式文件
│   ├── lobby.css               #    大厅样式
│   ├── style.css               #    21点样式
│   └── doudizhu.css            #    斗地主样式
│
├── js/                         # ⚙️ 前端逻辑
│   ├── game.js                 #    21点游戏逻辑
│   └── doudizhu.js             #    斗地主游戏逻辑（含贪心AI）
│
├── assets/                     # 🖼️ 资源文件
│   ├── *.png                   #    封面图、卡背、头像等图片
│   ├── avatars/                #    玩家头像（农民/地主）
│   ├── sounds/                 #    BGM 与游戏音效
│   ├── voices/                 #    Edge TTS 生成的中文语音
│   └── voices_chattts/         #    ChatTTS 备选语音
│
├── backend/                    # 🐍 Python AI 后端
│   ├── server.py               #    FastAPI 主程序（LLM + TTS）
│   ├── tts_generator.py        #    Edge TTS 语音生成工具
│   ├── regenerate_voices.py    #    语音批量重新生成脚本
│   ├── requirements.txt        #    Python 依赖清单
│   ├── start_server.sh         #    一键启动脚本
│   └── README_虚拟环境配置.md    #    后端环境配置详细说明
│
└── 复盘报告/                    # 📝 项目开发复盘文档
    ├── 综合复盘报告.md
    ├── AI开发能力复盘报告.md
    └── LLM_AI方案/
```

---

## 🚀 快速开始

### 方式一：纯前端模式（零安装）

> 适用于：21点 + 斗地主普通模式

```bash
# 直接在浏览器中打开
open lobby.html
```

或者双击 `lobby.html` → 选择游戏 → 开始游玩！

### 方式二：大师 AI 模式（斗地主 LLM 对战）

> 需要：Python 3.8+ 、DeepSeek API 密钥

#### 1️⃣ 配置环境

```bash
cd backend

# 创建虚拟环境（如尚未创建）
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate        # macOS / Linux
# venv\Scripts\activate         # Windows

# 安装依赖
pip install -r requirements.txt
```

#### 2️⃣ 配置 API 密钥

1. 前往 [DeepSeek 平台](https://platform.deepseek.com/) 获取 API Key
2. 在 `backend/` 目录下创建 `.env` 文件：

```env
DeepSeek_API_KEY=sk-72280df5f63242d3b68f4e3c7089eefe
```

#### 3️⃣ 启动后端服务

```bash
# 推荐：一键启动
cd backend
./start_server.sh

# 或手动启动
cd backend
source venv/bin/activate
python server.py
```

看到以下输出即表示启动成功：

```
🚀 启动FastAPI服务器...
🌐 服务将在 http://127.0.0.1:5000 启动
```

#### 4️⃣ 开始对战

1. 浏览器打开 `lobby.html`
2. 进入斗地主
3. **左上角切换为「大师」模式** ⭐
4. 享受与 LLM AI 的高智商博弈！

---

## 🛠️ 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端** | HTML5 / CSS3 / Vanilla JS | 原生实现，无框架依赖 |
| **后端** | Python / FastAPI / Uvicorn | 轻量级 AI 决策服务 |
| **AI 决策** | DeepSeek API (OpenAI 兼容) | 大语言模型驱动的斗地主高级 AI |
| **语音合成** | Edge TTS / ChatTTS | 中文语音播报 |
| **BGM/音效** | Suno AI / ElevenLabs | AI 生成的游戏背景音乐和音效 |

---

## ⚠️ 注意事项

- **API 费用**：DeepSeek API 按使用量计费，普通模式完全免费
- **网络要求**：仅大师模式需要网络连接
- **浏览器兼容**：推荐使用 Chrome / Edge / Safari 等现代浏览器
- **环境隔离**：后端使用 Python 虚拟环境 (`venv`)，不会影响系统 Python 环境
- **详细配置**：更多后端配置细节请参阅 [`backend/README_虚拟环境配置.md`](backend/README_虚拟环境配置.md)

---