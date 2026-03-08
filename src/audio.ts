import { NOTES, OPEN_STRING_NOTES } from './constants';

export const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

export function playNote(sN: number, f: number, isSoundOn: boolean) {
  if (!isSoundOn) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const stringOctaves: Record<number, number> = { 6: 2, 5: 2, 4: 3, 3: 3, 2: 3, 1: 4 };
  const octave = stringOctaves[sN];
  const n = (octave + 1) * 12 + NOTES.indexOf(OPEN_STRING_NOTES[sN]) + f;
  const freq = 440 * Math.pow(2, (n - 69) / 12);

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.8);
}

export function getNoteName(sN: number, f: number) {
  return NOTES[(NOTES.indexOf(OPEN_STRING_NOTES[sN]) + f) % 12];
}
