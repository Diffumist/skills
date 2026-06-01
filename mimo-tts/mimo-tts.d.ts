/**
 * mimoTts — 基于 xiaomimimo 平台的文字转语音 Skill（voiceclone 模式）
 *
 * 环境变量：
 * - MIMO_TTS_API_KEY: 必填，token-plan-cn 的 API Key
 *
 * 固定使用 mimo-v2.5-tts-voiceclone 模型 + 内置 sample.mp3 音源。
 * 发送到 OneBot(QQ) 时候type 为 audio，发送到 Telegram 用 type: 'voice'
 */

/** TTS 调用参数 */
interface TTSOptions {
  /**
   * 要朗读的文本（必填）。
   * 支持用括号在正文中调整局部语气，例如：
   * "（开心）今天天气真好！……（叹气）不过作业还没写完。"
   */
  text: string;
  /**
   * 总体情绪风格指令（可选）。
   * 用于概括整段话的基调，如"慵懒冷静""温柔俏皮""严肃"等。
   * 传空字符串可关闭指令。
   *
   * 局部语气调整请直接在 text 中用括号标注，如：
   * "（慵懒）嗯……（开心）不过今天天气不错！"
   * 支持的括号语气词：开心、慵懒、小声、叹气、生气等。
   */
  instruction?: string;
  /** 输出 ogg 文件路径，默认 media/mimo_tts_<timestamp>.ogg */
  outputPath?: string;
  /** opus 比特率，默认 "32k" */
  bitrate?: string;
}

/** TTS 调用结果 */
interface TTSResult {
  success: boolean;
  file: string;
  size: number;
}

/** MiMo TTS — 文字转语音 Skill（voiceclone 模式） */
declare const mimoTts: {
  /**
   * 将文本转换为语音，返回本地 ogg 文件路径。
   * 固定使用 voiceclone 模式，音源为内置 sample.mp3。
   *
   * @example 基本用法
   * const result = await mimoTts.tts({ text: "也没什么啦，就摸了会儿鱼……" });
   * await telegram.sendMedia(chatId, { type: 'voice', file: result.file });
   *
   * @example instruction概括总体情绪，括号调整局部语气
   * const result = await mimoTts.tts({
   *   text: "（打哈欠）嗯……刚醒。（开心）不过今天天气不错呀！",
   *   instruction: "期待"
   * });
   * await telegram.sendMedia(chatId, { type: 'voice', file: result.file });
   */
  tts(opts: TTSOptions): Promise<TTSResult>;
};
