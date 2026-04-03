import * as THREE from 'three';
import type { ChordDefinition, FallingNote } from './types';
import { VirtualHand } from './virtualHand';
import { ChordDisplay3D } from './chordDisplay3D';
import { noteNameService } from './audio/NoteNameService';
import { CAMERA_FOV_DEGREES, CAMERA_VIEWS, resolveCameraView } from './viewFraming';

interface LabelTextureSpec {
  text: string;
  width: number;
  height: number;
  font: string;
  fillStyle: string;
  strokeStyle?: string;
  lineWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  yOffset?: number;
}

interface CachedSpriteSlot {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  cacheKey: string | null;
}

interface ChordFingerSlot {
  group: THREE.Group;
  marker: THREE.Mesh;
  noteLabel: CachedSpriteSlot;
  openLabel: CachedSpriteSlot;
}

interface SlidingNoteSlot {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  noteName: string | null;
}

interface ParticleBurstSlot {
  points: THREE.Points;
  geometry: THREE.BufferGeometry;
  material: THREE.PointsMaterial;
  positions: Float32Array;
  velocities: Float32Array;
  active: boolean;
}

interface FloatingLabelSlot {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  noteName: string | null;
  active: boolean;
}

const CHORD_FINGER_SLOT_COUNT = 6;
const INITIAL_SLIDING_NOTE_POOL_SIZE = 16;
const PARTICLE_BURST_POOL_SIZE = 10;
const FLOATING_LABEL_POOL_SIZE = 10;
const PARTICLE_COUNT = 50;

/**
 * Handles all 3D visualization of the guitar fret-board, sliding-notes, pluck-zone, and chord-fingers.
 */
