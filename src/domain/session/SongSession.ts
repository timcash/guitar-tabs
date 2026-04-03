import type { ChordSegment } from '../../chordTimeline';
import type { ChordDefinition, FallingNote, SongData } from '../../types';
import {
  SlidingNoteSequenceBuilder,
  type SlidingNoteSequenceBuildResult
} from '../timeline/SlidingNoteSequenceBuilder';

export class SongSession {
  private readonly songs: SongData[];
  private readonly chordLibrary: Record<string, ChordDefinition>;
  private readonly slidingNoteSequenceBuilder: SlidingNoteSequenceBuilder;
  private selectedSongIndexValue = 0;
  private currentBpm = 100;
  private currentChordTimeline: ChordSegment[] = [];
  private currentFullNoteSequence: FallingNote[] = [];
  private currentTotalSongDurationMs = 0;

  constructor(
    songs: SongData[],
    chordLibrary: Record<string, ChordDefinition>,
    slidingNoteSequenceBuilder: SlidingNoteSequenceBuilder = new SlidingNoteSequenceBuilder()
  ) {
    this.songs = songs;
    this.chordLibrary = chordLibrary;
    this.slidingNoteSequenceBuilder = slidingNoteSequenceBuilder;
  }

  public get bpm() {
    return this.currentBpm;
  }

  public get chordTimeline() {
    return this.currentChordTimeline;
  }

  public get fullNoteSequence() {
    return this.currentFullNoteSequence;
  }

  public get totalSongDurationMs() {
    return this.currentTotalSongDurationMs;
  }

  public get selectedSongIndex() {
    return this.selectedSongIndexValue;
  }

  public loadSong(index: number) {
    this.selectedSongIndexValue = index;
    this.rebuild();
  }

  public setTempo(bpm: number) {
    this.currentBpm = bpm;
    this.rebuild();
  }

  public getPluckDurationMs() {
    return (60 / this.currentBpm) * 600;
  }

  private rebuild() {
    const song = this.songs[this.selectedSongIndexValue];
    const buildResult = this.slidingNoteSequenceBuilder.build(
      song.script,
      this.chordLibrary,
      this.getPluckDurationMs()
    );

    this.applyBuildResult(buildResult);
  }

  private applyBuildResult(buildResult: SlidingNoteSequenceBuildResult) {
    this.currentChordTimeline = buildResult.chordTimeline;
    this.currentFullNoteSequence = buildResult.fullNoteSequence;
    this.currentTotalSongDurationMs = buildResult.totalSongDurationMs;
  }
}
