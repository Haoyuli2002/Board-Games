"""
Text-to-Speech Generator for Board Games
支持多种TTS引擎：Azure Cognitive Services, 本地TTS等
"""

import os
import json
import hashlib
from pathlib import Path
from typing import Optional, Dict, List
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TTSGenerator:
    def __init__(self, engine='azure', cache_dir='../assets/voices'):
        """
        初始化TTS生成器
        
        Args:
            engine: TTS引擎类型 ('azure', 'local')
            cache_dir: 语音文件缓存目录
        """
        self.engine = engine
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # 语音配置文件
        self.voice_config_file = self.cache_dir / 'voice_config.json'
        self.voice_config = self._load_voice_config()
        
        # 初始化TTS引擎
        self._init_engine()
    
    def _load_voice_config(self) -> Dict:
        """加载语音配置"""
        if self.voice_config_file.exists():
            with open(self.voice_config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {
            'generated': [],
            'voice_settings': {
                'azure_voice': 'zh-CN-XiaoxiaoNeural',
                'rate': 'medium',
                'pitch': 'medium'
            }
        }
    
    def _save_voice_config(self):
        """保存语音配置"""
        with open(self.voice_config_file, 'w', encoding='utf-8') as f:
            json.dump(self.voice_config, f, ensure_ascii=False, indent=2)
    
    def _init_engine(self):
        """初始化TTS引擎"""
        if self.engine == 'azure':
            self._init_azure()
        elif self.engine == 'local':
            self._init_local()
        else:
            raise ValueError(f"Unsupported TTS engine: {self.engine}")
    
    def _init_azure(self):
        """初始化Azure TTS"""
        try:
            import azure.cognitiveservices.speech as speechsdk
            self.speechsdk = speechsdk
            
            # 从环境变量获取API密钥
            api_key = os.getenv('AZURE_SPEECH_KEY')
            region = os.getenv('AZURE_SPEECH_REGION', 'eastus')
            
            if not api_key:
                logger.warning("Azure Speech API key not found. Set AZURE_SPEECH_KEY environment variable.")
                self.speech_config = None
                return
            
            self.speech_config = speechsdk.SpeechConfig(
                subscription=api_key,
                region=region
            )
            self.speech_config.speech_synthesis_voice_name = self.voice_config['voice_settings']['azure_voice']
            logger.info("Azure TTS initialized successfully")
            
        except ImportError:
            logger.error("Azure Speech SDK not installed. Run: pip install azure-cognitiveservices-speech")
            self.speech_config = None
        except Exception as e:
            logger.error(f"Failed to initialize Azure TTS: {e}")
            self.speech_config = None
    
    def _init_local(self):
        """初始化本地TTS（使用系统TTS）"""
        try:
            import subprocess
            # 检查系统是否支持say命令（macOS）
            result = subprocess.run(['which', 'say'], capture_output=True)
            self.has_say = result.returncode == 0
            logger.info(f"Local TTS (say command) available: {self.has_say}")
        except Exception as e:
            logger.error(f"Failed to check local TTS: {e}")
            self.has_say = False
    
    def _get_cache_filename(self, text: str) -> str:
        """根据文本生成缓存文件名"""
        # 使用MD5哈希生成唯一文件名
        text_hash = hashlib.md5(text.encode('utf-8')).hexdigest()[:8]
        # 清理文本作为文件名的一部分
        clean_text = ''.join(c for c in text if c.isalnum() or c in '-_')[:20]
        
        # 根据引擎选择文件格式
        if self.engine == 'local':
            return f"{clean_text}_{text_hash}.aiff"
        else:
            return f"{clean_text}_{text_hash}.wav"
    
    def generate_speech(self, text: str, force_regenerate: bool = False) -> Optional[str]:
        """
        生成语音文件
        
        Args:
            text: 要转换的文本
            force_regenerate: 是否强制重新生成（忽略缓存）
        
        Returns:
            语音文件路径，失败返回None
        """
        if not text.strip():
            return None
        
        # 检查缓存
        filename = self._get_cache_filename(text)
        filepath = self.cache_dir / filename
        
        if filepath.exists() and not force_regenerate:
            logger.info(f"Using cached audio: {filename}")
            return str(filepath)
        
        # 生成新的语音文件
        success = False
        
        if self.engine == 'azure':
            success = self._generate_azure_speech(text, filepath)
        elif self.engine == 'local':
            success = self._generate_local_speech(text, filepath)
        
        if success:
            # 更新配置文件
            if text not in self.voice_config['generated']:
                self.voice_config['generated'].append(text)
                self._save_voice_config()
            
            logger.info(f"Generated speech file: {filename}")
            return str(filepath)
        
        return None
    
    def _generate_azure_speech(self, text: str, filepath: Path) -> bool:
        """使用Azure生成语音"""
        if not self.speech_config:
            logger.warning("Azure TTS not properly configured")
            return False
        
        try:
            synthesizer = self.speechsdk.SpeechSynthesizer(
                speech_config=self.speech_config,
                audio_config=self.speechsdk.audio.AudioOutputConfig(filename=str(filepath))
            )
            
            result = synthesizer.speak_text_async(text).get()
            
            if result.reason == self.speechsdk.ResultReason.SynthesizingAudioCompleted:
                return True
            else:
                logger.error(f"Azure TTS failed: {result.reason}")
                return False
                
        except Exception as e:
            logger.error(f"Azure TTS generation failed: {e}")
            return False
    
    def _generate_local_speech(self, text: str, filepath: Path) -> bool:
        """使用本地系统生成语音"""
        if not self.has_say:
            logger.warning("Local TTS (say command) not available")
            return False
        
        try:
            import subprocess
            
            # 首先检查可用的中文语音
            voices_result = subprocess.run(['say', '-v', '?'], capture_output=True, text=True)
            
            # 查找中文语音，优先级：Mei-Jia > Ting-Ting > Sin-ji
            chinese_voice = 'Mei-Jia'  # 默认值
            if 'Ting-Ting' in voices_result.stdout:
                chinese_voice = 'Ting-Ting'
            elif 'Sin-ji' in voices_result.stdout:
                chinese_voice = 'Sin-ji'
            elif 'Mei-Jia' in voices_result.stdout:
                chinese_voice = 'Mei-Jia'
            else:
                # 如果没有中文语音，使用系统默认语音
                chinese_voice = None
            
            # 构建命令
            cmd = ['say']
            if chinese_voice:
                cmd.extend(['-v', chinese_voice])
            cmd.extend(['-o', str(filepath), text])
            
            logger.info(f"Using voice: {chinese_voice or 'default'}")
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0 and filepath.exists():
                return True
            else:
                logger.error(f"Local TTS failed: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Local TTS generation failed: {e}")
            return False
    
    def batch_generate(self, texts: List[str]) -> Dict[str, str]:
        """
        批量生成语音文件
        
        Args:
            texts: 文本列表
        
        Returns:
            文本到文件路径的映射
        """
        results = {}
        total = len(texts)
        
        for i, text in enumerate(texts, 1):
            logger.info(f"Generating speech {i}/{total}: {text[:30]}...")
            filepath = self.generate_speech(text)
            if filepath:
                results[text] = filepath
            
        logger.info(f"Batch generation complete: {len(results)}/{total} successful")
        return results


def generate_doudizhu_voices():
    """为斗地主游戏生成所有语音文件"""
    
    # 游戏中所有可能的对话
    dialogues = [
        # 叫地主阶段
        "让你们来吧", "我就看看", "这手牌一般般",
        "不叫", "手牌不太行", "先观望一下",
        "试试看", "叫一分", "我来试试",
        "好牌必须叫", "两分", "这手牌不错",
        "三分到底", "必胜之局", "这把稳了",
        
        # 出牌阶段 - 跳过
        "不要", "跟不起", "让你过", "先等等",
        "不出", "等等看",
        
        # 出牌阶段 - 出牌
        "炸弹来了", "爆炸", "哈哈炸弹",
        "王炸", "双王出击", "无敌了",
        "长牌压制", "顺子走起", "连牌漂亮",
        "大牌压制", "2来了", "压你一手",
        "出张小牌", "试探一下", "先出个小的",
        "跟上", "出牌", "来了", "接着"
    ]
    
    # 尝试多种TTS引擎
    engines = ['azure', 'local']
    
    for engine in engines:
        try:
            logger.info(f"尝试使用 {engine} 引擎生成语音...")
            tts = TTSGenerator(engine=engine)
            
            results = tts.batch_generate(dialogues)
            
            if results:
                logger.info(f"使用 {engine} 引擎成功生成 {len(results)} 个语音文件")
                
                # 生成语音映射文件供前端使用
                mapping_file = Path('../assets/voices/voice_mapping.json')
                with open(mapping_file, 'w', encoding='utf-8') as f:
                    json.dump(results, f, ensure_ascii=False, indent=2)
                
                return results
            else:
                logger.warning(f"{engine} 引擎未能生成任何语音文件")
                
        except Exception as e:
            logger.error(f"{engine} 引擎初始化失败: {e}")
            continue
    
    logger.error("所有TTS引擎都失败了")
    return {}


if __name__ == "__main__":
    print("🎤 开始生成斗地主游戏语音文件...")
    
    # 创建voices目录
    voices_dir = Path('../assets/voices')
    voices_dir.mkdir(parents=True, exist_ok=True)
    
    # 生成语音文件
    results = generate_doudizhu_voices()
    
    if results:
        print(f"✅ 成功生成 {len(results)} 个语音文件!")
        print(f"📁 文件保存在: {voices_dir.absolute()}")
        print("\n生成的文件:")
        for text, filepath in list(results.items())[:5]:  # 显示前5个
            filename = Path(filepath).name
            print(f"  • {text} → {filename}")
        
        if len(results) > 5:
            print(f"  ... 还有 {len(results) - 5} 个文件")
        
        print("\n🎮 现在可以在游戏中享受AI语音了!")
    else:
        print("❌ 语音生成失败")
        print("\n💡 解决方案:")
        print("1. 设置Azure Speech API密钥:")
        print("   export AZURE_SPEECH_KEY='your-api-key'")
        print("   export AZURE_SPEECH_REGION='eastus'")
        print("2. 或者确保系统支持本地TTS (macOS的say命令)")