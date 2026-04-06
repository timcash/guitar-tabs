import { CIRCLE_OF_FIFTHS, NOTE_TO_SEMITONE } from './musicTheory';

interface NoteNodeElements {
  group: SVGGElement;
  halo: SVGCircleElement;
  core: SVGCircleElement;
  label: SVGTextElement;
  x: number;
  y: number;
}

export class PlaybackNoteCircleOverlay {
  private readonly root: HTMLDivElement;
  private readonly noteNodes = new Map<number, NoteNodeElements>();

  constructor(root: HTMLDivElement) {
    this.root = root;
    this.root.innerHTML = `
      <svg class="player-note-circle-svg" viewBox="0 0 100 100" role="presentation" aria-hidden="true">
        <circle class="player-note-circle-guide" cx="50" cy="53" r="41"></circle>
        ${this.renderNoteNodes()}
      </svg>
    `;

    this.captureNoteNodes();
    this.setActivePitchClass(null, 0);
  }

  public setActivePitchClass(pitchClass: number | null, intensity: number) {
    const clampedIntensity = Math.max(0, Math.min(1, intensity));
    const isActiveState = pitchClass !== null && clampedIntensity > 0.02;

    for (let currentPitchClass = 0; currentPitchClass < 12; currentPitchClass += 1) {
      const node = this.noteNodes.get(currentPitchClass);
      if (!node) continue;

      const isActive = isActiveState && currentPitchClass === pitchClass;
      const energy = isActive ? clampedIntensity : 0;

      node.group.dataset.active = isActive ? 'true' : 'false';
      node.group.setAttribute('transform', `translate(${node.x} ${node.y}) scale(${1 + energy * 0.22})`);
      node.group.setAttribute('opacity', isActive ? `${0.9 + energy * 0.1}` : '0.8');

      node.halo.setAttribute('opacity', isActive ? `${0.18 + energy * 0.56}` : '0.04');
      node.halo.setAttribute('r', `${6.5 + energy * 4.5}`);

      node.core.setAttribute('fill', isActive ? '#ffffff' : '#0f0f0f');
      node.core.setAttribute('stroke', isActive ? '#ffffff' : '#4f4f4f');
      node.core.setAttribute('stroke-width', isActive ? '1.4' : '0.9');

      node.label.setAttribute('fill', isActive ? '#000000' : '#c7c7c7');
      node.label.setAttribute('opacity', isActive ? '1' : '0.82');
    }
  }

  private renderNoteNodes() {
    const radius = 41;
    const centerX = 50;
    const centerY = 53;

    return CIRCLE_OF_FIFTHS.map((note, index) => {
      const angle = (index / CIRCLE_OF_FIFTHS.length) * Math.PI * 2 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      return `
        <g
          class="player-note-node"
          data-player-note-node="${note}"
          data-semitone="${NOTE_TO_SEMITONE[note]}"
          transform="translate(${x} ${y})"
        >
          <circle class="player-note-node-halo" r="6.5"></circle>
          <circle class="player-note-node-core" r="4.9"></circle>
          <text class="player-note-node-label" text-anchor="middle" dominant-baseline="middle">${note}</text>
        </g>
      `;
    }).join('');
  }

  private captureNoteNodes() {
    const groups = this.root.querySelectorAll<SVGGElement>('[data-player-note-node]');
    for (const group of groups) {
      const semitone = Number(group.dataset.semitone);
      const transform = group.getAttribute('transform') ?? 'translate(50 50)';
      const [, x = '50', y = '50'] = /translate\(([^ ]+) ([^)]+)\)/.exec(transform) ?? [];
      const halo = group.querySelector<SVGCircleElement>('.player-note-node-halo');
      const core = group.querySelector<SVGCircleElement>('.player-note-node-core');
      const label = group.querySelector<SVGTextElement>('.player-note-node-label');

      if (!halo || !core || !label || Number.isNaN(semitone)) continue;

      this.noteNodes.set(semitone, {
        group,
        halo,
        core,
        label,
        x: Number(x),
        y: Number(y)
      });
    }
  }
}
