import { NOTES, OPEN_STRING_NOTES } from './constants';

/**
 * Shared audio context for triggering string plucks.
 */
export const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

/**
 * Maps each guitar string to its starting octave for MIDI calculation.
 */
const STRING_BASE_OCTAVES: Record<number, number> = { 
  6: 2, // Low E
  5: 2, // A
  4: 3, // D
  3: 3, // G
  2: 3, // B
  1: 4  // High E
};

/**
 * Simulates a physical string pluck using a synthesized triangle wave.
 * 
 * @param stringNum The string being plucked (1-6)
 * @param fret The fret being held down (0 for open)
 * @param isSoundEnabled Whether the speaker is toggled on
 */
export function triggerPluck(stringNum: number, fret: number, isSoundEnabled: boolean) {
  if (!isSoundEnabled) return;
  if (audioContext.state === 'suspended') audioContext.resume();

  // Calculate MIDI Note Number
  const baseOctave = STRING_BASE_OCTAVES[stringNum];
  const midiNote = (baseOctave + 1) * 12 + NOTES.indexOf(OPEN_STRING_NOTES[stringNum]) + fret;
  
  // Convert MIDI to Frequency (Hz)
  const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

  const oscillator = audioContext.createOscillator();
  const envelope = audioContext.createGain();
  
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  
  // Natural decay envelope
  envelope.gain.setValueAtTime(0.3, audioContext.currentTime);
  envelope.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
  
  oscillator.connect(envelope);
  envelope.connect(audioContext.destination);
  
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.8);
}

/**
 * Returns the musical name of a note at a specific fret on a string.
 */
export function getNoteLabel(stringNum: number, fret: number): string {
  const baseIndex = NOTES.indexOf(OPEN_STRING_NOTES[stringNum]);
  return NOTES[(baseIndex + fret) % 12];
}
