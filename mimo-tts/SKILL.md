---
name: mimo-tts
description: 使用小米 MiMo API 进行文本转语音（TTS）。支持通过 sample.mp3 克隆音色，可在正文中用括号调整局部语气。需要 MIMO_TTS_API_KEY。
metadata:
  {
    "openclaw":
      {
        "requires": { "env": ["MIMO_TTS_API_KEY"] },
        "primaryEnv": "MIMO_TTS_API_KEY",
      },
  }
---

# MiMo TTS

使用小米 MiMo API 的文本转语音技能，支持音色克隆和语气调整。

## 用法

通过 `index.ts` 导出的接口调用，需要传入 `text` 参数（必填）。支持用括号在正文中调整局部语气，如"（开心）今天天气真好！"。

## 环境依赖

- `MIMO_TTS_API_KEY` 环境变量
- `sample.mp3` 作为音色参考
