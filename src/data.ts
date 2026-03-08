import type { Chord, ScriptItem } from './types';

export const chordLibrary: Record<string, Chord> = {
  'Am': { name: 'Am', positions: [{ string: 2, fret: 1, finger: 1 }, { string: 4, fret: 2, finger: 2 }, { string: 3, fret: 2, finger: 3 }], pluckPattern: [5, 4, 3, 2, 3, 4] },
  'Dm': { name: 'Dm', positions: [{ string: 1, fret: 1, finger: 1 }, { string: 3, fret: 2, finger: 2 }, { string: 2, fret: 3, finger: 3 }], pluckPattern: [4, 3, 2, 1, 2, 3] },
  'C': { name: 'C', positions: [{ string: 2, fret: 1, finger: 1 }, { string: 4, fret: 2, finger: 2 }, { string: 5, fret: 3, finger: 3 }], pluckPattern: [5, 4, 3, 2, 3, 4] },
  'F': { name: 'F', positions: [{ string: 1, fret: 1, finger: 1 }, { string: 2, fret: 1, finger: 1 }, { string: 3, fret: 2, finger: 2 }, { string: 4, fret: 3, finger: 3 }], pluckPattern: [4, 3, 2, 1, 2, 3] },
  'E': { name: 'E', positions: [{ string: 3, fret: 1, finger: 1 }, { string: 5, fret: 2, finger: 2 }, { string: 4, fret: 2, finger: 3 }], pluckPattern: [6, 5, 4, 3, 4, 5] },
  'G': { name: 'G', positions: [{ string: 5, fret: 2, finger: 1 }, { string: 6, fret: 3, finger: 2 }, { string: 1, fret: 3, finger: 3 }], pluckPattern: [6, 5, 4, 3, 4, 5] },
  'D': { name: 'D', positions: [{ string: 3, fret: 2, finger: 1 }, { string: 1, fret: 2, finger: 2 }, { string: 2, fret: 3, finger: 3 }], pluckPattern: [4, 3, 2, 1, 2, 3] }
};

export const wellermanScript: ScriptItem[] = [
  { chord: 'Am', lyrics: "There once was a ship", sub: "that put to sea" },
  { chord: 'Am', lyrics: "There once was a ship", sub: "that put to sea" },
  { chord: 'Dm', lyrics: "The name of the ship", sub: "was the Billy of Tea" },
  { chord: 'Am', lyrics: "The name of the ship", sub: "was the Billy of Tea" },
  { chord: 'Am', lyrics: "The winds blew up,", sub: "her bow dipped down" },
  { chord: 'Am', lyrics: "The winds blew up,", sub: "her bow dipped down" },
  { chord: 'E', lyrics: "Oh blow, my bully boys,", sub: "blow (HUH!)" },
  { chord: 'Am', lyrics: "Oh blow, my bully boys,", sub: "blow (HUH!)" },
  { chord: 'F', lyrics: "Soon may the Wellerman come", sub: "to bring us sugar..." },
  { chord: 'C', lyrics: "Soon may the Wellerman come", sub: "to bring us sugar..." },
  { chord: 'Dm', lyrics: "One day when the tonguin' is done", sub: "we'll take our leave..." },
  { chord: 'Am', lyrics: "One day when the tonguin' is done", sub: "we'll take our leave..." }
];

export const houseOfRisingSunScript: ScriptItem[] = [
  { chord: 'Am', lyrics: "There is a house", sub: "in New Orleans" },
  { chord: 'C', lyrics: "There is a house", sub: "in New Orleans" },
  { chord: 'D', lyrics: "They call the Rising Sun", sub: "" },
  { chord: 'F', lyrics: "They call the Rising Sun", sub: "" },
  { chord: 'Am', lyrics: "And it's been the ruin", sub: "of many a poor boy" },
  { chord: 'C', lyrics: "And it's been the ruin", sub: "of many a poor boy" },
  { chord: 'E', lyrics: "And God, I know I'm one", sub: "" },
  { chord: 'E', lyrics: "And God, I know I'm one", sub: "" }
];

export const songs = [
  { id: 'wellerman', name: 'The Wellerman', script: wellermanScript },
  { id: 'rising-sun', name: 'House of the Rising Sun', script: houseOfRisingSunScript }
];
