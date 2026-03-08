import * as THREE from 'three';

interface LabelSprite {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  material: THREE.SpriteMaterial;
  sprite: THREE.Sprite;
}

export class ChordDisplay3D {
  public readonly group: THREE.Group;

  private readonly currentLabel: LabelSprite;
  private readonly nextLabel: LabelSprite;

  constructor() {
    this.group = new THREE.Group();
    this.currentLabel = this.createLabelSprite(1024, 256);
    this.nextLabel = this.createLabelSprite(512, 192);

    this.currentLabel.sprite.position.set(0, 4.15, -15.1);
    this.currentLabel.sprite.scale.set(9.8, 2.35, 1);

    this.nextLabel.sprite.position.set(7.2, 3.6, -14.7);
    this.nextLabel.sprite.scale.set(4.8, 1.45, 1);

    this.group.add(this.currentLabel.sprite);
    this.group.add(this.nextLabel.sprite);
  }

  public update(currentChord: string, nextChord: string, nextProgress: number) {
    this.drawCurrentChord(currentChord);
    this.drawNextChord(nextChord);

    this.currentLabel.material.opacity = 0.98;

    const clamped = Math.max(0, Math.min(1, nextProgress));
    this.nextLabel.sprite.position.set(7.2 - clamped * 4.2, 3.6, -14.7 + clamped * 0.25);
    this.nextLabel.material.opacity = clamped * 0.95;
    this.nextLabel.material.rotation = (1 - clamped) * 0.05;
    this.nextLabel.sprite.scale.set(4.4 + clamped * 0.65, 1.3 + clamped * 0.2, 1);
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

    return { canvas, context, material, sprite };
  }

  private drawCurrentChord(chord: string) {
    const { canvas, context, material } = this.currentLabel;
    context.clearRect(0, 0, canvas.width, canvas.height);

    context.shadowColor = 'rgba(255, 152, 0, 0.45)';
    context.shadowBlur = 24;
    context.fillStyle = '#fff7df';
    context.font = '900 150px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(chord, canvas.width / 2, canvas.height / 2 + 8);

    material.map!.needsUpdate = true;
  }

  private drawNextChord(chord: string) {
    const { canvas, context, material } = this.nextLabel;
    context.clearRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = '#ffcf7d';
    context.font = '900 88px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(chord, canvas.width / 2, canvas.height / 2 + 4);

    material.map!.needsUpdate = true;
  }
}
