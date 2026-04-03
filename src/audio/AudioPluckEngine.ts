import { noteNameService } from './NoteNameService';

const STRING_OUTPUT_LEVELS: Record<number, number> = {
  6: 0.95,
  5: 0.92,
  4: 0.9,
  3: 0.88,
  2: 0.84,
  1: 0.8
};
const PLUCK_ATTACK_SECONDS = 0.008;
const PLUCK_DECAY_SECONDS = 0.78;
const PLUCK_PEAK_GAIN = 0.3;
const PLUCK_FLOOR_GAIN = 0.0001;
const PLUCK_STOP_TAIL_SECONDS = 0.04;

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
    const now = this.audioContext.currentTime;
    const attackEnd = now + PLUCK_ATTACK_SECONDS;
    const decayEnd = attackEnd + PLUCK_DECAY_SECONDS;

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(noteNameService.getFrequency(stringNum, fret), now);

    envelope.gain.cancelScheduledValues(now);
    envelope.gain.setValueAtTime(PLUCK_FLOOR_GAIN, now);
    envelope.gain.linearRampToValueAtTime(PLUCK_PEAK_GAIN, attackEnd);
    envelope.gain.exponentialRampToValueAtTime(PLUCK_FLOOR_GAIN, decayEnd);

    oscillator.connect(envelope);
    envelope.connect(voiceGain);

    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };

    oscillator.start(now);
    oscillator.stop(decayEnd + PLUCK_STOP_TAIL_SECONDS);
  }
}

export const audioPluckEngine = new AudioPluckEngine();
