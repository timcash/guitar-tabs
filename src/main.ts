import './style.css'
import { chordLibrary, songs } from './data';
import { audioContext, triggerPluck, getNoteLabel } from './audio';
import { FretboardRenderer } from './renderer';
import type { FallingNote } from './types';
import { calculateNoteZ, calculateNoteOpacity, calculateTimeUntilHit } from './geometry';
import { getAnimatedFingerPose, getPluckingFingerForString } from './handGeometry';
import { buildChordTimeline, getChordSegmentIndexAtTime, getChordSegmentProgress, type ChordSegment } from './chordTimeline';

// --- Session State ---
let isPlaying = false;
let isSoundEnabled = true;
let bpm = 100;
let isFlippedX = true; 

/** Flattened sequence of all notes in the song */
let fullNoteSequence: FallingNote[] = [];
let totalSongDurationMs = 0;
let chordTimeline: ChordSegment[] = [];

/** High-resolution start time for the playback loop */
let playbackStartTime = 0;
/** Accumulated time for paused states */
let pausedTimeAccumulator = 0;
/** Tracks the last triggered note index to prevent double-firing */
let lastTriggeredNoteIndex = -1;
let lastPluckTimeMs: number | null = null;
let lastPluckedString: number | null = null;

/** 3D Scene Controller */
let fretboardRenderer: FretboardRenderer | null = null;

/** Constants for Geometry (shared with renderer.ts) */
const BRIDGE_Z = 8;
const SPAWN_Z = -25;
const LOOKAHEAD_MS = 4000;

interface HandTestState {
  finger: string | null;
  stringNum: number | null;
  x: number | null;
  y: number | null;
  z: number | null;
  curl: number | null;
}

interface RuntimeTestState {
  elapsedTime: number;
  activeString: number | null;
  note0Z: number | null;
  noteCount: number;
  hand: HandTestState;
}

declare global {
  interface Window {
    __TABS_TEST_STATE__?: RuntimeTestState;
  }
}

/**
 * Pre-calculates the entire note timeline for a song based on its script and BPM.
 */
function loadSong(index: number) {
  const song = songs[index];
  const script = song.script;
  
  let timeOffset = 0;
  const pluckDuration = (60 / bpm) * 600; // Standard duration per pluck
  chordTimeline = buildChordTimeline(script, chordLibrary, pluckDuration);

  fullNoteSequence = script.flatMap((item) => {
    const chord = chordLibrary[item.chord];
    return chord.arpeggioPattern.map((stringNum) => {
      const voicingPos = chord.voicing.find(p => p.string === stringNum);
      const fret = voicingPos ? voicingPos.fret : 0;
      
      const note: FallingNote = {
        noteName: getNoteLabel(stringNum, fret),
        stringNum,
        fret,
        chordName: item.chord,
        hitTime: timeOffset,
        lyrics: item.lyrics,
        sub: item.sub,
        z_3d: 0,
        opacity: 1
      };
      
      timeOffset += pluckDuration;
      return note;
    });
  });

  totalSongDurationMs = timeOffset;
  resetPlayback();
}

/**
 * Initializes the DOM and wires up event listeners.
 */
function initApplication() {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = `
    <div class="sidebar">
      <div class="song-control">
        <label>SONG SELECTION</label>
        <select id="songSelect">
          ${songs.map((s, i) => `<option value="${i}">${s.name}</option>`).join('')}
        </select>
      </div>

      <div class="lyrics-container">
        <p class="lyrics-main" id="lyricMain"></p>
        <p class="lyrics-sub" id="lyricSub"></p>
      </div>

      <div class="controls-column">
        <div class="tempo-control">
          <label>TEMPO: <span id="tempoVal">100 BPM</span></label>
          <input type="range" id="tempoRange" min="10" max="240" value="100">
        </div>
        
        <div class="btn-group">
          <button id="playBtn" class="primary">START</button>
          <button id="resetBtn">RESET</button>
          <button id="soundBtn" class="sound-on">SOUND ON</button>
          <button id="flipXBtn">FLIP L/R</button>
          <button id="cameraBtn">TOGGLE CAMERA</button>
        </div>
      </div>
    </div>
    
    <div class="fretboard-container" id="fretboardContainer"></div>
  `;

  fretboardRenderer = new FretboardRenderer(document.getElementById('fretboardContainer')!);

  // UI Event Bindings
  document.getElementById('playBtn')?.addEventListener('click', togglePlayback);
  document.getElementById('resetBtn')?.addEventListener('click', resetPlayback);
  document.getElementById('soundBtn')?.addEventListener('click', toggleSound);
  document.getElementById('tempoRange')?.addEventListener('input', handleTempoChange);
  document.getElementById('flipXBtn')?.addEventListener('click', () => { isFlippedX = !isFlippedX; });
  document.getElementById('cameraBtn')?.addEventListener('click', () => { fretboardRenderer?.toggleCamera(); });
  
  document.getElementById('songSelect')?.addEventListener('change', (e) => {
    loadSong(parseInt((e.target as HTMLSelectElement).value));
  });

  loadSong(0);
  requestAnimationFrame(animationLoop);
}

