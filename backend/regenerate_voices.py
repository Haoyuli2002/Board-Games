#!/usr/bin/env python3
"""
强制重新生成所有语音文件，使用优化后的配置
"""

import os
import json
import hashlib
from pathlib import Path
from typing import Optional, Dict, List
import logging
import subprocess

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def generate_enhanced_local_speech(text: str, filepath: Path) -> bool:
    """使用优化后的本地TTS生成语音"""
    try:
        # 检查可用的中文语音
        voices_result = subprocess.run(['say', '-v', '?'], capture_output=True, text=True)
        
        # 查找最佳中文语音，优先级：Tingting > Meijia > Eddy (Chinese) > Flo (Chinese)
        chinese_voice = None
        if 'Tingting' in voices_result.stdout:
            chinese_voice = 'Tingting'
        elif 'Meijia' in voices_result.stdout:
            chinese_voice = 'Meijia'
        elif 'Sinji' in voices_result.stdout:
            chinese_voice = 'Sinji'
        elif 'Eddy (Chinese (China mainland))' in voices_result.stdout:
            chinese_voice = 'Eddy (Chinese (China mainland))'
        elif 'Flo (Chinese (China mainland))' in voices_result.stdout:
            chinese_voice = 'Flo (Chinese (China mainland))'
        
        # 生成临时AIFF文件
        temp_aiff = filepath.with_suffix('.aiff')
        
        # 构建命令，添加语速和质量参数
        cmd = ['say']
        if chinese_voice:
            cmd.extend(['-v', chinese_voice])
        # 设置语速（稍快一些，更自然）
        cmd.extend(['-r', '200'])
        cmd.extend(['-o', str(temp_aiff), text])
        
        logger.info(f"Using voice: {chinese_voice or 'default'} with enhanced settings")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0 and temp_aiff.exists():
            # 转换为WAV格式以获得更好的兼容性和质量
            try:
                # 使用ffmpeg转换（如果可用）
                convert_result = subprocess.run([
                    'ffmpeg', '-i', str(temp_aiff), 
                    '-ar', '22050',  # 设置采样率
                    '-ac', '1',      # 单声道
                    '-y',            # 覆盖现有文件
                    str(filepath.with_suffix('.wav'))
                ], capture_output=True, text=True)
                
                if convert_result.returncode == 0:
                    # 删除临时AIFF文件
                    temp_aiff.unlink()
                    logger.info(f"Converted to WAV: {filepath.with_suffix('.wav').name}")
                    return True
                else:
                    logger.warning("FFmpeg conversion failed, keeping AIFF format")
                    # 如果转换失败，重命名AIFF文件为最终文件
                    temp_aiff.rename(filepath)
                    logger.info(f"Generated AIFF: {filepath.name}")
                    return True
                    
            except FileNotFoundError:
                logger.warning("FFmpeg not found, keeping AIFF format")
                # 重命名AIFF文件为最终文件
                temp_aiff.rename(filepath)
                logger.info(f"Generated AIFF: {filepath.name}")
                return True
        else:
            logger.error(f"Local TTS failed: {result.stderr}")
            return False
            
    except Exception as e:
        logger.error(f"Local TTS generation failed: {e}")
        return False


def regenerate_all_voices():
    """重新生成所有语音文件"""
    
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
    
    # 创建voices目录
    voices_dir = Path('../assets/voices')
    voices_dir.mkdir(parents=True, exist_ok=True)
    
    # 清理旧文件
    for old_file in voices_dir.glob('*.aiff'):
        old_file.unlink()
    for old_file in voices_dir.glob('*.wav'):
        old_file.unlink()
    
    results = {}
    total = len(dialogues)
    
    for i, text in enumerate(dialogues, 1):
        logger.info(f"Generating speech {i}/{total}: {text}")
        
        # 生成文件名
        text_hash = hashlib.md5(text.encode('utf-8')).hexdigest()[:8]
        clean_text = ''.join(c for c in text if c.isalnum() or c in '-_')[:20]
        
        # 尝试WAV格式，如果失败则使用AIFF
        wav_filepath = voices_dir / f"{clean_text}_{text_hash}.wav"
        aiff_filepath = voices_dir / f"{clean_text}_{text_hash}.aiff"
        
        if generate_enhanced_local_speech(text, wav_filepath):
            if wav_filepath.exists():
                results[text] = str(wav_filepath).replace('../assets/', './assets/')
            elif aiff_filepath.exists():
                results[text] = str(aiff_filepath).replace('../assets/', './assets/')
    
    # 生成语音映射文件
    mapping_file = voices_dir / 'voice_mapping.json'
    with open(mapping_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    logger.info(f"Successfully generated {len(results)}/{total} voice files")
    return results


if __name__ == "__main__":
    print("🎤 强制重新生成所有语音文件...")
    
    # 重新生成语音文件
    results = regenerate_all_voices()
    
    if results:
        print(f"✅ 成功生成 {len(results)} 个语音文件!")
        print(f"📁 文件保存在: {Path('../assets/voices').absolute()}")
        print("\n生成的文件:")
        for text, filepath in list(results.items())[:5]:  # 显示前5个
            filename = Path(filepath).name
            print(f"  • {text} → {filename}")
        
        if len(results) > 5:
            print(f"  ... 还有 {len(results) - 5} 个文件")
        
        print("\n🎮 现在可以在游戏中享受更高质量的AI语音了!")
    else:
        print("❌ 语音生成失败")