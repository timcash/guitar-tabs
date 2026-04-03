import { audioPluckEngine, type AudioPluckEngine } from '../audio/AudioPluckEngine';
import { getChordSegmentIndexAtTime, getChordSegmentProgress } from '../chordTimeline';
import { chordLibrary, songs } from '../data';
import { SongSession } from '../domain/session/SongSession';
import { calculateNoteOpacity, calculateNoteZ, calculateTimeUntilHit } from '../geometry';
import { getAnimatedFingerPose, getPluckingFingerForString } from '../handGeometry';
import { PlaybackTransport } from '../playback/PlaybackTransport';
import { PwaInstallController } from '../pwa/PwaInstallController';
import { FretboardRenderer } from '../renderer';
import { RuntimeTestBridge, type HandTestState } from '../testing/RuntimeTestBridge';
import type { FallingNote } from '../types';
import { AppShellUI } from '../ui/AppShellUI';

const BRIDGE_Z = 8;
const SPAWN_Z = -25;
const LOOKAHEAD_MS = 4000;

export class GuitarTabsApp {
  private readonly pluckEngine: AudioPluckEngine;
  private readonly ui: AppShellUI;
  private readonly renderer: FretboardRenderer;
  private readonly playbackTransport = new PlaybackTransport();
  private readonly songSession = new SongSession(songs, chordLibrary);
  private readonly runtimeTestBridge = new RuntimeTestBridge();
  private readonly pwaInstallController = new PwaInstallController();

  private isSoundEnabled = true;
  private isFlippedX = true;
  private lastTriggeredNoteIndex = -1;
  private lastPluckTimeMs: number | null = null;
  private lastPluckedString: number | null = null;

  constructor(root: HTMLDivElement, pluckEngine: AudioPluckEngine = audioPluckEngine) {
    this.pluckEngine = pluckEngine;
    this.ui = new AppShellUI(root, songs);
    this.renderer = new FretboardRenderer(this.ui.getFretboardContainer());

    this.ui.bindHandlers({
      onSongSelected: this.handleSongSelected,
      onTempoChanged: this.handleTempoChanged,
      onTogglePlayback: this.handleTogglePlayback,
      onResetPlayback: this.resetPlayback,
      onToggleSound: this.handleToggleSound,
      onToggleFlipX: this.handleToggleFlipX,
      onToggleCamera: this.handleToggleCamera,
      onInstallApp: this.handleInstallApp,
      onDismissInstallHelp: this.handleDismissInstallHelp
    });
    this.pwaInstallController.subscribe((state) => this.ui.setInstallUiState(state));

    this.songSession.loadSong(0);
    this.ui.setSelectedSongIndex(this.songSession.selectedSongIndex);
    this.ui.setTempo(this.songSession.bpm);
    this.ui.setSoundEnabled(this.isSoundEnabled);
    this.resetPlayback();

    window.addEventListener('resize', this.handleWindowResize);
  }

  public start() {
    requestAnimationFrame(this.animationLoop);
  }

  private readonly handleSongSelected = (index: number) => {
    this.songSession.loadSong(index);
    this.ui.setSelectedSongIndex(index);
    this.resetPlayback();
  };

  private readonly handleTempoChanged = (bpm: number) => {
    this.songSession.setTempo(bpm);
    this.ui.setTempo(this.songSession.bpm);
    this.renderCurrentFrame();
  };

  private readonly handleTogglePlayback = () => {
    this.pluckEngine.resume();
    const isPlaying = this.playbackTransport.toggle();
    this.ui.setPlaybackButtonLabel(isPlaying ? 'PAUSE' : 'RESUME');
  };

  private readonly handleToggleSound = () => {
    this.isSoundEnabled = !this.isSoundEnabled;
    this.ui.setSoundEnabled(this.isSoundEnabled);
  };

  private readonly handleToggleFlipX = () => {
    this.isFlippedX = !this.isFlippedX;
    this.renderCurrentFrame();
  };

  private readonly handleToggleCamera = () => {
    this.renderer.toggleCamera();
    this.renderCurrentFrame();
  };

  private readonly handleInstallApp = () => {
    void this.pwaInstallController.requestInstall();
  };

  private readonly handleDismissInstallHelp = () => {
    this.pwaInstallController.dismissHelp();
  };

  private readonly handleWindowResize = () => {
    this.renderCurrentFrame();
  };

  private readonly animationLoop = () => {
    this.updateFrame(this.playbackTransport.getElapsedTime());
    requestAnimationFrame(this.animationLoop);
  };

  private readonly resetPlayback = () => {
    this.playbackTransport.reset();
    this.lastTriggeredNoteIndex = -1;
    this.lastPluckTimeMs = null;
    this.lastPluckedString = null;
    this.ui.setPlaybackButtonLabel('START');
    this.renderCurrentFrame();
  };

  private renderCurrentFrame() {
    this.updateFrame(this.playbackTransport.getElapsedTime());
  }

