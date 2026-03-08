import { expect, test } from 'vitest';
import { CAMERA_VIEWS, allPointsWithinMargin, getFramingTestPoints, measureProjectedBounds } from './viewFraming';

const DESKTOP_ASPECT = 16 / 9;
const TABLET_ASPECT = 4 / 3;

test('key scene anchors stay in view with a safety margin for desktop and tablet aspects', () => {
  const points = getFramingTestPoints();
  const allAnchors = [
    ...points.fretboard,
    ...points.chordDisplay,
    ...points.leftHandNoteLabels,
    ...points.rightHandZone
  ];

  for (const view of CAMERA_VIEWS) {
    expect(allPointsWithinMargin(allAnchors, view, DESKTOP_ASPECT, 0.04)).toBe(true);
    expect(allPointsWithinMargin(allAnchors, view, TABLET_ASPECT, 0.03)).toBe(true);
  }
});

test('classic view leaves measurable bottom margin under the fretboard', () => {
  const bounds = measureProjectedBounds(getFramingTestPoints().fretboard, CAMERA_VIEWS[0], DESKTOP_ASPECT);

  expect(bounds.marginBottom).toBeGreaterThan(0.12);
  expect(bounds.marginTop).toBeGreaterThan(0.08);
});

test('player and cinematic views keep chord labels away from screen edges', () => {
  const chordPoints = getFramingTestPoints().chordDisplay;

  for (const viewName of ['Player', 'Cinematic']) {
    const view = CAMERA_VIEWS.find((candidate) => candidate.name === viewName)!;
    const bounds = measureProjectedBounds(chordPoints, view, DESKTOP_ASPECT);
    expect(bounds.marginLeft).toBeGreaterThan(0.05);
    expect(bounds.marginRight).toBeGreaterThan(0.05);
    expect(bounds.marginTop).toBeGreaterThan(0.04);
  }
});

test('birdseye view still contains the full fretboard span', () => {
  const points = getFramingTestPoints().fretboard;
  const bounds = measureProjectedBounds(points, CAMERA_VIEWS.find((view) => view.name === 'Birdseye')!, DESKTOP_ASPECT);

  expect(bounds.minX).toBeGreaterThan(-0.9);
  expect(bounds.maxX).toBeLessThan(0.9);
  expect(bounds.minY).toBeGreaterThan(-0.95);
  expect(bounds.maxY).toBeLessThan(0.95);
});
