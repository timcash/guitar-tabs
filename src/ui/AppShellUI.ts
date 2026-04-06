import { PlaybackNoteCircleOverlay } from '../music/PlaybackNoteCircleOverlay';
import type { SongData } from '../types';
import type { PwaInstallUiState } from '../pwa/PwaInstallController';

export interface AppShellHandlers {
  onSongSelected: (index: number) => void;
  onTempoChanged: (bpm: number) => void;
  onTogglePlayback: () => void;
  onResetPlayback: () => void;
  onToggleSound: () => void;
  onToggleFlipX: () => void;
  onToggleCamera: () => void;
  onInstallApp: () => void;
  onDismissInstallHelp: () => void;
}

export class AppShellUI {
  private readonly root: HTMLDivElement;
  private readonly playerShell: HTMLDivElement;
  private readonly songSelect: HTMLSelectElement;
  private readonly lyricMain: HTMLParagraphElement;
  private readonly lyricSub: HTMLParagraphElement;
  private readonly tempoVal: HTMLSpanElement;
  private readonly tempoRange: HTMLInputElement;
  private readonly playBtn: HTMLButtonElement;
  private readonly menuBtn: HTMLButtonElement;
  private readonly menuCloseBtn: HTMLButtonElement;
  private readonly menuOverlay: HTMLDivElement;
  private readonly resetBtn: HTMLButtonElement;
  private readonly soundBtn: HTMLButtonElement;
  private readonly flipXBtn: HTMLButtonElement;
  private readonly cameraBtn: HTMLButtonElement;
  private readonly installBtn: HTMLButtonElement;
  private readonly installHelp: HTMLDivElement;
  private readonly installHelpTitle: HTMLParagraphElement;
  private readonly installHelpBody: HTMLParagraphElement;
  private readonly installHelpSteps: HTMLOListElement;
  private readonly installHelpCloseBtn: HTMLButtonElement;
  private readonly fretboardContainer: HTMLDivElement;
  private readonly playbackNoteCircle: PlaybackNoteCircleOverlay;

  constructor(root: HTMLDivElement, songs: SongData[]) {
    this.root = root;
    this.root.innerHTML = this.renderMarkup(songs);

    this.playerShell = this.root.querySelector<HTMLDivElement>('.player-shell')!;
    this.songSelect = this.root.querySelector<HTMLSelectElement>('#songSelect')!;
    this.lyricMain = this.root.querySelector<HTMLParagraphElement>('#lyricMain')!;
    this.lyricSub = this.root.querySelector<HTMLParagraphElement>('#lyricSub')!;
    this.tempoVal = this.root.querySelector<HTMLSpanElement>('#tempoVal')!;
    this.tempoRange = this.root.querySelector<HTMLInputElement>('#tempoRange')!;
    this.playBtn = this.root.querySelector<HTMLButtonElement>('#playBtn')!;
    this.menuBtn = this.root.querySelector<HTMLButtonElement>('#menuBtn')!;
    this.menuCloseBtn = this.root.querySelector<HTMLButtonElement>('#menuCloseBtn')!;
    this.menuOverlay = this.root.querySelector<HTMLDivElement>('#menuOverlay')!;
    this.resetBtn = this.root.querySelector<HTMLButtonElement>('#resetBtn')!;
    this.soundBtn = this.root.querySelector<HTMLButtonElement>('#soundBtn')!;
    this.flipXBtn = this.root.querySelector<HTMLButtonElement>('#flipXBtn')!;
    this.cameraBtn = this.root.querySelector<HTMLButtonElement>('#cameraBtn')!;
    this.installBtn = this.root.querySelector<HTMLButtonElement>('#installBtn')!;
    this.installHelp = this.root.querySelector<HTMLDivElement>('#installHelp')!;
    this.installHelpTitle = this.root.querySelector<HTMLParagraphElement>('#installHelpTitle')!;
    this.installHelpBody = this.root.querySelector<HTMLParagraphElement>('#installHelpBody')!;
    this.installHelpSteps = this.root.querySelector<HTMLOListElement>('#installHelpSteps')!;
    this.installHelpCloseBtn = this.root.querySelector<HTMLButtonElement>('#installHelpCloseBtn')!;
    this.fretboardContainer = this.root.querySelector<HTMLDivElement>('#fretboardContainer')!;
    this.playbackNoteCircle = new PlaybackNoteCircleOverlay(
      this.root.querySelector<HTMLDivElement>('#playerNoteCircleOverlay')!
    );

    this.menuBtn.addEventListener('click', this.openMenu);
    this.menuCloseBtn.addEventListener('click', this.closeMenu);
    this.menuOverlay.addEventListener('click', this.handleOverlayClick);
    window.addEventListener('keydown', this.handleWindowKeydown);
  }

