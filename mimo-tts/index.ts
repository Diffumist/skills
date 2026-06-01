import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_URL = "https://api.xiaomimimo.com/v1/chat/completions";
const SAMPLE_PATH = path.join(__dirname, "sample.mp3");

function getKey(): string {
  const key = process.env.MIMO_TTS_API_KEY ?? "";
  if (!key) throw new Error("[mimo-tts] MIMO_TTS_API_KEY 未配置");
  return key;
}

function getSampleVoiceBase64(): string {
  if (!fs.existsSync(SAMPLE_PATH)) throw new Error("[mimo-tts] sample.mp3 不存在");
  const buf = fs.readFileSync(SAMPLE_PATH);
  return "data:audio/mpeg;base64," + buf.toString("base64");
}

export interface TTSOptions {
  /**
   * 要朗读的文本（必填）。
   * 支持用括号在正文中调整局部语气，如"（开心）今天天气真好！"
   */
  text: string;
  /**
   * 音色调整指令。传空字符串可关闭指令。
   */
  instruction?: string;
  /** 输出 ogg 文件路径，默认 media/mimo_tts_<timestamp>.ogg */
  outputPath?: string;
  /** opus 比特率，默认 32k */
  bitrate?: string;
}

export interface TTSResult {
  success: boolean;
  file: string;
  size: number;
}

async function tts(opts: TTSOptions): Promise<TTSResult> {
  const {
    text,
    instruction,
    outputPath,
    bitrate = "32k",
  } = opts;

  if (!text) throw new Error("[mimo-tts] text 不能为空");

  const sampleVoice = getSampleVoiceBase64();
  const userContent = instruction ? `说话风格：${instruction}，吐字清晰，发聊天语音` : "说话风格：平缓温和，吐字清晰，发聊天语音";
  const outPath = outputPath || `media/mimo_tts_${Date.now()}.ogg`;
  const wavPath = outPath.replace(/\.ogg$/, ".wav");

  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const payload = {
    model: "mimo-v2.5-tts-voiceclone",
    messages: [
      { role: "user", content: userContent },
      { role: "assistant", content: text },
    ],
    audio: { format: "wav", voice: sampleVoice },
  };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as any;
  if (data.error) {
    throw new Error(`[mimo-tts] API error: ${JSON.stringify(data.error)}`);
  }

  const audioB64: string | undefined = data?.choices?.[0]?.message?.audio?.data;
  if (!audioB64) throw new Error("[mimo-tts] 返回数据中无音频");

  const wavBuf = Buffer.from(audioB64, "base64");
  fs.writeFileSync(wavPath, wavBuf);

  try {
    execSync(`ffmpeg -y -nostdin -i "${wavPath}" -c:a libopus -b:a ${bitrate} "${outPath}"`, {
      stdio: "pipe",
    });
  } finally {
    if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
  }

  const stat = fs.statSync(outPath);
  return { success: true, file: outPath, size: stat.size };
}

export default { tts };
