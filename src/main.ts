import './style.css'
import { chordLibrary, songs } from './data';
import { audioCtx, playNote, getNoteName } from './audio';
import { getHorizontalSVG } from './renderer';

let currentSongIndex = 0;
let currentIndex = 0;
let currentPluck = 0;
let isPlaying = false;
let isSoundOn = true;
let bpm = 100;
let timer: number | null = null;
let isFlippedX = true; 
let isFlippedY = true;

let baseNoteSequence: any[] = [];
let fullNoteSequence: any[] = [];

function loadSong(index: number) {
  currentSongIndex = index;
  const script = songs[index].script;
  
  baseNoteSequence = script.flatMap((item, scriptIdx) => {
    const chord = chordLibrary[item.chord];
    return chord.pluckPattern.map((stringNum, pluckIdx) => {
      const pos = chord.positions.find(p => p.string === stringNum);
      const fret = pos ? pos.fret : 0;
      return {
        note: getNoteName(stringNum, fret),
        stringNum,
        fret,
        scriptIdx,
        pluckIdx,
        chordName: item.chord
      };
    });
  });

  fullNoteSequence = [...baseNoteSequence, ...baseNoteSequence, ...baseNoteSequence];
  reset();
}

const app = document.querySelector<HTMLDivElement>('#app')!;

function init() {
  app.innerHTML = `
    <div class="song-control">
      <label>SONG</label>
      <select id="songSelect">
        ${songs.map((s, i) => `<option value="${i}">${s.name}</option>`).join('')}
      </select>
    </div>
    <div class="lyrics-container">
      <p class="lyrics-main" id="lyricMain"></p>
      <p class="lyrics-sub" id="lyricSub"></p>
    </div>
    <div class="fretboard-container">
      <div class="note-stream-container">
        <div id="noteTrack" class="note-stream-track"></div>
      </div>
      <div class="chord-display-row">
        <div id="chordTitle" class="chord-title-top"></div>
        <div class="chord-arrow">→</div>
        <div id="futureChords" class="future-chords-list"></div>
      </div>
      <div id="svgContainer"></div>
    </div>
    <div class="controls-row">
      <div class="tempo-control">
        <label>TEMPO:</label>
        <input type="range" id="tempoRange" min="10" max="240" value="100">
        <span class="tempo-val" id="tempoVal">100 BPM</span>
      </div>
      <div class="btn-group">
        <button id="playBtn" class="primary">START</button>
        <button id="resetBtn">RESET</button>
        <button id="soundBtn" class="sound-on">SOUND ON</button>
        <button id="flipXBtn">FLIP L/R</button>
        <button id="flipYBtn">FLIP U/D</button>
      </div>
    </div>
  `;

  document.getElementById('playBtn')?.addEventListener('click', toggle);
  document.getElementById('resetBtn')?.addEventListener('click', reset);
  document.getElementById('soundBtn')?.addEventListener('click', toggleSound);
  document.getElementById('tempoRange')?.addEventListener('input', updateTempo);
  document.getElementById('flipXBtn')?.addEventListener('click', () => { isFlippedX = !isFlippedX; update(); });
  document.getElementById('flipYBtn')?.addEventListener('click', () => { isFlippedY = !isFlippedY; update(); });
  
  document.getElementById('songSelect')?.addEventListener('change', (e) => {
    loadSong(parseInt((e.target as HTMLSelectElement).value));
  });

  loadSong(0);
}

function updateTempo(e: Event) {
  const target = e.target as HTMLInputElement;
  bpm = parseInt(target.value);
  document.getElementById('tempoVal')!.textContent = `${bpm} BPM`;
  if (isPlaying) { stopTimer(); startTimer(); }
}

