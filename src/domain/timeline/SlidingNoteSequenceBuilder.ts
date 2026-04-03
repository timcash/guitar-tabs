import { buildChordTimeline, type ChordSegment } from '../../chordTimeline';
import {
  noteNameService as defaultNoteNameService,
  type NoteNameService
} from '../../audio/NoteNameService';
import type { ChordDefinition, FallingNote, SongScriptItem } from '../../types';

export interface SlidingNoteSequenceBuildResult {
  chordTimeline: ChordSegment[];
  fullNoteSequence: FallingNote[];
  totalSongDurationMs: number;
}

export class SlidingNoteSequenceBuilder {
  private readonly noteNameService: NoteNameService;

  constructor(noteNameService: NoteNameService = defaultNoteNameService) {
    this.noteNameService = noteNameService;
  }

  public build(
    script: SongScriptItem[],
    chordLibrary: Record<string, ChordDefinition>,
    pluckDurationMs: number
  ): SlidingNoteSequenceBuildResult {
    let timeOffset = 0;
    const chordTimeline = buildChordTimeline(script, chordLibrary, pluckDurationMs);

    const fullNoteSequence = script.flatMap((item) => {
      const chord = chordLibrary[item.chord];

      return chord.arpeggioPattern.map((stringNum) => {
        const voicingPos = chord.voicing.find((position) => position.string === stringNum);
        const fret = voicingPos ? voicingPos.fret : 0;

        const note: FallingNote = {
          noteName: this.noteNameService.getNoteLabel(stringNum, fret),
          stringNum,
          fret,
          chordName: item.chord,
          hitTime: timeOffset,
          lyrics: item.lyrics,
          sub: item.sub,
          z_3d: 0,
          opacity: 1
        };

        timeOffset += pluckDurationMs;
        return note;
      });
    });

    return {
      chordTimeline,
      fullNoteSequence,
      totalSongDurationMs: timeOffset
    };
  }
}
