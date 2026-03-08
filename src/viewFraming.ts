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
  { name: 'Classic', pos: [0, 12, 18], look: [0, 0, -2] },
  { name: 'Player', pos: [0, 5, 15], look: [0, 1, -10] },
  { name: 'Birdseye', pos: [0, 25, 0], look: [0, 0, 0] },
  { name: 'Cinematic', pos: [15, 8, 10], look: [-5, 0, -5] }
];

export const SCENE_LAYOUT = {
  stringSpacing: 2,
  nutZ: -16,
  fretWidth: 1.8,
  bridgeZ: 8,
  boardWidth: 11
};

export function getStringX(stringNum: number, isFlippedX: boolean = false): number {
  const base = stringNum - 3.5;
  return (isFlippedX ? -base : base) * SCENE_LAYOUT.stringSpacing;
}

export function getFretZ(fret: number): number {
  if (fret === 0) return SCENE_LAYOUT.nutZ - 0.5;
  return SCENE_LAYOUT.nutZ + (fret - 0.5) * SCENE_LAYOUT.fretWidth;
}

export function createCamera(view: CameraViewSpec, aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEGREES, aspect, 0.1, 1000);
  camera.position.set(...view.pos);
  camera.lookAt(...view.look);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}

export function projectWorldPoint(point: THREE.Vector3, view: CameraViewSpec, aspect: number): ProjectedPoint {
  const camera = createCamera(view, aspect);
  const projected = point.clone().project(camera);
  return { x: projected.x, y: projected.y, z: projected.z };
}

export function measureProjectedBounds(points: THREE.Vector3[], view: CameraViewSpec, aspect: number): ProjectedBounds {
  const projected = points.map((point) => projectWorldPoint(point, view, aspect));
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

export function allPointsWithinMargin(points: THREE.Vector3[], view: CameraViewSpec, aspect: number, margin: number): boolean {
  return points.every((point) => {
    const projected = projectWorldPoint(point, view, aspect);
    return projected.x >= -1 + margin &&
      projected.x <= 1 - margin &&
      projected.y >= -1 + margin &&
      projected.y <= 1 - margin &&
      projected.z >= -1 &&
      projected.z <= 1;
  });
}

export function getFramingTestPoints(): Record<string, THREE.Vector3[]> {
  const halfBoard = SCENE_LAYOUT.boardWidth / 2;
  const nutZ = SCENE_LAYOUT.nutZ;
  const bridgeZ = SCENE_LAYOUT.bridgeZ;

  return {
    fretboard: [
      new THREE.Vector3(-halfBoard, 0, nutZ),
      new THREE.Vector3(halfBoard, 0, nutZ),
      new THREE.Vector3(-halfBoard, 0, bridgeZ),
      new THREE.Vector3(halfBoard, 0, bridgeZ)
    ],
    chordDisplay: [
      new THREE.Vector3(-4.9, 4.15, -15.1),
      new THREE.Vector3(4.9, 4.15, -15.1),
      new THREE.Vector3(-2.5, 3.6, -14.45),
      new THREE.Vector3(7.2, 3.6, -14.7)
    ],
    leftHandNoteLabels: [
      new THREE.Vector3(getStringX(5), 1.18, getFretZ(3)),
      new THREE.Vector3(getStringX(4), 1.18, getFretZ(2)),
      new THREE.Vector3(getStringX(2), 1.18, getFretZ(1)),
      new THREE.Vector3(getStringX(1), 1.18, getFretZ(0))
    ],
    rightHandZone: [
      new THREE.Vector3(getStringX(6), 0, bridgeZ),
      new THREE.Vector3(getStringX(1), 0, bridgeZ),
      new THREE.Vector3(getStringX(5), 1.3, 8.8)
    ]
  };
}

export function buildFramingReport(aspects: Record<string, number>): FramingReportRow[] {
  const targets = getFramingTestPoints();
  const rows: FramingReportRow[] = [];

  for (const view of CAMERA_VIEWS) {
    for (const [aspectLabel, aspect] of Object.entries(aspects)) {
      for (const [target, points] of Object.entries(targets)) {
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