  private updateFrame(elapsedTime: number) {
    const { totalSongDurationMs, fullNoteSequence, chordTimeline } = this.songSession;
    if (totalSongDurationMs === 0 || fullNoteSequence.length === 0 || chordTimeline.length === 0) return;

    const loopTime = elapsedTime % totalSongDurationMs;
    const noteGeometryParams = { bridgeZ: BRIDGE_Z, spawnZ: SPAWN_Z, lookAheadMs: LOOKAHEAD_MS };

    let currentIndex = fullNoteSequence.findIndex((note) => note.hitTime > loopTime) - 1;
    if (currentIndex < 0) currentIndex = fullNoteSequence.length - 1;

    const activeSlidingNote = fullNoteSequence[currentIndex];
    const chordSegmentIndex = getChordSegmentIndexAtTime(chordTimeline, loopTime);
    const activeChordSegment = chordTimeline[chordSegmentIndex];
    const incomingChordSegment = chordTimeline[(chordSegmentIndex + 1) % chordTimeline.length];
    const chordProgress = getChordSegmentProgress(activeChordSegment, loopTime);
    const incomingChordProgress = Math.max(0, Math.min(1, (chordProgress - 0.62) / 0.38));
    const nextNoteIndex = (currentIndex + 1) % fullNoteSequence.length;
    const upcomingSlidingNote = fullNoteSequence[nextNoteIndex];
    const timeUntilUpcomingPluckMs = calculateTimeUntilHit(
      upcomingSlidingNote.hitTime,
      loopTime,
      totalSongDurationMs
    );

    this.triggerPluckEffects(elapsedTime, fullNoteSequence);

    const slidingNotes = this.buildSlidingNotes(
      fullNoteSequence,
      loopTime,
      totalSongDurationMs,
      noteGeometryParams
    );
    const handState = this.buildHandTestState(elapsedTime);

    this.runtimeTestBridge.publish({
      elapsedTime,
      activeString: activeSlidingNote.stringNum,
      note0Z: slidingNotes.length > 0 ? Math.max(...slidingNotes.map((note) => note.z_3d)) : null,
      noteCount: slidingNotes.length,
      hand: handState
    });

    this.logTestState(elapsedTime, slidingNotes, handState);
    this.ui.setLyrics(activeSlidingNote.lyrics, activeSlidingNote.sub);

    const activeChordDefinition = chordLibrary[activeChordSegment.chordName];
    this.renderer.renderFrame(
      activeChordDefinition,
      activeChordSegment.chordName,
      incomingChordSegment.chordName,
      incomingChordProgress,
      activeSlidingNote.stringNum,
      upcomingSlidingNote.stringNum,
      timeUntilUpcomingPluckMs,
      slidingNotes,
      this.isFlippedX,
      elapsedTime
    );
  }

  private triggerPluckEffects(elapsedTime: number, fullNoteSequence: FallingNote[]) {
    if (!this.playbackTransport.isPlaying) return;

    const pluckDuration = this.songSession.getPluckDurationMs();
    const globalPluckIndex = Math.floor(elapsedTime / pluckDuration);
    if (globalPluckIndex === this.lastTriggeredNoteIndex) return;

    const noteToTrigger = fullNoteSequence[globalPluckIndex % fullNoteSequence.length];
    this.pluckEngine.triggerPluck(noteToTrigger.stringNum, noteToTrigger.fret, this.isSoundEnabled);
    this.renderer.triggerExplosion(noteToTrigger.stringNum, noteToTrigger.noteName);
    this.renderer.triggerHandPluck(noteToTrigger.stringNum, elapsedTime);
    this.lastPluckTimeMs = elapsedTime;
    this.lastPluckedString = noteToTrigger.stringNum;
    this.lastTriggeredNoteIndex = globalPluckIndex;
  }

  private buildSlidingNotes(
    fullNoteSequence: FallingNote[],
    loopTime: number,
    totalSongDurationMs: number,
    noteGeometryParams: { bridgeZ: number; spawnZ: number; lookAheadMs: number }
  ) {
    const slidingNotes: FallingNote[] = [];

    for (const note of fullNoteSequence) {
      const timeUntilHit = calculateTimeUntilHit(note.hitTime, loopTime, totalSongDurationMs);
      if (timeUntilHit >= LOOKAHEAD_MS) continue;

      note.z_3d = calculateNoteZ(timeUntilHit, noteGeometryParams);
      note.opacity = calculateNoteOpacity(timeUntilHit, noteGeometryParams);
      slidingNotes.push(note);
    }

    return slidingNotes;
  }

  private buildHandTestState(elapsedTime: number): HandTestState {
    if (this.lastPluckedString === null) {
      return {
        finger: null,
        stringNum: null,
        x: null,
        y: null,
        z: null,
        curl: null
      };
    }

    const finger = getPluckingFingerForString(this.lastPluckedString);
    const pose = getAnimatedFingerPose(
      finger,
      this.lastPluckedString,
      this.isFlippedX,
      this.lastPluckTimeMs === null ? null : elapsedTime - this.lastPluckTimeMs
    );

    return {
      finger,
      stringNum: this.lastPluckedString,
      x: pose.x,
      y: pose.y,
      z: pose.z,
      curl: pose.curl
    };
  }

  private logTestState(elapsedTime: number, slidingNotes: FallingNote[], handState: HandTestState) {
    if (!this.playbackTransport.isPlaying) return;
    if (Math.floor(elapsedTime / 200) === Math.floor((elapsedTime - 16) / 200)) return;

    if (slidingNotes.length > 0) {
      console.log(`TEST_GEOM: time=${elapsedTime.toFixed(0)} note0_z=${slidingNotes[0].z_3d.toFixed(2)}`);
    }

    if (handState.finger && handState.x !== null && handState.curl !== null) {
      console.log(
        `TEST_HAND: time=${elapsedTime.toFixed(0)} finger=${handState.finger} string=${handState.stringNum} x=${handState.x.toFixed(2)} curl=${handState.curl.toFixed(2)}`
      );
    }
  }
}
