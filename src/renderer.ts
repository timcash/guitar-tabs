import type { Chord, FingerPosition } from './types';
import { OPEN_STRING_NOTES } from './constants';
import { getNoteName } from './audio';

export function getHorizontalSVG(
  currentChord: Chord,
  nextChord: Chord,
  activeS: number | null,
  nextActiveS: number | null,
  nextActiveChord: Chord,
  isFlippedX: boolean,
  isFlippedY: boolean
) {
  const w = window.innerWidth - 80, h = 400, margin = 60, fretCount = 12;
  const sS = (h - 2 * margin) / 5, fS = (w - 2 * margin) / fretCount;

  const getX = (fret: number) => isFlippedX ? (w - margin - (fret - 0.5) * fS) : (margin + (fret - 0.5) * fS);
  const getFretX = (fretNum: number) => isFlippedX ? (w - margin - fretNum * fS) : (margin + fretNum * fS);
  const getY = (stringNum: number) => isFlippedY ? (margin + (6 - stringNum) * sS) : (margin + (stringNum - 1) * sS);

  const renderNote = (pos: FingerPosition, color: string, isActive = false, isNext = false) => {
    if (pos.fret > fretCount) return '';
    const cx = getX(pos.fret);
    const cy = getY(pos.string);
    const note = getNoteName(pos.string, pos.fret);
    return `
      <circle cx="${cx}" cy="${cy}" r="${isActive || isNext ? 22 : 18}" fill="${color}" stroke="white" stroke-width="${isActive || isNext ? 4 : 1}" />
      <text x="${cx}" y="${cy + 7}" font-size="${isActive || isNext ? 18 : 14}" text-anchor="middle" fill="${color === '#ff9800' || color === '#ff4444' ? 'black' : 'white'}" font-weight="900">${note}</text>
    `;
  };

  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <line x1="${isFlippedX ? w - margin : margin}" y1="${margin}" x2="${isFlippedX ? w - margin : margin}" y2="${h - margin}" stroke="white" stroke-width="8" />
      ${Array.from({ length: fretCount + 1 }).map((_, i) => {
        const x = getFretX(i);
        return `
          <line x1="${x}" y1="${margin}" x2="${x}" y2="${h - margin}" stroke="#444" stroke-width="4" />
          ${i > 0 ? `<text x="${getX(i)}" y="${h - margin + 25}" fill="#666" font-size="14" text-anchor="middle" font-weight="bold">${i}</text>` : ''}
        `;
      }).join('')}
      
      ${Array.from({ length: 6 }).map((_, i) => {
        const stringNum = isFlippedY ? (6 - i) : (i + 1);
        const isActive = activeS === stringNum;
        const isNextString = nextActiveS === stringNum;
        const cy = margin + i * sS;
        const lx = isFlippedX ? w - margin + 35 : margin - 35;
        
        let labelHTML = `<text x="${lx}" y="${cy + 6}" fill="#666" font-size="16" font-weight="bold" text-anchor="middle">${OPEN_STRING_NOTES[stringNum]}</text>`;
        
        if (isActive) {
          const pos = currentChord.positions.find(p => p.string === stringNum);
          const note = getNoteName(stringNum, pos ? pos.fret : 0);
          labelHTML = `
            <circle cx="${lx}" cy="${cy}" r="22" fill="#ff9800" stroke="white" stroke-width="3" />
            <text x="${lx}" y="${cy + 7}" font-size="18" text-anchor="middle" fill="black" font-weight="900">${note}</text>
          `;
        } else if (isNextString) {
          const pos = nextActiveChord.positions.find(p => p.string === stringNum);
          const note = getNoteName(stringNum, pos ? pos.fret : 0);
          labelHTML = `
            <circle cx="${lx}" cy="${cy}" r="22" fill="#ff4444" stroke="white" stroke-width="3" />
            <text x="${lx}" y="${cy + 7}" font-size="18" text-anchor="middle" fill="black" font-weight="900">${note}</text>
          `;
        }

        return `
          <line x1="${margin}" y1="${cy}" x2="${w - margin}" y2="${cy}" stroke="${isActive ? '#ff9800' : '#888'}" stroke-width="${isActive ? 6 : 2}" />
          ${labelHTML}
        `;
      }).join('')}
      
      ${nextChord.positions.map(p => renderNote(p, '#333')).join('')}
      <!-- Current Chord (Blue) -->
      ${currentChord.positions.map(p => {
        const isPlucked = activeS === p.string;
        const isNextPluck = nextActiveS === p.string && nextActiveChord === currentChord;
        return renderNote(p, '#646cff', isPlucked, isNextPluck);
      }).join('')}

      ${nextActiveChord === nextChord ? nextActiveChord.positions.filter(p => p.string === nextActiveS).map(p => renderNote(p, '#333', false, true)).join('') : ''}

    </svg>
  `;
}