function handleTempoChange(e: Event) {
  const target = e.target as HTMLInputElement;
  bpm = parseInt(target.value);
  document.getElementById('tempoVal')!.textContent = `${bpm} BPM`;
  
  // Recalculate timeline with new BPM
  let timeOffset = 0;
  const pluckDuration = (60 / bpm) * 600;
  const selectedSongIndex = parseInt((document.getElementById('songSelect') as HTMLSelectElement).value);
  chordTimeline = buildChordTimeline(songs[selectedSongIndex].script, chordLibrary, pluckDuration);
  
  fullNoteSequence.forEach(note => {
    note.hitTime = timeOffset;
    timeOffset += pluckDuration;
  });
  totalSongDurationMs = timeOffset;
}

/**
 * Main game loop called by requestAnimationFrame.
 */
function animationLoop() {
  const currentTime = isPlaying 
    ? performance.now() - playbackStartTime 
    : pausedTimeAccumulator;
    
  updateFrame(currentTime);
  requestAnimationFrame(animationLoop);
}

/**
 * Updates the logical state and triggers 3D renders for a specific point in time.
 */
function updateFrame(elapsedTime: number) {
  if (totalSongDurationMs === 0 || !fretboardRenderer) return;
  
  const loopTime = elapsedTime % totalSongDurationMs;
  
  // Geometry parameters for sync
  const params = { bridgeZ: BRIDGE_Z, spawnZ: SPAWN_Z, lookAheadMs: LOOKAHEAD_MS };

  // Identify current note in the timeline
  let currentIndex = fullNoteSequence.findIndex(n => n.hitTime > loopTime) - 1;
  if (currentIndex < 0) currentIndex = fullNoteSequence.length - 1;
  
  const currentNote = fullNoteSequence[currentIndex];
  const chordSegmentIndex = getChordSegmentIndexAtTime(chordTimeline, loopTime);
  const currentChordSegment = chordTimeline[chordSegmentIndex];
  const nextChordSegment = chordTimeline[(chordSegmentIndex + 1) % chordTimeline.length];
  const chordProgress = getChordSegmentProgress(currentChordSegment, loopTime);
  const nextChordProgress = Math.max(0, Math.min(1, (chordProgress - 0.62) / 0.38));
  const nextNoteIndex = (currentIndex + 1) % fullNoteSequence.length;
  const upcomingNote = fullNoteSequence[nextNoteIndex];
  const timeUntilUpcomingPluckMs = calculateTimeUntilHit(upcomingNote.hitTime, loopTime, totalSongDurationMs);
  
  // Audio & Haptic Trigger Logic
  if (isPlaying) {
    const pluckDuration = (60 / bpm) * 600;
    const globalPluckIndex = Math.floor(elapsedTime / pluckDuration);
    
    if (globalPluckIndex !== lastTriggeredNoteIndex) {
      const noteToTrigger = fullNoteSequence[globalPluckIndex % fullNoteSequence.length];
      triggerPluck(noteToTrigger.stringNum, noteToTrigger.fret, isSoundEnabled);
      fretboardRenderer.triggerExplosion(noteToTrigger.stringNum, noteToTrigger.noteName);
      fretboardRenderer.triggerHandPluck(noteToTrigger.stringNum, elapsedTime);
      lastPluckTimeMs = elapsedTime;
      lastPluckedString = noteToTrigger.stringNum;
      lastTriggeredNoteIndex = globalPluckIndex;
    }
  }

  // Process Notes in Flight
  const fallingNotes: FallingNote[] = [];
  for (const n of fullNoteSequence) {
    const timeUntilHit = calculateTimeUntilHit(n.hitTime, loopTime, totalSongDurationMs);
    
    if (timeUntilHit < LOOKAHEAD_MS) {
      n.z_3d = calculateNoteZ(timeUntilHit, params);
      n.opacity = calculateNoteOpacity(timeUntilHit, params);
      fallingNotes.push(n);
    }
  }

  let handState: HandTestState = {
    finger: null,
    stringNum: null,
    x: null,
    y: null,
    z: null,
    curl: null
  };

  if (lastPluckedString !== null) {
    const finger = getPluckingFingerForString(lastPluckedString);
    const pose = getAnimatedFingerPose(
      finger,
      lastPluckedString,
      isFlippedX,
      lastPluckTimeMs === null ? null : elapsedTime - lastPluckTimeMs
    );

    handState = {
      finger,
      stringNum: lastPluckedString,
      x: pose.x,
      y: pose.y,
      z: pose.z,
      curl: pose.curl
    };
  }

  window.__TABS_TEST_STATE__ = {
    elapsedTime,
    activeString: currentNote.stringNum,
    note0Z: fallingNotes.length > 0 ? Math.max(...fallingNotes.map((note) => note.z_3d)) : null,
    noteCount: fallingNotes.length,
    hand: handState
  };

  // --- Testability: Log some positions periodically when playing ---
  if (isPlaying && Math.floor(elapsedTime / 200) !== Math.floor((elapsedTime - 16) / 200)) {
     if (fallingNotes.length > 0) {
        console.log(`TEST_GEOM: time=${elapsedTime.toFixed(0)} note0_z=${fallingNotes[0].z_3d.toFixed(2)}`);
     }
     if (handState.finger && handState.x !== null && handState.curl !== null) {
        console.log(
          `TEST_HAND: time=${elapsedTime.toFixed(0)} finger=${handState.finger} string=${handState.stringNum} x=${handState.x.toFixed(2)} curl=${handState.curl.toFixed(2)}`
        );
     }
  }

  const lyricMain = document.getElementById('lyricMain');
  const lyricSub = document.getElementById('lyricSub');
  
  if (lyricMain) lyricMain.textContent = currentNote.lyrics;
  if (lyricSub) lyricSub.textContent = currentNote.sub;

  const currentChordDef = chordLibrary[currentChordSegment.chordName];
  fretboardRenderer.renderFrame(
    currentChordDef,
    currentChordSegment.chordName,
    nextChordSegment.chordName,
    nextChordProgress,
    currentNote.stringNum,
    upcomingNote.stringNum,
    timeUntilUpcomingPluckMs,
    fallingNotes,
    isFlippedX,
    elapsedTime
  );
}

