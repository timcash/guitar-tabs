import * as THREE from 'three';
import {
  DEFAULT_HAND_LAYOUT,
  getAnimatedFingerPose,
  getPrePluckAnticipation,
  getFingerRestPose,
  getPluckingFingerForString,
  type RightHandFinger,
  type FingerPose
} from './handGeometry';

interface FingerRig {
  finger: RightHandFinger;
  base: THREE.Vector3;
  joints: THREE.Mesh[];
  tip: THREE.Mesh;
}

const FINGERS: RightHandFinger[] = ['p', 'i', 'm', 'a'];
const UP = new THREE.Vector3(0, 1, 0);

export class VirtualHand {
  public readonly group: THREE.Group;

  private readonly fingerRigs = new Map<RightHandFinger, FingerRig>();
  private readonly lastPluckAt = new Map<RightHandFinger, number>();
  private isFlippedX = false;

  constructor() {
    this.group = new THREE.Group();
    this.group.position.set(0, 0, 0);

    for (const finger of FINGERS) {
      const rig = this.createFingerRig(finger);
      this.fingerRigs.set(finger, rig);
      rig.joints.forEach((joint) => this.group.add(joint));
      this.group.add(rig.tip);
    }

    this.update(0, null, null, null, false);
  }

  public triggerPluck(stringNum: number, atMs: number) {
    const finger = getPluckingFingerForString(stringNum);
    this.lastPluckAt.set(finger, atMs);
  }

  public update(
    nowMs: number,
    activeString: number | null,
    upcomingString: number | null,
    timeUntilUpcomingPluckMs: number | null,
    isFlippedX: boolean
  ) {
    this.isFlippedX = isFlippedX;

    for (const finger of FINGERS) {
      const rig = this.fingerRigs.get(finger)!;
      const pluckAt = this.lastPluckAt.get(finger);
      const elapsedSincePluck = pluckAt === undefined ? null : nowMs - pluckAt;
      const targetString = this.getDisplayTargetString(finger, activeString, upcomingString);
      const pose = getAnimatedFingerPose(finger, targetString, isFlippedX, elapsedSincePluck);
      const rest = getFingerRestPose(finger, targetString, isFlippedX);
      const anticipation = getPrePluckAnticipation(finger, upcomingString, timeUntilUpcomingPluckMs);
      this.updateFingerRig(rig, pose, rest, anticipation.intensity, anticipation.yLift, anticipation.zShift);
    }
  }

  private createFingerRig(finger: RightHandFinger): FingerRig {
    const base = this.getBasePosition(finger, false);
    const segmentCount = finger === 'p' ? 2 : 3;
    const radius = finger === 'p' ? 0.26 : 0.18;
    const joints = Array.from({ length: segmentCount }, () => {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius * 0.92, 1, 10),
        new THREE.MeshPhongMaterial({
          color: 0x2ecc71,
          emissive: 0x145a32,
          emissiveIntensity: 0.45,
          transparent: true,
          opacity: 0.88
        })
      );
      return mesh;
    });

    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.28, 14, 14),
      new THREE.MeshPhongMaterial({
        color: 0x2ecc71,
        emissive: 0x145a32,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.9
      })
    );

    return { finger, base, joints, tip };
  }

  private updateFingerRig(
    rig: FingerRig,
    pose: FingerPose,
    rest: FingerPose,
    anticipation: number,
    yLift: number,
    zShift: number
  ) {
    rig.base.copy(this.getBasePosition(rig.finger, this.isFlippedX));

    const tipPos = new THREE.Vector3(pose.x, pose.y, pose.z);
    const restPos = new THREE.Vector3(rest.x, rest.y, rest.z);
    const toPalm = new THREE.Vector3(0, DEFAULT_HAND_LAYOUT.palmY, DEFAULT_HAND_LAYOUT.palmZ).sub(restPos);
    const curlShift = toPalm.multiplyScalar(0.18 * pose.curl);
    tipPos.add(curlShift);
    tipPos.y += yLift;
    tipPos.z += zShift;

    const points = this.buildFingerPath(rig.base, tipPos, rig.joints.length, pose.curl);
    for (let i = 0; i < rig.joints.length; i++) {
      this.placeSegment(rig.joints[i], points[i], points[i + 1], pose.glow, anticipation);
    }

    rig.tip.position.copy(tipPos);
    const tipMaterial = rig.tip.material as THREE.MeshPhongMaterial;
    this.applyFingerColor(tipMaterial, anticipation, pose.glow);
  }

  private buildFingerPath(base: THREE.Vector3, tip: THREE.Vector3, segmentCount: number, curl: number) {
    const points: THREE.Vector3[] = [];
    const archHeight = (0.18 + curl * 0.35) * (segmentCount === 2 ? 1.1 : 1);

    for (let i = 0; i <= segmentCount; i++) {
      const t = i / segmentCount;
      const point = new THREE.Vector3().lerpVectors(base, tip, t);
      const arch = Math.sin(Math.PI * t) * archHeight;
      point.y += arch;
      point.z += arch * 0.12;
      points.push(point);
    }

    return points;
  }

  private placeSegment(mesh: THREE.Mesh, start: THREE.Vector3, end: THREE.Vector3, glow: number, anticipation: number) {
    const delta = new THREE.Vector3().subVectors(end, start);
    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const length = Math.max(delta.length(), 0.001);

    mesh.position.copy(midpoint);
    const thickness = 1.05 + anticipation * 0.3;
    mesh.scale.set(thickness, length * (1.08 + anticipation * 0.14), thickness);
    mesh.quaternion.setFromUnitVectors(UP, delta.clone().normalize());

    const material = mesh.material as THREE.MeshPhongMaterial;
    this.applyFingerColor(material, anticipation, glow);
  }

  private getBasePosition(finger: RightHandFinger, isFlippedX: boolean) {
    const rest = getFingerRestPose(finger, null, isFlippedX);
    const xOffset = finger === 'p' ? 1.05 : 0.52;
    const baseX = rest.x + (rest.x >= 0 ? -xOffset : xOffset);
    const y = DEFAULT_HAND_LAYOUT.palmY + (finger === 'p' ? 0.15 : 0.05);
    const z = DEFAULT_HAND_LAYOUT.palmZ - (finger === 'p' ? 0.2 : 0.45);
    return new THREE.Vector3(baseX, y, z);
  }

  private getDisplayTargetString(
    finger: RightHandFinger,
    activeString: number | null,
    upcomingString: number | null
  ) {
    if (upcomingString !== null && getPluckingFingerForString(upcomingString) === finger) {
      return upcomingString;
    }
    return activeString;
  }

  private applyFingerColor(material: THREE.MeshPhongMaterial, anticipation: number, glow: number) {
    const prepColor = new THREE.Color(0x2ecc71)
      .lerp(new THREE.Color(0xf1c40f), Math.min(anticipation * 1.15, 1))
      .lerp(new THREE.Color(0xe74c3c), Math.max(anticipation - 0.58, 0) / 0.42);
    material.color.copy(prepColor);
    material.emissive.copy(prepColor).multiplyScalar(0.42 + anticipation * 0.32 + glow * 0.18);
    material.emissiveIntensity = 0.55 + anticipation * 0.85 + glow * 0.45;
  }
}
