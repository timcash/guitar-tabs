import * as THREE from 'three';
import {
  DEFAULT_HAND_LAYOUT,
  getAnimatedFingerPose,
  getPrePluckAnticipation,
  getPluckingFingerForString,
  type RightHandFinger
} from './handGeometry';

type DisplayFinger = RightHandFinger | 'c';

interface FingerMarker {
  finger: DisplayFinger;
  radius: number;
  group: THREE.Group;
  sphere: THREE.Mesh;
  label: THREE.Sprite;
}

const PLUCK_FINGERS: RightHandFinger[] = ['p', 'i', 'm', 'a'];
const DISPLAY_FINGERS: DisplayFinger[] = ['p', 'i', 'm', 'a', 'c'];
const BASE_COLOR = new THREE.Color(0x2ecc71);
const BASE_EMISSIVE = new THREE.Color(0x145a32);
const HIGHLIGHT_COLOR = new THREE.Color(0x7cf0a8);

export class VirtualHand {
  public readonly group: THREE.Group;

  private readonly fingerMarkers = new Map<DisplayFinger, FingerMarker>();
  private readonly lastPluckAt = new Map<RightHandFinger, number>();
  private readonly fingerSphereGeometry = new THREE.SphereGeometry(1, 24, 24);
  private isFlippedX = false;

  constructor() {
    this.group = new THREE.Group();
    this.group.position.set(0, 0, 0);

    for (const finger of DISPLAY_FINGERS) {
      const marker = this.createFingerMarker(finger);
      this.fingerMarkers.set(finger, marker);
      this.group.add(marker.group);
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

    for (const finger of PLUCK_FINGERS) {
      const marker = this.fingerMarkers.get(finger)!;
      const pluckAt = this.lastPluckAt.get(finger);
      const elapsedSincePluck = pluckAt === undefined ? null : nowMs - pluckAt;
      const targetString = this.getDisplayTargetString(finger, activeString, upcomingString);
      const pose = getAnimatedFingerPose(finger, targetString, isFlippedX, elapsedSincePluck);
      const anticipation = getPrePluckAnticipation(finger, upcomingString, timeUntilUpcomingPluckMs);

      marker.group.position.set(
        pose.x,
        pose.y + anticipation.yLift,
        pose.z + anticipation.zShift
      );

      this.updateMarkerAppearance(marker, anticipation.intensity, pose.glow, false);
    }

    this.updateSupportMarker(this.fingerMarkers.get('c')!);
  }

  private createFingerMarker(finger: DisplayFinger): FingerMarker {
    const radius = finger === 'p' ? 0.62 : finger === 'c' ? 0.4 : 0.48;
    const sphere = new THREE.Mesh(
      this.fingerSphereGeometry,
      new THREE.MeshPhongMaterial({
        color: BASE_COLOR,
        emissive: BASE_EMISSIVE,
        emissiveIntensity: finger === 'c' ? 0.4 : 0.55,
        transparent: true,
        opacity: finger === 'c' ? 0.72 : 0.9
      })
    );
    sphere.scale.setScalar(radius);

    const label = this.createLabelSprite(finger, radius);
    const group = new THREE.Group();
    group.add(sphere);
    group.add(label);

    return { finger, radius, group, sphere, label };
  }

  private createLabelSprite(letter: string, radius: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '900 94px Arial';
    ctx.fillStyle = '#f4fff7';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    ctx.shadowBlur = 10;
    ctx.fillText(letter, canvas.width / 2, canvas.height / 2 + 4);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false
    });

    const sprite = new THREE.Sprite(material);
    const size = radius * 1.35;
    sprite.scale.set(size, size, 1);
    sprite.renderOrder = 2;
    return sprite;
  }

  private updateMarkerAppearance(
    marker: FingerMarker,
    anticipation: number,
    glow: number,
    isSupportFinger: boolean
  ) {
    const material = marker.sphere.material as THREE.MeshPhongMaterial;
    const emphasis = isSupportFinger ? 0.12 : anticipation * 0.45 + glow * 0.55;
    const scale = 1 + emphasis * 0.18;

    marker.sphere.scale.setScalar(marker.radius * scale);
    marker.label.scale.set(marker.radius * 1.35 * scale, marker.radius * 1.35 * scale, 1);

    material.color.copy(BASE_COLOR).lerp(HIGHLIGHT_COLOR, emphasis * 0.6);
    material.emissive.copy(BASE_EMISSIVE).multiplyScalar(1 + emphasis * 1.8);
    material.emissiveIntensity = isSupportFinger ? 0.45 : 0.55 + emphasis * 1.2;
    material.opacity = isSupportFinger ? 0.72 : 0.88 + anticipation * 0.08 + glow * 0.04;

    const labelMaterial = marker.label.material as THREE.SpriteMaterial;
    labelMaterial.opacity = isSupportFinger ? 0.78 : 0.92 + glow * 0.08;
  }

  private updateSupportMarker(marker: FingerMarker) {
    const x = this.isFlippedX ? 6.3 : -6.3;
    const y = 0.18;
    const z = DEFAULT_HAND_LAYOUT.bridgeZ + 0.35;

    marker.group.position.set(x, y, z);
    this.updateMarkerAppearance(marker, 0, 0, true);
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
}
