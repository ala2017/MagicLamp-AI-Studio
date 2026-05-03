
// --- 本地语音服务 ---

export const stripMarkdown = (text: string) => {
  return text
    .replace(/[#*`~_]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/>/g, '')
    .replace(/\n+/g, ' ')
    .trim();
};

class LocalVoiceManager {
  private static instance: LocalVoiceManager;
  private synth = window.speechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private _isSpeaking = false;

  private constructor() {}

  static getInstance(): LocalVoiceManager {
    if (!LocalVoiceManager.instance) {
      LocalVoiceManager.instance = new LocalVoiceManager();
    }
    return LocalVoiceManager.instance;
  }

  get isSpeaking() {
    // 实时同步浏览器的朗读状态
    return this.synth.speaking;
  }

  stop() {
    this.synth.cancel();
    this._isSpeaking = false;
  }

  async play(text: string) {
    this.stop(); // 播放前先清空之前的队列

    const cleanText = stripMarkdown(text);
    if (!cleanText) return;

    // 创建语意对象
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // 尝试寻找更优质的中文语音包
    const voices = this.synth.getVoices();
    const chineseVoice = voices.find(v => v.lang.includes('zh-CN') || v.lang.includes('zh_CN'));
    if (chineseVoice) {
      utterance.voice = chineseVoice;
    }

    utterance.rate = 1.1; // 稍微加快语速，听感更干练
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => { this._isSpeaking = true; };
    utterance.onend = () => { this._isSpeaking = false; };
    utterance.onerror = () => { this._isSpeaking = false; };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }
}

export const voiceManager = LocalVoiceManager.getInstance();

export const speakText = (text: string) => {
  return voiceManager.play(text);
};

export const stopSpeaking = () => {
  voiceManager.stop();
};

// 录音逻辑保持不变，因为这仍然需要发给 AI 理解意图
export function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  async start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(stream);
    this.chunks = [];
    this.mediaRecorder.ondataavailable = (e) => this.chunks.push(e.data);
    this.mediaRecorder.start();
  }

  async stop(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) return resolve("");
      this.mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.chunks, { type: 'audio/webm' });
          const arrayBuffer = await blob.arrayBuffer();
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
          const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          
          const length = decodedBuffer.length;
          const data = decodedBuffer.getChannelData(0);
          const int16 = new Int16Array(length);
          for (let i = 0; i < length; i++) {
            int16[i] = data[i] * 32768;
          }
          resolve(encode(new Uint8Array(int16.buffer)));
        } catch (err) {
          reject(err);
        }
      };
      this.mediaRecorder.stop();
    });
  }
}
