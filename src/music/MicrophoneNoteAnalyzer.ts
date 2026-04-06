import { clamp01, frequencyToPitchClass, pitchClassToDisplayLabel } from './musicTheory';

const MIN_FREQUENCY_HZ = 65;
const MAX_FREQUENCY_HZ = 1200;
const VOLUME_FLOOR = 0.01;

export interface MusicAnalysisFrame {
  chroma: Float32Array;
  pitchHz: number | null;
  pitchClass: number | null;
  noteLabel: string | null;
  confidence: number;
  volume: number;
}

export interface MicrophoneEnableResult {
  ok: boolean;
  detail: string;
}

interface PitchDetectionResult {
  frequencyHz: number;
  confidence: number;
}

export class MicrophoneNoteAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private frequencyBuffer: Float32Array<ArrayBuffer> | null = null;
  private timeDomainBuffer: Float32Array<ArrayBuffer> | null = null;
  private microphoneStream: MediaStream | null = null;
  private microphoneSource: MediaStreamAudioSourceNode | null = null;

  public async enableMicrophone(): Promise<MicrophoneEnableResult> {
    if (!navigator.mediaDevices?.getUserMedia) {
      return {
        ok: false,
        detail: 'Microphone access is not available in this browser.'
      };
    }

    await this.ensureAudioGraph();
    if (!this.audioContext || !this.analyser) {
      return {
        ok: false,
        detail: 'Web Audio is not available in this browser.'
      };
    }

    if (this.microphoneStream) {
      await this.audioContext.resume();
      return {
        ok: true,
        detail: 'Listening to microphone input.'
      };
    }

    try {
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      this.microphoneSource = this.audioContext.createMediaStreamSource(this.microphoneStream);
      this.microphoneSource.connect(this.analyser);

      return {
        ok: true,
        detail: 'Listening to microphone input.'
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unable to access the microphone.';
      return {
        ok: false,
        detail
      };
    }
  }

  public getFrame(): MusicAnalysisFrame {
    const chroma = new Float32Array(12);
    if (!this.audioContext || !this.analyser || !this.frequencyBuffer || !this.timeDomainBuffer) {
      return {
        chroma,
        pitchHz: null,
        pitchClass: null,
        noteLabel: null,
        confidence: 0,
        volume: 0
      };
    }

    this.analyser.getFloatFrequencyData(this.frequencyBuffer);
    this.analyser.getFloatTimeDomainData(this.timeDomainBuffer);

    const volume = this.measureVolume(this.timeDomainBuffer);
    const nextChroma = this.buildChromagram(this.frequencyBuffer, this.audioContext.sampleRate, this.analyser.fftSize);
    chroma.set(nextChroma);

    const detectedPitch = volume >= VOLUME_FLOOR
      ? this.detectPitch(this.timeDomainBuffer, this.audioContext.sampleRate)
      : null;

    if (detectedPitch) {
      const pitchClass = frequencyToPitchClass(detectedPitch.frequencyHz);
      return {
        chroma,
        pitchHz: detectedPitch.frequencyHz,
        pitchClass,
        noteLabel: pitchClassToDisplayLabel(pitchClass),
        confidence: detectedPitch.confidence,
        volume
      };
    }

    let strongestPitchClass: number | null = null;
    let strongestEnergy = 0;
    for (let pitchClass = 0; pitchClass < chroma.length; pitchClass += 1) {
      if (chroma[pitchClass] <= strongestEnergy) continue;
      strongestEnergy = chroma[pitchClass];
      strongestPitchClass = pitchClass;
    }

    return {
      chroma,
      pitchHz: null,
      pitchClass: strongestEnergy > 0.24 ? strongestPitchClass : null,
      noteLabel: strongestPitchClass !== null && strongestEnergy > 0.24
        ? pitchClassToDisplayLabel(strongestPitchClass)
        : null,
      confidence: strongestEnergy,
      volume
    };
  }

  public dispose() {
    this.microphoneSource?.disconnect();
    this.microphoneSource = null;

    if (this.microphoneStream) {
      for (const track of this.microphoneStream.getTracks()) {
        track.stop();
      }
      this.microphoneStream = null;
    }
  }

  private async ensureAudioGraph() {
    if (!this.audioContext) {
      try {
        const AudioContextCtor = window.AudioContext ||
          (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) {
          return;
        }

        this.audioContext = new AudioContextCtor();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 4096;
        this.analyser.smoothingTimeConstant = 0.18;
        this.analyser.minDecibels = -95;
        this.analyser.maxDecibels = -10;
        this.frequencyBuffer = new Float32Array(this.analyser.frequencyBinCount);
        this.timeDomainBuffer = new Float32Array(this.analyser.fftSize);
      } catch {
        this.audioContext = null;
        this.analyser = null;
        return;
      }
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume().catch(() => undefined);
    }
  }

  private measureVolume(samples: Float32Array) {
    let sumSquares = 0;
    for (const sample of samples) {
      sumSquares += sample * sample;
    }

    return Math.sqrt(sumSquares / samples.length);
  }

  private buildChromagram(frequencyData: Float32Array, sampleRate: number, fftSize: number) {
    const chroma = new Float32Array(12);
    const binWidth = sampleRate / fftSize;

    for (let bin = 0; bin < frequencyData.length; bin += 1) {
      const frequencyHz = bin * binWidth;
      if (frequencyHz < 20) continue;

      const db = frequencyData[bin];
      if (!Number.isFinite(db) || db <= -85) continue;

      const magnitude = Math.pow(10, db / 20);
      const pitchClass = frequencyToPitchClass(frequencyHz);
      chroma[pitchClass] += magnitude;
    }

    let maxEnergy = 0;
    for (const energy of chroma) {
      if (energy > maxEnergy) {
        maxEnergy = energy;
      }
    }

    if (maxEnergy > 0) {
      for (let pitchClass = 0; pitchClass < chroma.length; pitchClass += 1) {
        chroma[pitchClass] = clamp01(chroma[pitchClass] / maxEnergy);
      }
    }

    return chroma;
  }

  private detectPitch(samples: Float32Array, sampleRate: number): PitchDetectionResult | null {
    const minLag = Math.floor(sampleRate / MAX_FREQUENCY_HZ);
    const maxLag = Math.floor(sampleRate / MIN_FREQUENCY_HZ);
    const lastIndex = samples.length - maxLag - 1;
    if (lastIndex <= 0) {
      return null;
    }

    const correlations = new Float32Array(maxLag + 2);
    let bestLag = -1;
    let bestCorrelation = 0;

    for (let lag = minLag; lag <= maxLag; lag += 1) {
      let sum = 0;
      let normA = 0;
      let normB = 0;

      for (let index = 0; index < lastIndex; index += 1) {
        const current = samples[index];
        const shifted = samples[index + lag];
        sum += current * shifted;
        normA += current * current;
        normB += shifted * shifted;
      }

      const denominator = Math.sqrt(normA * normB);
      const correlation = denominator > 0 ? sum / denominator : 0;
      correlations[lag] = correlation;

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestLag = lag;
      }
    }

    if (bestLag < minLag || bestCorrelation < 0.72) {
      return null;
    }

    const previous = correlations[bestLag - 1] ?? correlations[bestLag];
    const current = correlations[bestLag];
    const next = correlations[bestLag + 1] ?? correlations[bestLag];
    const denominator = previous - 2 * current + next;
    const shift = denominator !== 0 ? 0.5 * (previous - next) / denominator : 0;
    const refinedLag = bestLag + shift;

    return {
      frequencyHz: sampleRate / refinedLag,
      confidence: clamp01(bestCorrelation)
    };
  }
}
