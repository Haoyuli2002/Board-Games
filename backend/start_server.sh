#!/bin/bash

# 激活虚拟环境并启动斗地主AI后端服务器

echo "🎮 启动斗地主AI后端服务器..."
echo "📁 当前目录: $(pwd)"

# 检查虚拟环境是否存在
if [ ! -d "venv" ]; then
    echo "❌ 虚拟环境不存在，请先运行: python3 -m venv venv"
    exit 1
fi

# 检查.env文件是否存在
if [ ! -f ".env" ]; then
    echo "❌ .env文件不存在，请先配置DeepSeek API密钥"
    exit 1
fi

# 检查API密钥是否配置
if grep -q "your_deepseek_api_key_here" .env; then
    echo "❌ 请先在.env文件中配置您的DeepSeek API密钥"
    echo "📝 编辑backend/.env文件，将DeepSeek_API_KEY设置为您的实际密钥"
    exit 1
fi

echo "🔧 激活虚拟环境..."
source venv/bin/activate

echo "🚀 启动FastAPI服务器..."
echo "🌐 服务将在 http://127.0.0.1:5000 启动"
echo "📝 按 Ctrl+C 停止服务器"
echo ""

python server.py