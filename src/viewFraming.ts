import * as THREE from 'three';

export interface CameraViewSpec {
  name: string;
  pos: [number, number, number];
  look: [number, number, number];
}

export interface ProjectedPoint {
  x: number;
  y: number;
  z: number;
}

export interface ProjectedBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  marginLeft: number;
  marginRight: number;
  marginBottom: number;
  marginTop: number;
}

export interface FramingReportRow {
  view: string;
  aspect: string;
  target: string;
  marginLeft: number;
  marginRight: number;
  marginBottom: number;
  marginTop: number;
}

export const CAMERA_FOV_DEGREES = 75;
export const CAMERA_VIEWS: CameraViewSpec[] = [
  { name: 'Classic', pos: [0, 13, 20], look: [0, 0.2, -2] },
  { name: 'Player', pos: [1.2, 4.6, 14], look: [-0.8, 0.7, -10.2] },
  { name: 'Birdseye', pos: [0, 28, 0], look: [0, 0, -1] },
  { name: 'Cinematic', pos: [17, 9, 12], look: [-4, 0.4, -5] }
];

export const SCENE_LAYOUT = {
  stringSpacing: 2,
  nutZ: -16,
  fretWidth: 1.8,
  bridgeZ: 8,
  boardWidth: 11
};
const PLAYER_VIEW_NAME = 'Player';
const STRING_TRACK_SAMPLE_STEPS = 18;

export function getStringX(stringNum: number, isFlippedX: boolean = false): number {
  const base = stringNum - 3.5;
  return (isFlippedX ? -base : base) * SCENE_LAYOUT.stringSpacing;
}

export function getFretZ(fret: number): number {
  if (fret === 0) return SCENE_LAYOUT.nutZ - 0.5;
  return SCENE_LAYOUT.nutZ + (fret - 0.5) * SCENE_LAYOUT.fretWidth;
}

function createCameraFromPose(view: CameraViewSpec, aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEGREES, aspect, 0.1, 1000);
  camera.position.set(...view.pos);
  camera.lookAt(...view.look);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}

function projectPointWithCamera(point: THREE.Vector3, camera: THREE.PerspectiveCamera): ProjectedPoint {
  const projected = point.clone().project(camera);
  return { x: projected.x, y: projected.y, z: projected.z };
}

function measureProjectedBoundsWithCamera(points: THREE.Vector3[], camera: THREE.PerspectiveCamera): ProjectedBounds {
  const projected = points.map((point) => projectPointWithCamera(point, camera));
  const minX = Math.min(...projected.map((point) => point.x));
  const maxX = Math.max(...projected.map((point) => point.x));
  const minY = Math.min(...projected.map((point) => point.y));
  const maxY = Math.max(...projected.map((point) => point.y));

  return {
    minX,
    maxX,
    minY,
    maxY,
    marginLeft: minX + 1,
    marginRight: 1 - maxX,
    marginBottom: minY + 1,
    marginTop: 1 - maxY
  };
}

function allPointsWithinMarginWithCamera(points: THREE.Vector3[], camera: THREE.PerspectiveCamera, margin: number): boolean {
  return points.every((point) => {
    const projected = projectPointWithCamera(point, camera);
    return projected.x >= -1 + margin &&
      projected.x <= 1 - margin &&
      projected.y >= -1 + margin &&
      projected.y <= 1 - margin &&
      projected.z >= -1 &&
      projected.z <= 1;
  });
}

function getPlayerViewportMargin(aspect: number) {
  if (aspect < 0.75) return 0.03;
  if (aspect < 1.5) return 0.05;
  return 0.05;
}

function createStringTrackPoints() {
  const points: THREE.Vector3[] = [];

  for (let stringNum = 1; stringNum <= 6; stringNum += 1) {
    const x = getStringX(stringNum);
    for (let step = 0; step <= STRING_TRACK_SAMPLE_STEPS; step += 1) {
      const t = step / STRING_TRACK_SAMPLE_STEPS;
      const z = SCENE_LAYOUT.nutZ + (SCENE_LAYOUT.bridgeZ - SCENE_LAYOUT.nutZ) * t;
      points.push(new THREE.Vector3(x, 0, z));
    }
  }

  return points;
}

export function allPointsWithinMargin(points: THREE.Vector3[], view: CameraViewSpec, aspect: number, margin: number): boolean {
  const camera = createCamera(view, aspect);
  return allPointsWithinMarginWithCamera(points, camera, margin);
}

