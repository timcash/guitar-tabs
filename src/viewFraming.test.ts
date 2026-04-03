import { expect, test } from 'vitest';
import { CAMERA_VIEWS, allPointsWithinMargin, getFramingTestPoints, measureProjectedBounds } from './viewFraming';

const DESKTOP_ASPECT = 16 / 9;
const TABLET_ASPECT = 4 / 3;
const PORTRAIT_ASPECT = 9 / 16;

test('classic, birdseye, and cinematic views keep key scene anchors in frame for desktop and tablet aspects', () => {
  const points = getFramingTestPoints();
  const allAnchors = [
    ...points.fretboard,
    ...points.chordDisplay,
    ...points.leftHandNoteLabels,
    ...points.rightHandZone
  ];

  for (const view of CAMERA_VIEWS.filter((candidate) => candidate.name !== 'Player')) {
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

test('player view keeps the sampled string-track and pluck-zone in frame across aspect ratios', () => {
  const playerView = CAMERA_VIEWS.find((view) => view.name === 'Player')!;
  const playerFocus = getFramingTestPoints().playerFocus;

  expect(allPointsWithinMargin(playerFocus, playerView, DESKTOP_ASPECT, 0.05)).toBe(true);
  expect(allPointsWithinMargin(playerFocus, playerView, TABLET_ASPECT, 0.05)).toBe(true);
  expect(allPointsWithinMargin(playerFocus, playerView, PORTRAIT_ASPECT, 0.03)).toBe(true);
});

test('player view uses more of the viewport for the sampled string-track', () => {
  const playerView = CAMERA_VIEWS.find((view) => view.name === 'Player')!;
  const stringTrack = getFramingTestPoints().stringTrack;
  const bounds = measureProjectedBounds(stringTrack, playerView, DESKTOP_ASPECT);

  expect(bounds.marginLeft).toBeGreaterThan(0.2);
  expect(bounds.marginRight).toBeGreaterThan(0.2);
  expect(bounds.marginBottom).toBeGreaterThan(0.04);
  expect(bounds.maxX - bounds.minX).toBeGreaterThan(1.2);
  expect(bounds.maxY - bounds.minY).toBeGreaterThan(0.85);
});

test('birdseye view still contains the full fretboard span', () => {
  const points = getFramingTestPoints().fretboard;
  const bounds = measureProjectedBounds(points, CAMERA_VIEWS.find((view) => view.name === 'Birdseye')!, DESKTOP_ASPECT);

  expect(bounds.minX).toBeGreaterThan(-0.9);
  expect(bounds.maxX).toBeLessThan(0.9);
  expect(bounds.minY).toBeGreaterThan(-0.95);
  expect(bounds.maxY).toBeLessThan(0.95);
});