function togglePlayback() {
  if (audioContext.state === 'suspended') audioContext.resume();
  isPlaying = !isPlaying;
  const btn = document.getElementById('playBtn');
  if (btn) btn.textContent = isPlaying ? "PAUSE" : "RESUME";
  
  if (isPlaying) {
    playbackStartTime = performance.now() - pausedTimeAccumulator;
  } else {
    pausedTimeAccumulator = performance.now() - playbackStartTime;
  }
}

function toggleSound() {
  isSoundEnabled = !isSoundEnabled;
  const btn = document.getElementById('soundBtn');
  if (btn) {
    btn.textContent = isSoundEnabled ? "SOUND ON" : "SOUND OFF";
    btn.className = isSoundEnabled ? "sound-on" : "";
  }
}

function resetPlayback() {
  isPlaying = false;
  pausedTimeAccumulator = 0;
  lastTriggeredNoteIndex = -1;
  lastPluckTimeMs = null;
  lastPluckedString = null;
  const btn = document.getElementById('playBtn');
  if (btn) btn.textContent = "START";
  updateFrame(0);
}

// Boot the app
initApplication();

// Handle browser window resizing
window.onresize = () => {
  const currentTime = isPlaying ? performance.now() - playbackStartTime : pausedTimeAccumulator;
  updateFrame(currentTime);
};
