import { expect, test } from 'vitest';
import { buildChordTimeline, getChordSegmentIndexAtTime, getChordSegmentProgress } from './chordTimeline';
import { chordLibrary, wellermanScript } from './data';

test('buildChordTimeline creates continuous segments from the script', () => {
  const segments = buildChordTimeline(wellermanScript.slice(0, 3), chordLibrary, 100);

  expect(segments).toEqual([
    { chordName: 'Am', startTime: 0, endTime: 600 },
    { chordName: 'Am', startTime: 600, endTime: 1200 },
    { chordName: 'Dm', startTime: 1200, endTime: 1800 }
  ]);
});

test('getChordSegmentIndexAtTime finds the active segment', () => {
  const segments = buildChordTimeline(wellermanScript.slice(0, 3), chordLibrary, 100);

  expect(getChordSegmentIndexAtTime(segments, 0)).toBe(0);
  expect(getChordSegmentIndexAtTime(segments, 599)).toBe(0);
  expect(getChordSegmentIndexAtTime(segments, 600)).toBe(1);
  expect(getChordSegmentIndexAtTime(segments, 1799)).toBe(2);
});

test('getChordSegmentProgress returns normalized progress within a segment', () => {
  const segments = buildChordTimeline(wellermanScript.slice(0, 1), chordLibrary, 100);

  expect(getChordSegmentProgress(segments[0], 0)).toBe(0);
  expect(getChordSegmentProgress(segments[0], 300)).toBe(0.5);
  expect(getChordSegmentProgress(segments[0], 600)).toBe(1);
});