function buildFramingTestPoints(): Record<string, THREE.Vector3[]> {
  const halfBoard = SCENE_LAYOUT.boardWidth / 2;
  const nutZ = SCENE_LAYOUT.nutZ;
  const bridgeZ = SCENE_LAYOUT.bridgeZ;
  const stringTrack = createStringTrackPoints();
  const leftHandNoteLabels = [
    new THREE.Vector3(getStringX(5), 1.18, getFretZ(3)),
    new THREE.Vector3(getStringX(4), 1.18, getFretZ(2)),
    new THREE.Vector3(getStringX(2), 1.18, getFretZ(1)),
    new THREE.Vector3(getStringX(1), 1.18, getFretZ(0))
  ];
  const rightHandZone = [
    new THREE.Vector3(getStringX(6), 0, bridgeZ),
    new THREE.Vector3(getStringX(1), 0, bridgeZ),
    new THREE.Vector3(getStringX(5), 1.3, 8.8)
  ];

  return {
    fretboard: [
      new THREE.Vector3(-halfBoard, 0, nutZ),
      new THREE.Vector3(halfBoard, 0, nutZ),
      new THREE.Vector3(-halfBoard, 0, bridgeZ),
      new THREE.Vector3(halfBoard, 0, bridgeZ)
    ],
    stringTrack,
    chordDisplay: [
      new THREE.Vector3(-4.9, 4.15, -15.1),
      new THREE.Vector3(4.9, 4.15, -15.1),
      new THREE.Vector3(-2.5, 3.6, -14.45),
      new THREE.Vector3(7.2, 3.6, -14.7)
    ],
    leftHandNoteLabels,
    rightHandZone,
    playerFocus: [...stringTrack, ...leftHandNoteLabels, ...rightHandZone]
  };
}

const FRAMING_TEST_POINTS = buildFramingTestPoints();

function fitCameraDistanceToPoints(
  view: CameraViewSpec,
  aspect: number,
  points: THREE.Vector3[],
  margin: number
): CameraViewSpec {
  const look = new THREE.Vector3(...view.look);
  const pos = new THREE.Vector3(...view.pos);
  const direction = pos.clone().sub(look);
  const baseDistance = direction.length();
  if (baseDistance === 0) return view;

  const unitDirection = direction.normalize();
  let minDistance = Math.max(4, baseDistance * 0.45);
  let maxDistance = baseDistance * 2.8;

  const buildCandidate = (distance: number): CameraViewSpec => {
    const fittedPos = look.clone().add(unitDirection.clone().multiplyScalar(distance));
    return {
      name: view.name,
      pos: [fittedPos.x, fittedPos.y, fittedPos.z],
      look: view.look
    };
  };

  const fits = (distance: number) => {
    const camera = createCameraFromPose(buildCandidate(distance), aspect);
    return allPointsWithinMarginWithCamera(points, camera, margin);
  };

  while (!fits(maxDistance) && maxDistance < baseDistance * 8) {
    maxDistance *= 1.35;
  }

  if (!fits(maxDistance)) {
    return view;
  }

  let bestDistance = maxDistance;
  for (let iteration = 0; iteration < 28; iteration += 1) {
    const midDistance = (minDistance + maxDistance) / 2;
    if (fits(midDistance)) {
      bestDistance = midDistance;
      maxDistance = midDistance;
    } else {
      minDistance = midDistance;
    }
  }

  return buildCandidate(bestDistance);
}

export function resolveCameraView(view: CameraViewSpec, aspect: number): CameraViewSpec {
  if (view.name !== PLAYER_VIEW_NAME) {
    return view;
  }

  return fitCameraDistanceToPoints(
    view,
    aspect,
    FRAMING_TEST_POINTS.playerFocus,
    getPlayerViewportMargin(aspect)
  );
}

export function createCamera(view: CameraViewSpec, aspect: number): THREE.PerspectiveCamera {
  return createCameraFromPose(resolveCameraView(view, aspect), aspect);
}

export function projectWorldPoint(point: THREE.Vector3, view: CameraViewSpec, aspect: number): ProjectedPoint {
  const camera = createCamera(view, aspect);
  return projectPointWithCamera(point, camera);
}

export function measureProjectedBounds(points: THREE.Vector3[], view: CameraViewSpec, aspect: number): ProjectedBounds {
  const camera = createCamera(view, aspect);
  return measureProjectedBoundsWithCamera(points, camera);
}

export function getFramingTestPoints(): Record<string, THREE.Vector3[]> {
  return FRAMING_TEST_POINTS;
}

export function buildFramingReport(aspects: Record<string, number>): FramingReportRow[] {
  const rows: FramingReportRow[] = [];

  for (const view of CAMERA_VIEWS) {
    for (const [aspectLabel, aspect] of Object.entries(aspects)) {
      for (const [target, points] of Object.entries(FRAMING_TEST_POINTS)) {
        const bounds = measureProjectedBounds(points, view, aspect);
        rows.push({
          view: view.name,
          aspect: aspectLabel,
          target,
          marginLeft: bounds.marginLeft,
          marginRight: bounds.marginRight,
          marginBottom: bounds.marginBottom,
          marginTop: bounds.marginTop
        });
      }
    }
  }

  return rows;
}
