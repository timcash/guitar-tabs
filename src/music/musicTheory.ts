export const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const CIRCLE_OF_FIFTHS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'] as const;

export const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11
};

export const SEMITONE_TO_CIRCLE_LABEL = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
export const SEMITONE_TO_DISPLAY_LABEL = [
  'C',
  'C# / Db',
  'D',
  'D# / Eb',
  'E',
  'F',
  'F# / Gb',
  'G',
  'G# / Ab',
  'A',
  'A# / Bb',
  'B'
] as const;

export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function frequencyToMidi(frequencyHz: number) {
  return 69 + 12 * Math.log2(frequencyHz / 440);
}

export function frequencyToPitchClass(frequencyHz: number) {
  const midi = Math.round(frequencyToMidi(frequencyHz));
  return ((midi % 12) + 12) % 12;
}

export function pitchClassToCircleLabel(pitchClass: number) {
  return SEMITONE_TO_CIRCLE_LABEL[((pitchClass % 12) + 12) % 12];
}

export function pitchClassToDisplayLabel(pitchClass: number) {
  return SEMITONE_TO_DISPLAY_LABEL[((pitchClass % 12) + 12) % 12];
}
