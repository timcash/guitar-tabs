import * as THREE from 'three';

interface LabelSprite {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  material: THREE.SpriteMaterial;
  sprite: THREE.Sprite;
  lastText: string;
}

interface LabelDrawStyle {
  fillStyle: string;
  font: string;
  shadowColor?: string;
  shadowBlur?: number;
  yOffset?: number;
}

export class ChordDisplay3D {
  public readonly group: THREE.Group;

  private readonly activeChordLabel: LabelSprite;
  private readonly incomingChordLabel: LabelSprite;

  constructor() {
    this.group = new THREE.Group();
    this.activeChordLabel = this.createLabelSprite(1024, 256);
    this.incomingChordLabel = this.createLabelSprite(512, 192);

    this.activeChordLabel.sprite.position.set(0, 4.15, -15.1);
    this.activeChordLabel.sprite.scale.set(9.8, 2.35, 1);

    this.incomingChordLabel.sprite.position.set(7.2, 3.6, -14.7);
    this.incomingChordLabel.sprite.scale.set(4.8, 1.45, 1);

    this.group.add(this.activeChordLabel.sprite);
    this.group.add(this.incomingChordLabel.sprite);
  }

  public update(activeChordName: string, incomingChordName: string, incomingChordProgress: number) {
    this.drawActiveChord(activeChordName);
    this.drawIncomingChord(incomingChordName);

    this.activeChordLabel.material.opacity = 0.98;

    const clamped = Math.max(0, Math.min(1, incomingChordProgress));
    this.incomingChordLabel.sprite.position.set(7.2 - clamped * 4.2, 3.6, -14.7 + clamped * 0.25);
    this.incomingChordLabel.material.opacity = clamped * 0.95;
    this.incomingChordLabel.material.rotation = (1 - clamped) * 0.05;
    this.incomingChordLabel.sprite.scale.set(4.4 + clamped * 0.65, 1.3 + clamped * 0.2, 1);
  }

  private createLabelSprite(width: number, height: number): LabelSprite {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d')!;
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(material);

    return { canvas, context, material, sprite, lastText: '' };
  }

  private drawActiveChord(chord: string) {
    this.drawLabel(this.activeChordLabel, chord, {
      fillStyle: '#fff7df',
      font: '900 150px Arial',
      shadowColor: 'rgba(255, 152, 0, 0.45)',
      shadowBlur: 24,
      yOffset: 8
    });
  }

  private drawIncomingChord(chord: string) {
    this.drawLabel(this.incomingChordLabel, chord, {
      fillStyle: '#ffcf7d',
      font: '900 88px Arial',
      yOffset: 4
    });
  }

  private drawLabel(label: LabelSprite, text: string, style: LabelDrawStyle) {
    if (label.lastText === text) return;

    const { canvas, context, material } = label;
    context.clearRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = style.fillStyle;
    context.font = style.font;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.shadowColor = style.shadowColor ?? 'transparent';
    context.shadowBlur = style.shadowBlur ?? 0;
    context.fillText(text, canvas.width / 2, canvas.height / 2 + (style.yOffset ?? 0));

    material.map!.needsUpdate = true;
    label.lastText = text;
  }
}