function startTimer() {
  timer = window.setInterval(() => {
    currentPluck++;
    const script = songs[currentSongIndex].script;
    const chord = chordLibrary[script[currentIndex].chord];
    if (currentPluck >= chord.pluckPattern.length) {
      currentPluck = 0;
      currentIndex = (currentIndex + 1) % script.length;
    }
    update();
  }, (60 / bpm) * 600);
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function update() {
  const script = songs[currentSongIndex].script;
  const item = script[currentIndex];
  const nextItem = script[(currentIndex + 1) % script.length];
  const chord = chordLibrary[item.chord];
  const nextChord = chordLibrary[nextItem.chord];
  const activeS = chord.pluckPattern[currentPluck];

  // Global Flattened Index
  let baseIndex = 0;
  for (let i = 0; i < currentIndex; i++) {
    baseIndex += chordLibrary[script[i].chord].pluckPattern.length;
  }
  const globalNoteIndex = baseIndex + currentPluck;

  // Next Pluck Logic
  let nextActiveS: number | null = null;
  let nextActiveChord = chord;
  if (currentPluck + 1 < chord.pluckPattern.length) {
    nextActiveS = chord.pluckPattern[currentPluck + 1];
  } else {
    nextActiveS = nextChord.pluckPattern[0];
    nextActiveChord = nextChord;
  }

  // Update UI Text
  document.getElementById('lyricMain')!.textContent = item.lyrics;
  document.getElementById('lyricSub')!.textContent = item.sub;
  document.getElementById('chordTitle')!.textContent = chord.name;

  const futureChords: string[] = [];
  let lastFound = item.chord;
  for (let i = 1; i < script.length; i++) {
    const checkIdx = (currentIndex + i) % script.length;
    const checkChord = script[checkIdx].chord;
    if (checkChord !== lastFound) {
      futureChords.push(checkChord);
      lastFound = checkChord;
      if (futureChords.length >= 3) break;
    }
  }
  
  const futureEl = document.getElementById('futureChords')!;
  futureEl.innerHTML = futureChords.map((c, i) => `
    ${i > 0 ? '<span class="chord-arrow">→</span>' : ''}
    <span class="chord-title-future">${c}</span>
  `).join('');
  
  (document.querySelector('.chord-arrow') as HTMLElement).style.opacity = futureChords.length > 0 ? "1" : "0";

  const pos = chord.positions.find(p => p.string === activeS);
  const fret = pos ? pos.fret : 0;

  document.getElementById('svgContainer')!.innerHTML = getHorizontalSVG(
    chord, 
    nextChord, 
    activeS, 
    nextActiveS, 
    nextActiveChord,
    isFlippedX,
    isFlippedY
  );

  // Update Note Stream
  const track = document.getElementById('noteTrack')!;
  track.innerHTML = fullNoteSequence.map((n, i) => `
    <div class="stream-note future" id="stream-note-${i}">${n.note}</div>
  `).join('');

  const noteWidth = 64; 
  track.style.transform = `translateX(-${globalNoteIndex * noteWidth}px)`;

  fullNoteSequence.forEach((_, i) => {
    const el = document.getElementById(`stream-note-${i}`);
    if (!el) return;
    el.className = 'stream-note';
    if (i === globalNoteIndex) {
      el.classList.add('current');
      el.style.opacity = '1';
    } else if (i === globalNoteIndex + 1) {
      el.classList.add('next');
      el.style.opacity = '1';
    } else if (i > globalNoteIndex && i < globalNoteIndex + 20) {
      el.classList.add('future');
      el.style.opacity = (1 - (i - globalNoteIndex) / 20).toString();
    } else {
      el.style.opacity = '0';
    }
  });

  if (isPlaying) playNote(activeS, fret, isSoundOn);
}

function toggle() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  isPlaying = !isPlaying;
  document.getElementById('playBtn')!.textContent = isPlaying ? "PAUSE" : "RESUME";
  if (isPlaying) startTimer(); else stopTimer();
}

function toggleSound() {
  isSoundOn = !isSoundOn;
  const btn = document.getElementById('soundBtn')!;
  btn.textContent = isSoundOn ? "SOUND ON" : "SOUND OFF";
  btn.className = isSoundOn ? "sound-on" : "";
}

function reset() {
  isPlaying = false;
  stopTimer();
  currentIndex = 0;
  currentPluck = 0;
  document.getElementById('playBtn')!.textContent = "START";
  update();
}

init();
window.onresize = update;
