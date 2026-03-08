export interface FingerPosition {
  string: number;
  fret: number;
  finger?: number;
}

export interface Chord {
  name: string;
  positions: FingerPosition[];
  pluckPattern: number[];
}

export interface ScriptItem {
  chord: string;
  lyrics: string;
  sub: string;
}
