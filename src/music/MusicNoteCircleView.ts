import { CIRCLE_OF_FIFTHS, NOTE_TO_SEMITONE } from './musicTheory';
import type { MusicAnalysisFrame } from './MicrophoneNoteAnalyzer';

interface MusicNoteCircleViewOptions {
  onEnableMicrophone: () => void;
}

interface NoteNodeElements {
  group: SVGGElement;
  halo: SVGCircleElement;
  core: SVGCircleElement;
  label: SVGTextElement;
  x: number;
  y: number;
}

export type MusicMicrophonePhase = 'idle' | 'starting' | 'listening' | 'error' | 'unsupported';

export class MusicNoteCircleView {
  private readonly root: HTMLDivElement;
  private readonly noteNodes = new Map<number, NoteNodeElements>();
  private readonly noteReadout: HTMLParagraphElement;
  private readonly frequencyReadout: HTMLParagraphElement;
  private readonly statusCopy: HTMLParagraphElement;
  private readonly micButton: HTMLButtonElement;

  constructor(root: HTMLDivElement, options: MusicNoteCircleViewOptions) {
    this.root = root;
    document.title = 'Music - guitar-tabs';
    document.body.classList.add('music-route');
    this.root.classList.add('music-route-root');

    this.root.innerHTML = `
      <div class="music-page">
        <div class="music-circle-stage">
          <div class="music-circle-frame">
            <svg class="music-note-circle" viewBox="0 0 100 100" role="img" aria-label="Circle of fifths note detector">
              <circle class="music-circle-guide" cx="50" cy="50" r="34"></circle>
              <circle class="music-circle-center" cx="50" cy="50" r="16"></circle>
              ${this.renderNoteNodes()}
            </svg>

            <div class="music-circle-readout">
              <p class="music-note-readout" data-music-note>--</p>
              <p class="music-frequency-readout" data-music-frequency>Enable mic to start listening.</p>
            </div>
          </div>
        </div>

        <div class="music-controls">
          <p class="music-status-copy" data-music-status>Tap ENABLE MIC, then play one clear note near the microphone.</p>
          <p class="music-hint-copy">Circle order: C, G, D, A, E, B, F#, Db, Ab, Eb, Bb, F.</p>
          <button type="button" id="musicMicBtn">ENABLE MIC</button>
        </div>
      </div>
    `;

    this.noteReadout = this.root.querySelector<HTMLParagraphElement>('[data-music-note]')!;
    this.frequencyReadout = this.root.querySelector<HTMLParagraphElement>('[data-music-frequency]')!;
    this.statusCopy = this.root.querySelector<HTMLParagraphElement>('[data-music-status]')!;
    this.micButton = this.root.querySelector<HTMLButtonElement>('#musicMicBtn')!;

    this.captureNoteNodes();
    this.micButton.addEventListener('click', options.onEnableMicrophone);
  }

  public dispose() {
    document.body.classList.remove('music-route');
    this.root.classList.remove('music-route-root');
  }

  public setMicrophoneState(phase: MusicMicrophonePhase, detail: string) {
    this.statusCopy.textContent = detail;

    switch (phase) {
      case 'starting':
        this.micButton.textContent = 'STARTING...';
        this.micButton.disabled = true;
        break;
      case 'listening':
        this.micButton.textContent = 'MIC LIVE';
        this.micButton.disabled = false;
        break;
      case 'error':
        this.micButton.textContent = 'RETRY MIC';
        this.micButton.disabled = false;
        break;
      case 'unsupported':
        this.micButton.textContent = 'MIC UNSUPPORTED';
        this.micButton.disabled = true;
        break;
      default:
        this.micButton.textContent = 'ENABLE MIC';
        this.micButton.disabled = false;
        break;
    }
  }

  public renderFrame(frame: MusicAnalysisFrame, smoothedChroma: Float32Array, isListening: boolean) {
    for (let pitchClass = 0; pitchClass < smoothedChroma.length; pitchClass += 1) {
      const node = this.noteNodes.get(pitchClass);
      if (!node) continue;

      const energy = Math.max(0, Math.min(1, smoothedChroma[pitchClass]));
      const isActive = frame.pitchClass === pitchClass;
      const scale = 1 + energy * 0.3 + (isActive ? 0.2 : 0);
      const coreRadius = 5.8 + energy * 2.8 + (isActive ? 1.2 : 0);

      node.group.setAttribute('transform', `translate(${node.x} ${node.y}) scale(${scale})`);
      node.halo.setAttribute('opacity', `${0.08 + energy * 0.72 + (isActive ? 0.12 : 0)}`);
      node.halo.setAttribute('r', `${8 + energy * 5.2 + (isActive ? 1 : 0)}`);
      node.core.setAttribute('r', `${coreRadius}`);
      node.core.setAttribute('fill', isActive ? '#ffffff' : '#1b1b1b');
      node.core.setAttribute('stroke', isActive ? '#ffffff' : '#6c6c6c');
      node.core.setAttribute('stroke-width', isActive ? '1.4' : '0.8');
      node.label.setAttribute('fill', isActive ? '#000000' : '#d8d8d8');
      node.label.setAttribute('opacity', `${0.7 + energy * 0.3}`);
    }

    if (frame.noteLabel) {
      this.noteReadout.textContent = frame.noteLabel;
      this.frequencyReadout.textContent = frame.pitchHz
        ? `${frame.pitchHz.toFixed(1)} Hz`
        : `Pitch class energy ${Math.round(frame.confidence * 100)}%`;
      return;
    }

    this.noteReadout.textContent = '--';
    this.frequencyReadout.textContent = isListening
      ? 'Listening for a steady note...'
      : 'Enable mic to start listening.';
  }

  private renderNoteNodes() {
    const radius = 34;

    return CIRCLE_OF_FIFTHS.map((note, index) => {
      const angle = (index / CIRCLE_OF_FIFTHS.length) * Math.PI * 2 - Math.PI / 2;
      const x = 50 + Math.cos(angle) * radius;
      const y = 50 + Math.sin(angle) * radius;

      return `
        <g class="music-note-node" data-note-node="${note}" data-semitone="${NOTE_TO_SEMITONE[note]}" transform="translate(${x} ${y})">
          <circle class="music-note-node-halo" r="8.2"></circle>
          <circle class="music-note-node-core" r="5.8"></circle>
          <text class="music-note-node-label" text-anchor="middle" dominant-baseline="middle">${note}</text>
        </g>
      `;
    }).join('');
  }

  private captureNoteNodes() {
    const groups = this.root.querySelectorAll<SVGGElement>('[data-note-node]');
    for (const group of groups) {
      const semitone = Number(group.dataset.semitone);
      const transform = group.getAttribute('transform') ?? 'translate(50 50)';
      const [, x = '50', y = '50'] = /translate\(([^ ]+) ([^)]+)\)/.exec(transform) ?? [];
      const halo = group.querySelector<SVGCircleElement>('.music-note-node-halo');
      const core = group.querySelector<SVGCircleElement>('.music-note-node-core');
      const label = group.querySelector<SVGTextElement>('.music-note-node-label');

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
