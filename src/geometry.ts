/**
 * Pure functions for calculating 3D guitar track geometry.
 */

export interface GeometryParams {
  bridgeZ: number;
  spawnZ: number;
  lookAheadMs: number;
}

/**
 * Calculates the Z-coordinate for a note based on how much time is left until it hits the bridge.
 */
export function calculateNoteZ(timeUntilHitMs: number, params: GeometryParams): number {
  const travelDistance = params.bridgeZ - params.spawnZ;
  const speed = travelDistance / params.lookAheadMs;
  return params.bridgeZ - (timeUntilHitMs * speed);
}

/**
 * Calculates the opacity for a note, adding a fade-in effect when it first spawns.
 */
export function calculateNoteOpacity(timeUntilHitMs: number, params: GeometryParams, fadeDurationMs: number = 500): number {
  const normalizedTime = (params.lookAheadMs - timeUntilHitMs) / fadeDurationMs;
  return Math.max(0, Math.min(1, normalizedTime));
}

/**
 * Helper to calculate time until hit, handling the looping wrap-around.
 */
export function calculateTimeUntilHit(hitTimeMs: number, loopTimeMs: number, totalDurationMs: number): number {
  let timeUntilHit = hitTimeMs - loopTimeMs;
  if (timeUntilHit < 0) {
    timeUntilHit += totalDurationMs;
  }
  return timeUntilHit;
}
