/**
 * Represents a single finger's contact point on the guitar neck.
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
 * Defines a specific chord shape and its corresponding arpeggio/pluck pattern.
 */
export interface ChordDefinition {
  /** The name of the chord (e.g., "Am", "C") */
  name: string;
  /** The array of fret positions for the left hand */
  voicing: FretPosition[];
  /** The order of strings to be plucked by the right hand */
  arpeggioPattern: number[];
}

/**
 * A single segment of a song, tying a chord to specific lyrics.
 */
export interface SongScriptItem {
  chord: string;
  lyrics: string;
  sub: string;
}

/**
 * Metadata for an entire song.
 */
export interface SongData {
  id: string;
  name: string;
  script: SongScriptItem[];
}

/**
 * Data for a single falling note in the 3D track.
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
