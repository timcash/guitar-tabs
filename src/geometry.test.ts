import { expect, test } from 'vitest';
import { calculateNoteZ, calculateNoteOpacity, calculateTimeUntilHit } from './geometry';

const params = {
  bridgeZ: 10,
  spawnZ: -10,
  lookAheadMs: 2000
};

test('calculateNoteZ at spawn', () => {
  const z = calculateNoteZ(2000, params);
  expect(z).toBeCloseTo(-10);
});

test('calculateNoteZ at bridge', () => {
  const z = calculateNoteZ(0, params);
  expect(z).toBe(10);
});

test('calculateNoteZ halfway', () => {
  const z = calculateNoteZ(1000, params);
  expect(z).toBeCloseTo(0);
});

test('calculateNoteOpacity fade in', () => {
  // At spawn (2000ms until hit), should be 0
  expect(calculateNoteOpacity(2000, params, 500)).toBe(0);
  // Halfway through fade (1750ms until hit), should be 0.5
  expect(calculateNoteOpacity(1750, params, 500)).toBe(0.5);
  // Fully visible (1500ms until hit), should be 1
  expect(calculateNoteOpacity(1500, params, 500)).toBe(1);
});

test('calculateTimeUntilHit normal', () => {
  expect(calculateTimeUntilHit(2000, 1000, 5000)).toBe(1000);
});

test('calculateTimeUntilHit wrap around', () => {
  // hitTime is 500, loopTime is 4000 (past hitTime in current loop)
  // totalDuration is 5000
  // Result should be (5000 - 4000) + 500 = 1500
  expect(calculateTimeUntilHit(500, 4000, 5000)).toBe(1500);
});