  public bindHandlers(handlers: AppShellHandlers) {
    this.playBtn.addEventListener('click', handlers.onTogglePlayback);
    this.resetBtn.addEventListener('click', handlers.onResetPlayback);
    this.soundBtn.addEventListener('click', handlers.onToggleSound);
    this.flipXBtn.addEventListener('click', handlers.onToggleFlipX);
    this.cameraBtn.addEventListener('click', handlers.onToggleCamera);
    this.installBtn.addEventListener('click', handlers.onInstallApp);
    this.installHelpCloseBtn.addEventListener('click', handlers.onDismissInstallHelp);

    this.tempoRange.addEventListener('input', () => {
      handlers.onTempoChanged(parseInt(this.tempoRange.value, 10));
    });

    this.songSelect.addEventListener('change', () => {
      handlers.onSongSelected(parseInt(this.songSelect.value, 10));
    });
  }

  public getFretboardContainer() {
    return this.fretboardContainer;
  }

  public setSelectedSongIndex(index: number) {
    this.songSelect.value = `${index}`;
  }

  public setTempo(bpm: number) {
    this.tempoVal.textContent = `${bpm} BPM`;
    this.tempoRange.value = `${bpm}`;
  }

  public setPlaybackButtonLabel(label: string) {
    this.playBtn.textContent = label;
  }

  public setSoundEnabled(isSoundEnabled: boolean) {
    this.soundBtn.textContent = isSoundEnabled ? 'SOUND ON' : 'SOUND OFF';
    this.soundBtn.className = isSoundEnabled ? 'sound-on' : '';
  }

  public setLyrics(main: string, sub: string) {
    this.lyricMain.textContent = main;
    this.lyricSub.textContent = sub;
  }

  public setPlaybackPitchClass(pitchClass: number | null, intensity: number) {
    this.playbackNoteCircle.setActivePitchClass(pitchClass, intensity);
  }

  public setInstallUiState(state: PwaInstallUiState) {
    this.installBtn.textContent = state.buttonLabel;
    this.installBtn.disabled = state.buttonDisabled;
    this.installHelp.hidden = !state.helpVisible;
    this.installHelpTitle.textContent = state.helpTitle;
    this.installHelpBody.textContent = state.helpBody;
    this.installHelpSteps.innerHTML = state.helpSteps.map((step) => `<li>${step}</li>`).join('');
  }

  private readonly openMenu = () => {
    this.playerShell.classList.add('menu-open');
    this.menuOverlay.setAttribute('aria-hidden', 'false');
  };

  private readonly closeMenu = () => {
    this.playerShell.classList.remove('menu-open');
    this.menuOverlay.setAttribute('aria-hidden', 'true');
  };

  private readonly handleOverlayClick = (event: MouseEvent) => {
    if (event.target === this.menuOverlay) {
      this.closeMenu();
    }
  };

  private readonly handleWindowKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.closeMenu();
    }
  };

  private renderMarkup(songs: SongData[]) {
    return `
      <div class="player-shell">
        <div class="fretboard-container" id="fretboardContainer"></div>
        <div class="player-note-circle-overlay" id="playerNoteCircleOverlay" aria-hidden="true"></div>

        <div class="player-stage-overlay">
          <div class="player-top-copy">
            <div class="lyrics-container">
              <p class="lyrics-main" id="lyricMain"></p>
              <p class="lyrics-sub" id="lyricSub"></p>
            </div>
          </div>

          <div class="player-bottom-bar">
            <button id="playBtn" class="primary">START</button>
            <button id="menuBtn">MENU</button>
          </div>
        </div>

        <div class="menu-overlay" id="menuOverlay" aria-hidden="true">
          <div class="menu-panel">
            <div class="menu-toolbar">
              <button id="menuCloseBtn">CLOSE</button>
            </div>

            <div class="menu-scroll">
              <div class="menu-group">
                <label for="songSelect">SONG</label>
                <select id="songSelect">
                  ${songs.map((song, index) => `<option value="${index}">${song.name}</option>`).join('')}
                </select>
              </div>

              <div class="menu-group">
                <label for="tempoRange">TEMPO <span id="tempoVal">100 BPM</span></label>
                <input type="range" id="tempoRange" min="10" max="240" value="100">
              </div>

              <div class="btn-group">
                <button id="resetBtn">RESET</button>
                <button id="soundBtn" class="sound-on">SOUND ON</button>
                <button id="flipXBtn">FLIP L/R</button>
                <button id="cameraBtn">CAMERA VIEW</button>
                <button id="installBtn">ADD TO HOME SCREEN</button>
              </div>

              <div class="menu-group install-help" id="installHelp" hidden>
                <div class="install-help-card">
                  <p class="install-help-title" id="installHelpTitle">Add To Home Screen</p>
                  <p class="install-help-body" id="installHelpBody"></p>
                  <ol class="install-help-steps" id="installHelpSteps"></ol>
                  <button id="installHelpCloseBtn">OK</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
