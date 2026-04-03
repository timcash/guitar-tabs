import { audioPluckEngine } from './audio/AudioPluckEngine';
import { noteNameService } from './audio/NoteNameService';

export { AudioPluckEngine, audioPluckEngine } from './audio/AudioPluckEngine';
export { NoteNameService, noteNameService } from './audio/NoteNameService';

export const audioContext = audioPluckEngine.audioContext;

export function triggerPluck(stringNum: number, fret: number, isSoundEnabled: boolean) {
  audioPluckEngine.triggerPluck(stringNum, fret, isSoundEnabled);
}

export function getNoteLabel(stringNum: number, fret: number): string {
  return noteNameService.getNoteLabel(stringNum, fret);
}
