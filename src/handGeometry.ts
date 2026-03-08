export type RightHandFinger = 'p' | 'i' | 'm' | 'a';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface HandLayoutParams {
  stringSpacing: number;
  bridgeZ: number;
  palmY: number;
  palmZ: number;
  fingerHoverY: number;
  fingerBaseZ: number;
  thumbBaseZ: number;
  pluckDepth: number;
}

export interface FingerPose extends Vec3 {
  curl: number;
  glow: number;
}

export interface FingerAnticipation {
  intensity: number;
  yLift: number;
  zShift: number;
}

export const DEFAULT_HAND_LAYOUT: HandLayoutParams = {
  stringSpacing: 2,
  bridgeZ: 8,
  palmY: 1.2,
  palmZ: 9.2,
  fingerHoverY: 0.55,
  fingerBaseZ: 8.45,
  thumbBaseZ: 8.95,
  pluckDepth: 0.7
};

const FINGER_HOME_STRING: Record<RightHandFinger, number> = {
  p: 4,
  i: 3,
  m: 2,
  a: 1
};

export function getStringX(stringNum: number, stringSpacing: number, isFlippedX: boolean): number {
  const base = stringNum - 3.5;
  return (isFlippedX ? -base : base) * stringSpacing;
}

export function getPluckingFingerForString(stringNum: number): RightHandFinger {
  if (stringNum >= 4 && stringNum <= 6) return 'p';
  if (stringNum === 3) return 'i';
  if (stringNum === 2) return 'm';
  return 'a';
}

export function getFingerTargetString(finger: RightHandFinger, activeString: number | null): number {
  if (finger === 'p' && activeString !== null && activeString >= 4 && activeString <= 6) {
    return activeString;
  }
  return FINGER_HOME_STRING[finger];
}

export function getFingerRestPose(
  finger: RightHandFinger,
  activeString: number | null,
  isFlippedX: boolean,
  layout: HandLayoutParams = DEFAULT_HAND_LAYOUT
): FingerPose {
  const targetString = getFingerTargetString(finger, activeString);
  const x = getStringX(targetString, layout.stringSpacing, isFlippedX);
  const z = finger === 'p' ? layout.thumbBaseZ : layout.fingerBaseZ;

  return {
    x,
    y: layout.fingerHoverY,
    z,
    curl: 0,
    glow: 0
  };
}

export function samplePluckAnimation(
  elapsedMs: number,
  totalDurationMs: number = 180
): { curl: number; yOffset: number; zOffset: number; glow: number } {
  if (elapsedMs <= 0 || elapsedMs >= totalDurationMs) {
    return { curl: 0, yOffset: 0, zOffset: 0, glow: 0 };
  }

  const attackMs = totalDurationMs * 0.25;
  if (elapsedMs <= attackMs) {
    const t = elapsedMs / attackMs;
    const eased = 1 - Math.pow(1 - t, 3);
    return {
      curl: eased,
      yOffset: -0.18 * eased,
      zOffset: -0.35 * eased,
      glow: 0.35 + 0.65 * eased
    };
  }

  const t = (elapsedMs - attackMs) / (totalDurationMs - attackMs);
  const eased = 1 - Math.pow(t, 2);
  return {
    curl: eased,
    yOffset: -0.18 * eased,
    zOffset: -0.35 * eased,
    glow: 0.35 * eased
  };
}

export function getAnimatedFingerPose(
  finger: RightHandFinger,
  activeString: number | null,
  isFlippedX: boolean,
  elapsedSincePluckMs: number | null,
  layout: HandLayoutParams = DEFAULT_HAND_LAYOUT
): FingerPose {
  const rest = getFingerRestPose(finger, activeString, isFlippedX, layout);
  if (elapsedSincePluckMs === null) return rest;

  const motion = samplePluckAnimation(elapsedSincePluckMs);
  return {
    x: rest.x,
    y: rest.y + motion.yOffset,
    z: rest.z + motion.zOffset,
    curl: motion.curl,
    glow: motion.glow
  };
}

export function getPrePluckAnticipation(
  finger: RightHandFinger,
  upcomingString: number | null,
  timeUntilPluckMs: number | null,
  anticipationWindowMs: number = 220
): FingerAnticipation {
  if (upcomingString === null || timeUntilPluckMs === null || timeUntilPluckMs < 0 || timeUntilPluckMs > anticipationWindowMs) {
    return { intensity: 0, yLift: 0, zShift: 0 };
  }

  if (getPluckingFingerForString(upcomingString) !== finger) {
    return { intensity: 0, yLift: 0, zShift: 0 };
  }

  const t = 1 - timeUntilPluckMs / anticipationWindowMs;
  const eased = Math.max(0, Math.min(1, t * t * (3 - 2 * t)));
  return {
    intensity: eased,
    yLift: -0.06 * eased,
    zShift: -0.08 * eased
  };
}
