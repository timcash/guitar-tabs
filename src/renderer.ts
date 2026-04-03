import * as THREE from 'three';
import type { ChordDefinition, FallingNote } from './types';
import { VirtualHand } from './virtualHand';
import { ChordDisplay3D } from './chordDisplay3D';
import { noteNameService } from './audio/NoteNameService';
import { CAMERA_FOV_DEGREES, CAMERA_VIEWS } from './viewFraming';

/**
 * Handles all 3D visualization of the guitar fretboard, strings, and falling notes.
 */
export class FretboardRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private strings!: THREE.Group;
  private fretLines!: THREE.Group;
  private activeNoteLabels: Map<number, THREE.Sprite> = new Map();
  private particles: THREE.Points[] = [];
  private leftHandMarkers: THREE.Group; // Visual indicators for chord fingerings
  private rightHandMarkers: THREE.Group; // Visual indicators for string plucking
  private floatingLabels: THREE.Sprite[] = [];
  private rightHand: VirtualHand;
  private chordDisplay: ChordDisplay3D;
  
  private width: number = 0;
  private height: number = 0;
  private readonly stringSpacing = 2;
  private isFlippedX = false;
  
  // Z-Axis Geometry Constants
  private readonly nutZ = -16;
  private readonly fretWidth = 1.8;
  private readonly bridgeZ = 8; // Pluck zone

  private currentViewIndex = 0;
  private readonly cameraViews = CAMERA_VIEWS.map((view) => ({
    name: view.name,
    pos: new THREE.Vector3(...view.pos),
    look: new THREE.Vector3(...view.look)
  }));

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

    this.leftHandMarkers = new THREE.Group();
    this.rightHandMarkers = new THREE.Group();
    this.rightHand = new VirtualHand();
    this.chordDisplay = new ChordDisplay3D();
    this.scene.add(this.leftHandMarkers);
    this.scene.add(this.rightHandMarkers);
    this.scene.add(this.rightHand.group);
    this.scene.add(this.chordDisplay.group);

    window.addEventListener('resize', () => this.handleResize(container));
  }

  private initLighting() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const p1 = new THREE.PointLight(0xffffff, 10);
    p1.position.set(10, 20, 10);
    this.scene.add(p1);
    const p2 = new THREE.PointLight(0x646cff, 5);
    p2.position.set(-10, 10, -10);
    this.scene.add(p2);
  }

  private initStrings() {
    this.strings = new THREE.Group();
    for (let i = 1; i <= 6; i++) {
      const geometry = new THREE.CylinderGeometry(0.04, 0.04, 80, 8);
      const material = new THREE.MeshPhongMaterial({ color: 0xaaaaaa, emissive: 0x222222 });
      const string = new THREE.Mesh(geometry, material);
      string.rotation.x = Math.PI / 2;
      this.strings.add(string);
    }
    this.scene.add(this.strings);
  }

  private initFretLines() {
    this.fretLines = new THREE.Group();
    const boardWidth = this.stringSpacing * 5 + 1;
    for (let i = 0; i <= 15; i++) {
      const z = this.nutZ + i * this.fretWidth;
      const geometry = new THREE.BoxGeometry(boardWidth, 0.1, 0.2);
      const material = new THREE.MeshPhongMaterial({ color: i === 0 ? 0xffffff : 0x555555 });
      const fret = new THREE.Mesh(geometry, material);
      fret.position.set(0, -0.1, z);
      this.fretLines.add(fret);
      
      if (i > 0) {
        this.createStaticLabel(i.toString(), -boardWidth/2 - 1, 0, z - this.fretWidth/2, this.fretLines, 0x666666, 40);
      }
    }
    this.scene.add(this.fretLines);
  }

  private applyCameraView() {
    const view = this.cameraViews[this.currentViewIndex];
    this.camera.position.copy(view.pos);
    this.camera.lookAt(view.look);
  }

  public toggleCamera() {
    this.currentViewIndex = (this.currentViewIndex + 1) % this.cameraViews.length;
    this.applyCameraView();
  }

  private handleResize(container: HTMLElement) {
    this.width = container.clientWidth;
    this.height = container.clientHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
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

  /**
   * Main render loop update for the 3D scene.
   */
  public renderFrame(
    currentChord: ChordDefinition,
    currentChordName: string,
    nextChordName: string,
    nextChordProgress: number,
    activeString: number | null,
    upcomingString: number | null,
    timeUntilUpcomingPluckMs: number | null,
    fallingNotes: FallingNote[],
    isFlippedX: boolean,
    elapsedTime: number
  ) {
    this.isFlippedX = isFlippedX;

    // Align strings with current flip state
    this.strings.children.forEach((s, i) => {
      s.position.x = this.getStringX(i + 1);
    });

    this.updateLeftHandVoicing(currentChord);
    this.chordDisplay.update(currentChordName, nextChordName, nextChordProgress);
    this.updateRightHandPluckZone(activeString);
    this.rightHand.update(elapsedTime, activeString, upcomingString, timeUntilUpcomingPluckMs, isFlippedX);
    this.updateFallingNotes(fallingNotes);
    this.updateParticlesAndLabels();

    this.renderer.render(this.scene, this.camera);
  }

  private updateLeftHandVoicing(chord: ChordDefinition) {
    this.leftHandMarkers.clear();

    chord.voicing.forEach(pos => {
      const x = this.getStringX(pos.string);
      const z = this.getFretZ(pos.fret);
      const noteLabel = noteNameService.getNoteLabel(pos.string, pos.fret);
      
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 32, 32),
        new THREE.MeshPhongMaterial({ color: 0x646cff, emissive: 0x2222ff, emissiveIntensity: 0.8, transparent: true, opacity: 0.9 })
      );
      marker.position.set(x, 0.4, z);
      this.leftHandMarkers.add(marker);

      this.createStaticLabel(noteLabel, x, 1.18, z, this.leftHandMarkers, 0xf5f7ff, 58);
      if (pos.fret === 0) {
        this.createStaticLabel("OPEN", x, 0.1, z, this.leftHandMarkers, 0x888888, 26);
      }
    });
  }

  private updateRightHandPluckZone(activeString: number | null) {
    this.rightHandMarkers.clear();
    for (let i = 1; i <= 6; i++) {
      const x = this.getStringX(i);
      const isActive = activeString === i;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.7, 0.1, 16, 32),
        new THREE.MeshPhongMaterial({ 
          color: isActive ? 0xff9800 : 0x222222, 
          emissive: isActive ? 0xff9800 : 0x000000, 
          emissiveIntensity: isActive ? 2 : 0 
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, 0, this.bridgeZ);
      this.rightHandMarkers.add(ring);
    }
  }

  private updateFallingNotes(fallingNotes: FallingNote[]) {
    const activeIds = new Set(fallingNotes.map(n => n.hitTime));
    
    // Cleanup expired notes
    for (const [id, sprite] of this.activeNoteLabels.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(sprite);
        this.disposeFallingNoteLabel(sprite);
        this.activeNoteLabels.delete(id);
      }
    }

    // Add/update note labels in flight.
    fallingNotes.forEach(note => {
      let sprite = this.activeNoteLabels.get(note.hitTime);
      const x = this.getStringX(note.stringNum);
      if (!sprite) {
        sprite = this.createFallingNoteLabel(note.noteName);
        this.scene.add(sprite);
        this.activeNoteLabels.set(note.hitTime, sprite);
      }
      sprite.position.set(x, 0.95, note.z_3d);
      (sprite.material as THREE.SpriteMaterial).opacity = note.opacity;
    });
  }

  private createFallingNoteLabel(text: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 108px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.strokeText(text, 256, 138);
    ctx.fillText(text, 256, 138);

    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        depthTest: false
      })
    );

    sprite.scale.set(2.2, 1.1, 1);
    sprite.renderOrder = 3;
    return sprite;
  }

  private disposeFallingNoteLabel(sprite: THREE.Sprite) {
    const material = sprite.material as THREE.SpriteMaterial;
    material.map?.dispose();
    material.dispose();
  }

  private updateParticlesAndLabels() {
    this.particles = this.particles.filter(p => {
      const pos = p.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i] += (Math.random() - 0.5) * 0.25;
        pos[i+1] += Math.random() * 0.25;
        pos[i+2] += (Math.random() - 0.5) * 0.25;
      }
      p.geometry.attributes.position.needsUpdate = true;
      (p.material as THREE.PointsMaterial).opacity -= 0.04;
      if ((p.material as THREE.PointsMaterial).opacity <= 0) { this.scene.remove(p); return false; }
      return true;
    });

    this.floatingLabels = this.floatingLabels.filter(s => {
      s.position.y += 0.1;
      s.material.opacity -= 0.02;
      if (s.material.opacity <= 0) { this.scene.remove(s); return false; }
      return true;
    });
  }

  private createStaticLabel(text: string, x: number, y: number, z: number, group: THREE.Group, color: number = 0xffffff, fontSize: number = 60) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.font = `Bold ${fontSize}px Arial`;
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 128);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    sprite.position.set(x, y, z);
    sprite.scale.set(4, 4, 1);
    group.add(sprite);
  }

  public triggerExplosion(stringNum: number, noteLabel: string) {
    const x = this.getStringX(stringNum);
    const particleCount = 50;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = x;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = this.bridgeZ;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xff9800, size: 0.25, transparent: true, blending: THREE.AdditiveBlending }));
    this.scene.add(points);
    this.particles.push(points);

    // Dynamic Floating Note Name
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.font = 'Bold 80px Arial'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
    ctx.shadowColor = '#ff9800'; ctx.shadowBlur = 10;
    ctx.fillText(noteLabel, 64, 80);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, blending: THREE.AdditiveBlending }));
    sprite.position.set(x, 2, this.bridgeZ);
    sprite.scale.set(2.5, 2.5, 1);
    this.scene.add(sprite);
    this.floatingLabels.push(sprite);
  }

  public triggerHandPluck(stringNum: number, atMs: number) {
    this.rightHand.triggerPluck(stringNum, atMs);
  }
}
