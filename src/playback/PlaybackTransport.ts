export class PlaybackTransport {
  private playing = false;
  private playbackStartTime = 0;
  private pausedTimeAccumulator = 0;

  public get isPlaying() {
    return this.playing;
  }

  public toggle() {
    if (this.playing) {
      this.pause();
    } else {
      this.play();
    }

    return this.playing;
  }

  public play(now: number = performance.now()) {
    this.playing = true;
    this.playbackStartTime = now - this.pausedTimeAccumulator;
  }

  public pause(now: number = performance.now()) {
    this.playing = false;
    this.pausedTimeAccumulator = now - this.playbackStartTime;
  }

  public reset() {
    this.playing = false;
    this.playbackStartTime = 0;
    this.pausedTimeAccumulator = 0;
  }

  public getElapsedTime(now: number = performance.now()) {
    return this.playing ? now - this.playbackStartTime : this.pausedTimeAccumulator;
  }
}
