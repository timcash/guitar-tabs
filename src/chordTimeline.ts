import type { ChordDefinition, SongScriptItem } from './types';

export interface ChordSegment {
  chordName: string;
  startTime: number;
  endTime: number;
}

export function buildChordTimeline(
  script: SongScriptItem[],
  chordLibrary: Record<string, ChordDefinition>,
  pluckDurationMs: number
): ChordSegment[] {
  let timeOffset = 0;

  return script.map((item) => {
    const chord = chordLibrary[item.chord];
    const duration = chord.arpeggioPattern.length * pluckDurationMs;
    const segment = {
      chordName: item.chord,
      startTime: timeOffset,
      endTime: timeOffset + duration
    };
    timeOffset += duration;
    return segment;
  });
}

export function getChordSegmentIndexAtTime(segments: ChordSegment[], loopTimeMs: number): number {
  const index = segments.findIndex((segment) => loopTimeMs >= segment.startTime && loopTimeMs < segment.endTime);
  return index === -1 ? Math.max(segments.length - 1, 0) : index;
}

export function getChordSegmentProgress(segment: ChordSegment, loopTimeMs: number): number {
  const duration = Math.max(segment.endTime - segment.startTime, 1);
  return Math.max(0, Math.min(1, (loopTimeMs - segment.startTime) / duration));
}
