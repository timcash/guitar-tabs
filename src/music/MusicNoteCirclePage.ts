import { MicrophoneNoteAnalyzer } from './MicrophoneNoteAnalyzer';
import { MusicNoteCircleView, type MusicMicrophonePhase } from './MusicNoteCircleView';

const CHROMA_ATTACK = 0.2;
const CHROMA_DECAY = 0.08;

export class MusicNoteCirclePage {
  private readonly analyzer = new MicrophoneNoteAnalyzer();
  private readonly view: MusicNoteCircleView;
  private readonly smoothedChroma = new Float32Array(12);
  private animationFrameId: number | null = null;
  private isListening = false;
  private disposed = false;

  constructor(root: HTMLDivElement) {
    this.view = new MusicNoteCircleView(root, {
      onEnableMicrophone: this.handleEnableMicrophone
    });
  }

  public render() {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.view.setMicrophoneState('unsupported', 'This browser does not expose microphone input.');
    } else {
      this.view.setMicrophoneState('idle', 'Tap ENABLE MIC, then play one clear note near the microphone.');
    }

    this.animationLoop();
    window.addEventListener('pagehide', this.handlePageHide, { once: true });
  }

  public dispose() {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.analyzer.dispose();
    this.view.dispose();
    window.removeEventListener('pagehide', this.handlePageHide);
  }

  private readonly handleEnableMicrophone = () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.isListening = false;
      this.view.setMicrophoneState('unsupported', 'This browser does not expose microphone input.');
      return;
    }

    this.view.setMicrophoneState('starting', 'Requesting microphone access...');
    void this.enableMicrophone();
  };

  private readonly handlePageHide = () => {
    this.dispose();
  };

  private readonly animationLoop = () => {
    if (this.disposed) {
      return;
    }

    const frame = this.analyzer.getFrame();
    this.smoothChroma(frame.chroma);
    this.view.renderFrame(frame, this.smoothedChroma, this.isListening);
    this.animationFrameId = window.requestAnimationFrame(this.animationLoop);
  };

  private async enableMicrophone() {
    const result = await this.analyzer.enableMicrophone();
    if (this.disposed) {
      return;
    }

    if (result.ok) {
      this.isListening = true;
      this.view.setMicrophoneState('listening', result.detail);
      return;
    }

    this.isListening = false;
    this.view.setMicrophoneState(this.resolveErrorPhase(), this.toUserMessage(result.detail));
  }

  private smoothChroma(nextChroma: Float32Array) {
    for (let pitchClass = 0; pitchClass < this.smoothedChroma.length; pitchClass += 1) {
      const current = this.smoothedChroma[pitchClass];
      const target = nextChroma[pitchClass];
      const smoothing = target >= current ? CHROMA_ATTACK : CHROMA_DECAY;
      this.smoothedChroma[pitchClass] = current + (target - current) * smoothing;
    }
  }

  private resolveErrorPhase(): MusicMicrophonePhase {
    return 'error';
  }

  private toUserMessage(detail: string) {
    if (/denied|not allowed|permission/i.test(detail)) {
      return 'Microphone permission was denied. Allow microphone access and tap RETRY MIC.';
    }

    if (/secure|https/i.test(detail)) {
      return 'Microphone input requires HTTPS or localhost in this browser.';
    }

    return detail;
  }
}
