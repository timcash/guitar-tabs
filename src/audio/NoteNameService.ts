import { NOTES, OPEN_STRING_NOTES } from '../constants';

export class NoteNameService {
  public getNoteLabel(stringNum: number, fret: number): string {
    const baseIndex = NOTES.indexOf(OPEN_STRING_NOTES[stringNum]);
    return NOTES[(baseIndex + fret) % 12];
  }
}

export const noteNameService = new NoteNameService();
