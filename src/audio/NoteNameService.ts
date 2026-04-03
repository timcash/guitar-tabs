import { NOTES, OPEN_STRING_NOTES } from '../constants';

const STRING_BASE_OCTAVES: Record<number, number> = {
  6: 2,
  5: 2,
  4: 3,
  3: 3,
  2: 3,
  1: 4
};

export class NoteNameService {
  private readonly openStringNoteIndices = new Map<number, number>();
  private readonly frequencyCache = new Map<string, number>();

  constructor() {
    for (const [stringNum, noteName] of Object.entries(OPEN_STRING_NOTES)) {
      this.openStringNoteIndices.set(Number(stringNum), NOTES.indexOf(noteName));
    }
  }

  public getNoteLabel(stringNum: number, fret: number): string {
    return NOTES[this.getNoteIndex(stringNum, fret)];
  }

  public getNoteIndex(stringNum: number, fret: number): number {
    const baseIndex = this.openStringNoteIndices.get(stringNum) ?? 0;
    return (baseIndex + fret) % NOTES.length;
  }

  public getFrequency(stringNum: number, fret: number): number {
    const cacheKey = `${stringNum}:${fret}`;
    const cachedFrequency = this.frequencyCache.get(cacheKey);
    if (cachedFrequency !== undefined) {
      return cachedFrequency;
    }

    const midiNote = this.getMidiNote(stringNum, fret);
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
    this.frequencyCache.set(cacheKey, frequency);
    return frequency;
  }

  private getMidiNote(stringNum: number, fret: number): number {
    const baseOctave = STRING_BASE_OCTAVES[stringNum] ?? 4;
    return (baseOctave + 1) * 12 + this.getNoteIndex(stringNum, fret);
  }
}

export const noteNameService = new NoteNameService();