export class FretboardRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private strings!: THREE.Group;
  private fretLines!: THREE.Group;
  private readonly slidingNoteSlots: SlidingNoteSlot[] = [];
  private readonly particleBurstSlots: ParticleBurstSlot[] = [];
  private readonly floatingLabelSlots: FloatingLabelSlot[] = [];
  private readonly chordFingerGroup: THREE.Group;
  private readonly chordFingerSlots: ChordFingerSlot[] = [];
  private readonly pluckZoneGroup: THREE.Group;
  private readonly pluckZoneRings: THREE.Mesh[] = [];
  private readonly labelTextureCache = new Map<string, THREE.Texture>();
  private readonly pickingHand: VirtualHand;
  private readonly chordDisplay: ChordDisplay3D;
  private readonly chordFingerGeometry = new THREE.SphereGeometry(0.5, 32, 32);
  private readonly chordFingerMaterial = new THREE.MeshPhongMaterial({
    color: 0x646cff,
    emissive: 0x2222ff,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.9
  });
  private readonly pluckZoneRingGeometry = new THREE.TorusGeometry(0.7, 0.1, 16, 32);

  private width = 0;
  private height = 0;
  private readonly stringSpacing = 2;
  private isFlippedX = false;
  private nextParticleBurstSlotIndex = 0;
  private nextFloatingLabelSlotIndex = 0;

  private readonly nutZ = -16;
  private readonly fretWidth = 1.8;
  private readonly bridgeZ = 8;

  private currentViewIndex = 0;

  constructor(container: HTMLElement) {
    this.width = container.clientWidth;
    this.height = container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0a);

    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEGREES, this.width / this.height, 0.1, 1000);
    this.applyCameraView();

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    container.appendChild(this.renderer.domElement);

    this.initLighting();
    this.initStrings();
    this.initFretLines();

    this.chordFingerGroup = new THREE.Group();
    this.pluckZoneGroup = new THREE.Group();
    this.pickingHand = new VirtualHand();
    this.chordDisplay = new ChordDisplay3D();

    this.initChordFingerSlots();
    this.initPluckZoneMarkers();
    this.ensureSlidingNotePoolSize(INITIAL_SLIDING_NOTE_POOL_SIZE);
    this.initParticleBurstSlots();
    this.initFloatingLabelSlots();
    this.prewarmReusableAssets();

    this.scene.add(this.chordFingerGroup);
    this.scene.add(this.pluckZoneGroup);
    this.scene.add(this.pickingHand.group);
    this.scene.add(this.chordDisplay.group);

    window.addEventListener('resize', () => this.handleResize(container));
  }

  private initLighting() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.5));

    const primaryLight = new THREE.PointLight(0xffffff, 10);
    primaryLight.position.set(10, 20, 10);
    this.scene.add(primaryLight);

    const accentLight = new THREE.PointLight(0x646cff, 5);
    accentLight.position.set(-10, 10, -10);
    this.scene.add(accentLight);
  }

  private initStrings() {
    this.strings = new THREE.Group();

    const stringGeometry = new THREE.CylinderGeometry(0.04, 0.04, 80, 8);
    const stringMaterial = new THREE.MeshPhongMaterial({ color: 0xaaaaaa, emissive: 0x222222 });

    for (let stringNum = 1; stringNum <= 6; stringNum += 1) {
      const stringMesh = new THREE.Mesh(stringGeometry, stringMaterial);
      stringMesh.rotation.x = Math.PI / 2;
      this.strings.add(stringMesh);
    }

    this.scene.add(this.strings);
  }

  private initFretLines() {
    this.fretLines = new THREE.Group();

    const boardWidth = this.stringSpacing * 5 + 1;
    const fretGeometry = new THREE.BoxGeometry(boardWidth, 0.1, 0.2);
    const nutMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const fretMaterial = new THREE.MeshPhongMaterial({ color: 0x555555 });

    for (let fretIndex = 0; fretIndex <= 15; fretIndex += 1) {
      const z = this.nutZ + fretIndex * this.fretWidth;
      const fretMesh = new THREE.Mesh(fretGeometry, fretIndex === 0 ? nutMaterial : fretMaterial);
      fretMesh.position.set(0, -0.1, z);
      this.fretLines.add(fretMesh);

      if (fretIndex > 0) {
        this.addStaticLabel(
          this.fretLines,
          {
            text: fretIndex.toString(),
            width: 256,
            height: 256,
            font: 'Bold 40px Arial',
            fillStyle: '#666666'
          },
          -boardWidth / 2 - 1,
          0,
          z - this.fretWidth / 2,
          4,
          4
        );
      }
    }

    this.scene.add(this.fretLines);
  }

  private initChordFingerSlots() {
    for (let slotIndex = 0; slotIndex < CHORD_FINGER_SLOT_COUNT; slotIndex += 1) {
      const marker = new THREE.Mesh(this.chordFingerGeometry, this.chordFingerMaterial);
      const noteLabel = this.createSpriteSlot(4, 4, 2);
      noteLabel.sprite.position.set(0, 0.78, 0);

      const openLabel = this.createSpriteSlot(2.3, 2.3, 2);
      openLabel.sprite.position.set(0, -0.3, 0);
      openLabel.sprite.visible = false;

      const group = new THREE.Group();
      group.visible = false;
      group.add(marker);
      group.add(noteLabel.sprite);
      group.add(openLabel.sprite);

      this.chordFingerSlots.push({ group, marker, noteLabel, openLabel });
      this.chordFingerGroup.add(group);
    }
  }

  private initPluckZoneMarkers() {
    for (let stringNum = 1; stringNum <= 6; stringNum += 1) {
      const material = new THREE.MeshPhongMaterial({ color: 0x222222, emissive: 0x000000, emissiveIntensity: 0 });
      const ring = new THREE.Mesh(this.pluckZoneRingGeometry, material);
      ring.rotation.x = Math.PI / 2;
      this.pluckZoneRings.push(ring);
      this.pluckZoneGroup.add(ring);
    }
  }

  private ensureSlidingNotePoolSize(count: number) {
    while (this.slidingNoteSlots.length < count) {
      const material = new THREE.SpriteMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: false
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(2.2, 1.1, 1);
      sprite.renderOrder = 3;
      sprite.visible = false;

      this.slidingNoteSlots.push({ sprite, material, noteName: null });
      this.scene.add(sprite);
    }
  }

  private initParticleBurstSlots() {
    for (let slotIndex = 0; slotIndex < PARTICLE_BURST_POOL_SIZE; slotIndex += 1) {
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const material = new THREE.PointsMaterial({
        color: 0xff9800,
        size: 0.25,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0
      });

      const points = new THREE.Points(geometry, material);
      points.visible = false;

      this.particleBurstSlots.push({
        points,
        geometry,
        material,
        positions,
        velocities,
        active: false
      });

      this.scene.add(points);
    }
  }

  private initFloatingLabelSlots() {
    for (let slotIndex = 0; slotIndex < FLOATING_LABEL_POOL_SIZE; slotIndex += 1) {
      const material = new THREE.SpriteMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        opacity: 0
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(2.5, 2.5, 1);
      sprite.visible = false;

      this.floatingLabelSlots.push({
        sprite,
        material,
        noteName: null,
        active: false
      });

      this.scene.add(sprite);
    }
  }

  private prewarmReusableAssets() {
    const noteNames = new Set<string>();
    for (let stringNum = 1; stringNum <= 6; stringNum += 1) {
      for (let fret = 0; fret <= 15; fret += 1) {
        noteNames.add(noteNameService.getNoteLabel(stringNum, fret));
      }
    }

    for (const noteName of noteNames) {
      this.getOrCreateLabelTexture(this.getChordFingerLabelSpec(noteName));
      this.getOrCreateLabelTexture(this.getSlidingNoteLabelSpec(noteName));
      this.getOrCreateLabelTexture(this.getBurstLabelSpec(noteName));
    }

    this.getOrCreateLabelTexture(this.getOpenStringLabelSpec());
  }

  private applyCameraView() {
    const aspect = this.height > 0 ? this.width / this.height : this.camera.aspect;
    const view = resolveCameraView(CAMERA_VIEWS[this.currentViewIndex], aspect);

    this.camera.position.set(...view.pos);
    this.camera.lookAt(...view.look);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  public toggleCamera() {
    this.currentViewIndex = (this.currentViewIndex + 1) % CAMERA_VIEWS.length;
    this.applyCameraView();
  }

  private handleResize(container: HTMLElement) {
    this.width = container.clientWidth;
    this.height = container.clientHeight;
    this.camera.aspect = this.width / this.height;
    this.applyCameraView();
    this.renderer.setSize(this.width, this.height);
  }

  private getStringX(stringNum: number): number {
    const base = stringNum - 3.5;
    return (this.isFlippedX ? -base : base) * this.stringSpacing;
  }

  private getFretZ(fret: number): number {
    if (fret === 0) return this.nutZ - 0.5;
    return this.nutZ + (fret - 0.5) * this.fretWidth;
  }

  public renderFrame(
    activeChord: ChordDefinition,
    activeChordName: string,
    incomingChordName: string,
    incomingChordProgress: number,
    activeString: number | null,
    upcomingString: number | null,
    timeUntilUpcomingPluckMs: number | null,
    slidingNotes: FallingNote[],
    isFlippedX: boolean,
    elapsedTime: number
  ) {
    this.isFlippedX = isFlippedX;

    this.updateStringLayout();
    this.updateChordFingers(activeChord);
    this.chordDisplay.update(activeChordName, incomingChordName, incomingChordProgress);
    this.updatePluckZone(activeString);
    this.pickingHand.update(elapsedTime, activeString, upcomingString, timeUntilUpcomingPluckMs, isFlippedX);
    this.updateSlidingNotes(slidingNotes);
    this.updateParticlesAndLabels();

    this.renderer.render(this.scene, this.camera);
  }

  private updateStringLayout() {
    this.strings.children.forEach((stringMesh, index) => {
      stringMesh.position.x = this.getStringX(index + 1);
    });
  }

  private updateChordFingers(chord: ChordDefinition) {
    for (let slotIndex = 0; slotIndex < this.chordFingerSlots.length; slotIndex += 1) {
      const slot = this.chordFingerSlots[slotIndex];
      const fretPosition = chord.voicing[slotIndex];

      if (!fretPosition) {
        slot.group.visible = false;
        continue;
      }

      slot.group.visible = true;
      slot.group.position.set(this.getStringX(fretPosition.string), 0.4, this.getFretZ(fretPosition.fret));

      this.updateSpriteSlot(slot.noteLabel, this.getChordFingerLabelSpec(noteNameService.getNoteLabel(fretPosition.string, fretPosition.fret)));

      if (fretPosition.fret === 0) {
        this.updateSpriteSlot(slot.openLabel, this.getOpenStringLabelSpec());
      } else {
        slot.openLabel.sprite.visible = false;
      }
    }
  }

  private updatePluckZone(activeString: number | null) {
    this.pluckZoneRings.forEach((ring, index) => {
      const stringNum = index + 1;
      const isActive = activeString === stringNum;
      const material = ring.material as THREE.MeshPhongMaterial;

      ring.position.set(this.getStringX(stringNum), 0, this.bridgeZ);
      material.color.setHex(isActive ? 0xff9800 : 0x222222);
      material.emissive.setHex(isActive ? 0xff9800 : 0x000000);
      material.emissiveIntensity = isActive ? 2 : 0;
    });
  }

  private updateSlidingNotes(slidingNotes: FallingNote[]) {
    this.ensureSlidingNotePoolSize(slidingNotes.length);

    for (let slotIndex = 0; slotIndex < this.slidingNoteSlots.length; slotIndex += 1) {
      const slot = this.slidingNoteSlots[slotIndex];
      const slidingNote = slidingNotes[slotIndex];

      if (!slidingNote) {
        slot.sprite.visible = false;
        continue;
      }

      if (slot.noteName !== slidingNote.noteName) {
        slot.noteName = slidingNote.noteName;
        const { texture } = this.getOrCreateLabelTexture(this.getSlidingNoteLabelSpec(slidingNote.noteName));

        slot.material.map = texture;
        slot.material.needsUpdate = true;
      }

      slot.sprite.visible = true;
      slot.sprite.position.set(this.getStringX(slidingNote.stringNum), 0.95, slidingNote.z_3d);
      slot.material.opacity = slidingNote.opacity;
    }
  }

  private updateParticlesAndLabels() {
    for (const particleBurst of this.particleBurstSlots) {
      if (!particleBurst.active) continue;

      for (let positionIndex = 0; positionIndex < particleBurst.positions.length; positionIndex += 3) {
        particleBurst.positions[positionIndex] += particleBurst.velocities[positionIndex];
        particleBurst.positions[positionIndex + 1] += particleBurst.velocities[positionIndex + 1];
        particleBurst.positions[positionIndex + 2] += particleBurst.velocities[positionIndex + 2];
        particleBurst.velocities[positionIndex + 1] *= 0.98;
      }

      particleBurst.geometry.attributes.position.needsUpdate = true;
      particleBurst.material.opacity -= 0.04;

      if (particleBurst.material.opacity > 0) continue;

      particleBurst.active = false;
      particleBurst.points.visible = false;
    }

    for (const floatingLabel of this.floatingLabelSlots) {
      if (!floatingLabel.active) continue;

      floatingLabel.sprite.position.y += 0.1;
      floatingLabel.material.opacity -= 0.02;

      if (floatingLabel.material.opacity > 0) continue;

      floatingLabel.active = false;
      floatingLabel.sprite.visible = false;
    }
  }

  public triggerExplosion(stringNum: number, noteLabel: string) {
    const x = this.getStringX(stringNum);
    this.triggerParticleBurst(x);
    this.triggerFloatingLabel(x, noteLabel);
  }

  public triggerHandPluck(stringNum: number, atMs: number) {
    this.pickingHand.triggerPluck(stringNum, atMs);
  }

  private createSpriteSlot(scaleX: number, scaleY: number, renderOrder: number): CachedSpriteSlot {
    const material = new THREE.SpriteMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(scaleX, scaleY, 1);
    sprite.renderOrder = renderOrder;
    return { sprite, material, cacheKey: null };
  }

  private addStaticLabel(
    group: THREE.Group,
    spec: LabelTextureSpec,
    x: number,
    y: number,
    z: number,
    scaleX: number,
    scaleY: number
  ) {
    const { texture } = this.getOrCreateLabelTexture(spec);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false
      })
    );

    sprite.position.set(x, y, z);
    sprite.scale.set(scaleX, scaleY, 1);
    group.add(sprite);
  }

  private updateSpriteSlot(slot: CachedSpriteSlot, spec: LabelTextureSpec) {
    const { texture, cacheKey } = this.getOrCreateLabelTexture(spec);
    if (slot.cacheKey !== cacheKey) {
      slot.material.map = texture;
      slot.material.needsUpdate = true;
      slot.cacheKey = cacheKey;
    }
    slot.sprite.visible = true;
  }

  private triggerParticleBurst(x: number) {
    const burstSlot = this.getNextParticleBurstSlot();
    burstSlot.active = true;
    burstSlot.points.visible = true;
    burstSlot.material.opacity = 0.9;

    for (let particleIndex = 0; particleIndex < PARTICLE_COUNT; particleIndex += 1) {
      const offset = particleIndex * 3;
      burstSlot.positions[offset] = x;
      burstSlot.positions[offset + 1] = 0;
      burstSlot.positions[offset + 2] = this.bridgeZ;

      burstSlot.velocities[offset] = (Math.random() - 0.5) * 0.18;
      burstSlot.velocities[offset + 1] = 0.05 + Math.random() * 0.18;
      burstSlot.velocities[offset + 2] = (Math.random() - 0.5) * 0.18;
    }

    burstSlot.geometry.attributes.position.needsUpdate = true;
  }

  private triggerFloatingLabel(x: number, noteLabel: string) {
    const labelSlot = this.getNextFloatingLabelSlot();
    if (labelSlot.noteName !== noteLabel) {
      labelSlot.noteName = noteLabel;
      labelSlot.material.map = this.getOrCreateLabelTexture(this.getBurstLabelSpec(noteLabel)).texture;
      labelSlot.material.needsUpdate = true;
    }

    labelSlot.active = true;
    labelSlot.sprite.visible = true;
    labelSlot.material.opacity = 1;
    labelSlot.sprite.position.set(x, 2, this.bridgeZ);
  }

  private getNextParticleBurstSlot() {
    const burstSlot = this.particleBurstSlots[this.nextParticleBurstSlotIndex];
    this.nextParticleBurstSlotIndex = (this.nextParticleBurstSlotIndex + 1) % this.particleBurstSlots.length;
    return burstSlot;
  }

  private getNextFloatingLabelSlot() {
    const labelSlot = this.floatingLabelSlots[this.nextFloatingLabelSlotIndex];
    this.nextFloatingLabelSlotIndex = (this.nextFloatingLabelSlotIndex + 1) % this.floatingLabelSlots.length;
    return labelSlot;
  }

  private getChordFingerLabelSpec(noteLabel: string): LabelTextureSpec {
    return {
      text: noteLabel,
      width: 256,
      height: 256,
      font: 'Bold 58px Arial',
      fillStyle: '#f5f7ff'
    };
  }

  private getOpenStringLabelSpec(): LabelTextureSpec {
    return {
      text: 'OPEN',
      width: 256,
      height: 128,
      font: 'Bold 26px Arial',
      fillStyle: '#888888'
    };
  }

  private getSlidingNoteLabelSpec(noteLabel: string): LabelTextureSpec {
    return {
      text: noteLabel,
      width: 512,
      height: 256,
      font: '900 108px Arial',
      fillStyle: '#ffffff',
      strokeStyle: 'rgba(0, 0, 0, 0.9)',
      lineWidth: 14,
      shadowColor: 'rgba(0, 0, 0, 0.95)',
      shadowBlur: 18,
      yOffset: 10
    };
  }

  private getBurstLabelSpec(noteLabel: string): LabelTextureSpec {
    return {
      text: noteLabel,
      width: 128,
      height: 128,
      font: 'Bold 80px Arial',
      fillStyle: '#ffffff',
      shadowColor: '#ff9800',
      shadowBlur: 10,
      yOffset: 16
    };
  }

  private getOrCreateLabelTexture(spec: LabelTextureSpec) {
    const cacheKey = [
      spec.text,
      spec.width,
      spec.height,
      spec.font,
      spec.fillStyle,
      spec.strokeStyle ?? '',
      spec.lineWidth ?? 0,
      spec.shadowColor ?? '',
      spec.shadowBlur ?? 0,
      spec.yOffset ?? 0
    ].join('|');

    const cachedTexture = this.labelTextureCache.get(cacheKey);
    if (cachedTexture) {
      return { texture: cachedTexture, cacheKey };
    }

    const canvas = document.createElement('canvas');
    canvas.width = spec.width;
    canvas.height = spec.height;

    const context = canvas.getContext('2d')!;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = spec.font;
    context.fillStyle = spec.fillStyle;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.shadowColor = spec.shadowColor ?? 'transparent';
    context.shadowBlur = spec.shadowBlur ?? 0;

    const textY = canvas.height / 2 + (spec.yOffset ?? 0);
    if (spec.strokeStyle && spec.lineWidth) {
      context.lineWidth = spec.lineWidth;
      context.strokeStyle = spec.strokeStyle;
      context.strokeText(spec.text, canvas.width / 2, textY);
    }

    context.fillText(spec.text, canvas.width / 2, textY);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    this.labelTextureCache.set(cacheKey, texture);
    return { texture, cacheKey };
  }
}
