# 棋牌游戏

本项目是一个棋牌游戏大厅。目前包含两款卡牌游戏：**21点**和**斗地主**。

本项目完全采用**前后端分离架构**，前端使用原生 Vanilla JS 搭配 CSS3 动态视效构建，后端采用了基于 FastAPI 构建的 AI 决策基座，支持接入大语言模型（如 DeepSeek）作为游戏内的高级"大师级 AI"。

---

## 🎮 游戏介绍

### 1. 21点 (Blackjack)
- **入口**: `index.html`
- **特点**: 沉浸式的经典赌场规则。支持下注、要牌、停牌、加倍（Double Down）等标准操作。包含筹码动画、发牌动效以及动态背景音乐控制。

### 2. 斗地主
- **入口**: `doudizhu.html`
- **特点**: 完整实现了三人斗地主的核心规则，包括叫分抢地主、合法牌型校验（顺子、连对、飞机、炸弹等）、以及记分结算模块。
- **两大核心模式**:
  - **普通模式**: 纯前端实现的贪心算法引擎，能够根据桌面场面迅速用规则匹配"刚好能压死上家"的手牌。
  - **大师模式 (LLM)**: 依托 Python 后端架构构建。每一次 AI 决策都会携带着全局手牌、当前底分、以及是**这局游戏从开局以来的所有历史出牌记录 (Past Rounds)**，作为上下文，发送给 DeepSeek 大模型进行推理响应，展现长线博弈和大局观。

---

## 📂 项目结构

```text
根目录 (Entry Points):
  ├── lobby.html       # 游戏大厅总入口
  ├── index.html       # 21点游戏主页
  ├── doudizhu.html    # 斗地主游戏主页
  └── README.md        # 项目说明文档

目录分类 (Modules):
  ├── css/             # 所有页面的样式表文件
  ├── js/              # 所有前端交互与游戏规则运算逻辑
  ├── assets/          # 游戏内置的图片、头像和音频文件
  ├── docs/            # 项目技术集成的方案设计文档与复盘记录
  └── backend/         # Python 轻量级后端基座
      ├── venv/                        # Python 虚拟环境
      ├── server.py                    # FastAPI 主程序
      ├── .env                         # 存放 AI 大模型的 API Key 秘钥
      ├── requirements.txt             # Python 依赖清单
      ├── start_server.sh              # 一键启动脚本
      └── README_虚拟环境配置.md         # 详细配置说明
```

---

## 🚀 如何启动项目

### 🎯 纯前端模式（21点 + 斗地主普通模式）
项目无需任何安装，直接双击 `lobby.html` 即可开始游戏！

### 🧠 大师AI模式（斗地主 LLM 对战）
要体验斗地主的"大师 AI 模式"，需要启动 DeepSeek 大语言模型后端服务。

#### 步骤 1：配置 DeepSeek API 密钥

1. **获取 API 密钥**：
   - 访问 [DeepSeek 平台](https://platform.deepseek.com/)
   - 注册并登录账号
   - 在 API 管理页面创建新的 API 密钥

2. **配置密钥**：
   编辑 `backend/.env` 文件，将您的密钥填入：
   ```env
   DeepSeek_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

#### 步骤 2：启动 AI 后端服务

**🎯 推荐方式（一键启动）**：
```bash
cd backend
./start_server.sh
```

**手动方式**：
```bash
cd backend
source venv/bin/activate  # 激活虚拟环境
python server.py
```

*看到 `Uvicorn running on http://127.0.0.1:5000` 表示 AI 服务启动成功！*

#### 步骤 3：开始大师 AI 对战

1. 双击打开 **`lobby.html`** 进入游戏大厅
2. 点击"斗地主"卡片进入游戏
3. **在游戏界面左上角切换为 "大师" 模式** ⭐
4. 开始与高智能 AI 的终极博弈！

## ⚠️ 重要提醒

- **环境管理**：项目使用 Python 虚拟环境管理依赖，确保环境隔离
- **API 费用**：DeepSeek API 按使用量计费。
- **网络要求**：大师模式需要网络连接以访问 DeepSeek API
- **详细文档**：更多技术细节请查看 `backend/README_虚拟环境配置.md`

---

## 🎲 快速开始

1. **立即游玩普通模式**：双击 `lobby.html` → 选择游戏 → 开始！
2. **体验大师AI**：配置API密钥 → 运行 `./backend/start_server.sh` → 切换大师模式
3. **获得帮助**：查看 `backend/README_虚拟环境配置.md` 获取详细说明

享受与高智能AI的对决吧！🎮