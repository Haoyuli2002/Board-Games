# 斗地主AI后端 - 虚拟环境配置说明

## 🎯 概述

本项目已配置虚拟环境来管理Python依赖，确保项目的独立性和稳定性。AI后端使用DeepSeek大语言模型提供智能决策。

✅ **创建虚拟环境**: `backend/venv/`  
✅ **安装所有依赖**: FastAPI, OpenAI, 等  
✅ **修复叫分逻辑**: 严格验证叫分规则  
✅ **中文Prompt**: 更自然的AI对话  
✅ **启动脚本**: `start_server.sh`  

## 🚀 使用方法

### 1. 配置API密钥

编辑 `backend/.env` 文件：

```env
# 将下面的密钥替换为您的实际DeepSeek API密钥
DeepSeek_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**获取DeepSeek API密钥：**
1. 访问 https://platform.deepseek.com/
2. 注册并登录账号
3. 在API管理页面创建新的API密钥
4. 复制密钥到.env文件中

### 2. 启动AI后端服务

**方法一：使用启动脚本（推荐）**
```bash
cd backend
./start_server.sh
```

**方法二：手动启动**
```bash
cd backend
source venv/bin/activate
python server.py
```

### 3. 验证服务启动

服务启动后您会看到：
```
INFO:     Uvicorn running on http://127.0.0.1:5000 (Press CTRL+C to quit)
```

### 4. 测试游戏

1. 打开 `lobby.html` 进入游戏大厅
2. 选择"斗地主"
3. 在游戏左上角切换到"大师"模式
4. 开始与AI对战！

## 📁 项目结构

```
backend/
├── venv/                 # Python虚拟环境
├── server.py            # 主服务器文件
├── requirements.txt     # 依赖清单
├── .env                 # API密钥配置
├── start_server.sh      # 启动脚本
└── README_虚拟环境配置.md # 本说明文件
```

## 🐛 常见问题

**Q: 提示模块未找到**
A: 确保使用虚拟环境：`source venv/bin/activate`

**Q: API调用失败**
A: 检查.env文件中的DeepSeek API密钥是否正确配置

**Q: 权限错误**
A: 给启动脚本添加执行权限：`chmod +x start_server.sh`

## 🎮 游戏体验

现在AI会：
- 🧠 根据手牌实力智能叫地主
- 🎯 严格遵守叫分规则
- 🎪 使用中文思考和决策
- 🛡️ 处理异常情况更稳定

享受与高智能AI的斗地主对战吧！