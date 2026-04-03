import { NOTES, OPEN_STRING_NOTES } from '../constants';

const STRING_BASE_OCTAVES: Record<number, number> = {
  6: 2,
  5: 2,
  4: 3,
  3: 3,
  2: 3,
  1: 4
};

export class AudioPluckEngine {
  public readonly audioContext = new (window.AudioContext ||
    (window as Window & typeof globalThis & { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext)();

  public resume() {
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
  }

  public triggerPluck(stringNum: number, fret: number, isSoundEnabled: boolean) {
    if (!isSoundEnabled) return;

    this.resume();

    const baseOctave = STRING_BASE_OCTAVES[stringNum];
    const midiNote = (baseOctave + 1) * 12 + NOTES.indexOf(OPEN_STRING_NOTES[stringNum]) + fret;
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

    const oscillator = this.audioContext.createOscillator();
    const envelope = this.audioContext.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

    envelope.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.8);

    oscillator.connect(envelope);
    envelope.connect(this.audioContext.destination);

    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.8);
  }
}

export const audioPluckEngine = new AudioPluckEngine();
