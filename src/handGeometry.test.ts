import { expect, test } from 'vitest';
import {
  DEFAULT_HAND_LAYOUT,
  getAnimatedFingerPose,
  getFingerRestPose,
  getFingerTargetString,
  getPrePluckAnticipation,
  getPluckingFingerForString,
  getStringX,
  samplePluckAnimation
} from './handGeometry';

test('maps strings to standard p-i-m-a fingers', () => {
  expect(getPluckingFingerForString(6)).toBe('p');
  expect(getPluckingFingerForString(4)).toBe('p');
  expect(getPluckingFingerForString(3)).toBe('i');
  expect(getPluckingFingerForString(2)).toBe('m');
  expect(getPluckingFingerForString(1)).toBe('a');
});

test('mirrors string x coordinates when flipped', () => {
  expect(getStringX(1, 2, false)).toBeCloseTo(-5);
  expect(getStringX(6, 2, false)).toBeCloseTo(5);
  expect(getStringX(1, 2, true)).toBeCloseTo(5);
  expect(getStringX(6, 2, true)).toBeCloseTo(-5);
});

test('thumb tracks the active bass string while other fingers stay anchored', () => {
  expect(getFingerTargetString('p', 6)).toBe(6);
  expect(getFingerTargetString('p', 5)).toBe(5);
  expect(getFingerTargetString('p', 4)).toBe(4);
  expect(getFingerTargetString('p', 2)).toBe(4);
  expect(getFingerTargetString('i', 1)).toBe(3);
  expect(getFingerTargetString('m', 6)).toBe(2);
  expect(getFingerTargetString('a', null)).toBe(1);
});

test('rest poses hover above the assigned strings near the bridge', () => {
  const thumb = getFingerRestPose('p', 6, false);
  const index = getFingerRestPose('i', 6, false);

  expect(thumb.x).toBeCloseTo(getStringX(6, DEFAULT_HAND_LAYOUT.stringSpacing, false));
  expect(index.x).toBeCloseTo(getStringX(3, DEFAULT_HAND_LAYOUT.stringSpacing, false));
  expect(thumb.y).toBeCloseTo(DEFAULT_HAND_LAYOUT.fingerHoverY);
  expect(index.z).toBeCloseTo(DEFAULT_HAND_LAYOUT.fingerBaseZ);
  expect(thumb.z).toBeGreaterThan(index.z);
});

test('pluck animation peaks early and decays back to rest', () => {
  const start = samplePluckAnimation(0);
  const attack = samplePluckAnimation(45);
  const release = samplePluckAnimation(120);
  const end = samplePluckAnimation(180);

  expect(start.curl).toBe(0);
  expect(attack.curl).toBeCloseTo(1, 3);
  expect(attack.zOffset).toBeLessThan(0);
  expect(release.curl).toBeLessThan(attack.curl);
  expect(end.curl).toBe(0);
});

test('animated finger pose returns to rest after the pluck window', () => {
  const rest = getFingerRestPose('m', 2, true);
  const moving = getAnimatedFingerPose('m', 2, true, 30);
  const settled = getAnimatedFingerPose('m', 2, true, 220);

  expect(moving.y).toBeLessThan(rest.y);
  expect(moving.z).toBeLessThan(rest.z);
  expect(moving.glow).toBeGreaterThan(0);
  expect(settled).toEqual(rest);
});

test('pre-pluck anticipation only affects the finger assigned to the upcoming string', () => {
  const thumbPrep = getPrePluckAnticipation('p', 5, 60);
  const indexPrep = getPrePluckAnticipation('i', 5, 60);
  const expiredPrep = getPrePluckAnticipation('p', 5, 300);

  expect(thumbPrep.intensity).toBeGreaterThan(0);
  expect(thumbPrep.yLift).toBeLessThan(0);
  expect(indexPrep.intensity).toBe(0);
  expect(expiredPrep.intensity).toBe(0);
});
