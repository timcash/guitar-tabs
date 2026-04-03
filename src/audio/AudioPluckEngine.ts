import { noteNameService } from './NoteNameService';

const STRING_OUTPUT_LEVELS: Record<number, number> = {
  6: 0.95,
  5: 0.92,
  4: 0.9,
  3: 0.88,
  2: 0.84,
  1: 0.8
};

export class AudioPluckEngine {
  public readonly audioContext = new (window.AudioContext ||
    (window as Window & typeof globalThis & { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext)();
  private readonly pluckMixGain = this.audioContext.createGain();
  private readonly stringVoiceGains = new Map<number, GainNode>();

  constructor() {
    this.pluckMixGain.gain.value = 0.72;
    this.pluckMixGain.connect(this.audioContext.destination);

    for (const [stringNum, level] of Object.entries(STRING_OUTPUT_LEVELS)) {
      const voiceGain = this.audioContext.createGain();
      voiceGain.gain.value = level;
      voiceGain.connect(this.pluckMixGain);
      this.stringVoiceGains.set(Number(stringNum), voiceGain);
    }
  }

  public resume() {
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
  }

  public triggerPluck(stringNum: number, fret: number, isSoundEnabled: boolean) {
    if (!isSoundEnabled) return;

    this.resume();

    const oscillator = this.audioContext.createOscillator();
    const envelope = this.audioContext.createGain();
    const voiceGain = this.stringVoiceGains.get(stringNum) ?? this.pluckMixGain;

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(noteNameService.getFrequency(stringNum, fret), this.audioContext.currentTime);

    envelope.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.8);

    oscillator.connect(envelope);
    envelope.connect(voiceGain);

    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };

    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.8);
  }
}

export const audioPluckEngine = new AudioPluckEngine();
