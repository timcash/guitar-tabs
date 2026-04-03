/**
 * Represents a single chord-finger contact point on the fret-board.
 */
export interface FretPosition {
  /** 1-6, where 1 is High E and 6 is Low E */
  string: number;
  /** 0 for open, 1+ for specific frets */
  fret: number;
  /** Recommended finger (1=Index, 2=Middle, 3=Ring, 4=Pinky) */
  finger?: number;
}

/**
 * Defines a chord-library entry with its chord-fingers and picking pattern.
 */
export interface ChordDefinition {
  /** The name of the chord (e.g., "Am", "C") */
  name: string;
  /** The chord-finger positions on the fret-board */
  voicing: FretPosition[];
  /** The picking-finger pluck order */
  arpeggioPattern: number[];
}

/**
 * A single song-script segment tying a chord to lyrics.
 */
export interface SongScriptItem {
  chord: string;
  lyrics: string;
  sub: string;
}

/**
 * Metadata for a song-catalog entry.
 */
export interface SongData {
  id: string;
  name: string;
  script: SongScriptItem[];
}

/**
 * Legacy type name for one sliding-note event in the 3D track.
 */
export interface FallingNote {
  noteName: string;
  stringNum: number;
  fret: number;
  hitTime: number;
  lyrics: string;
  sub: string;
  chordName: string;
  /** Calculated 3D Z-coordinate */
  z_3d: number;
  /** Visual fade amount */
  opacity: number;
}
