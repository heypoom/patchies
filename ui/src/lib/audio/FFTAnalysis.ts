import { match, P } from 'ts-pattern';
import type {
  AudioAnalysisFormat,
  AudioAnalysisType,
  AudioAnalysisValue
} from './AudioAnalysisSystem';

const FREQUENCY_RANGES = {
  bass: [20, 140],
  lowMid: [140, 400],
  mid: [400, 2600],
  highMid: [2600, 5200],
  treble: [5200, 14000]
} as const;

type FrequencyRangeKey = keyof typeof FREQUENCY_RANGES;

export class FFTAnalysis {
  private bins: AudioAnalysisValue;
  private format: AudioAnalysisFormat;
  private analysisType: AudioAnalysisType;
  private sampleRate: number;

  constructor(
    data: AudioAnalysisValue | null,
    _format: AudioAnalysisFormat | null,
    sampleRate: number,
    analysisType: AudioAnalysisType = 'wave'
  ) {
    const format = match(data)
      .with(P.instanceOf(Uint8Array), () => 'int' as const)
      .with(P.instanceOf(Float32Array), () => 'float' as const)
      .otherwise(() => _format ?? 'int');

    this.bins = match([data, format])
      .with([P.nullish, 'int'], () => new Uint8Array())
      .with([P.nullish, 'float'], () => new Float32Array())
      .with([P.nonNullable, P.any], ([data]) => data)
      .exhaustive();

    this.format = format;
    this.analysisType = analysisType;
    this.sampleRate = sampleRate;
  }

  get a(): AudioAnalysisValue {
    return this.bins;
  }

  get f(): Float32Array {
    if (this.bins instanceof Float32Array) return this.bins;

    return new Float32Array(this.bins).map((v) => v / 255);
  }

  get sum(): number {
    return (this.a as Uint8Array).reduce((a, b) => a + b, 0);
  }

  get avg(): number {
    return this.sum / this.bins.length;
  }

  get centroid(): number {
    const totalMagnitude = this.f.reduce((sum, magnitude) => sum + magnitude, 0);

    if (totalMagnitude === 0) return 0;

    const weightedSum = this.f.reduce((sum, magnitude, index) => {
      return sum + magnitude * index;
    }, 0);

    return weightedSum / totalMagnitude;
  }

  get rms(): number {
    if (this.bins.length === 0) return 0;

    if (this.analysisType === 'wave') {
      // Time-domain RMS: signal is centered at 128 (int) or 0 (float)
      let sumSquares = 0;

      if (this.bins instanceof Uint8Array) {
        for (let i = 0; i < this.bins.length; i++) {
          const normalized = (this.bins[i] - 128) / 128;
          sumSquares += normalized * normalized;
        }
      } else {
        for (let i = 0; i < this.bins.length; i++) {
          sumSquares += this.bins[i] * this.bins[i];
        }
      }

      return Math.sqrt(sumSquares / this.bins.length);
    }

    // Frequency-domain: RMS of normalized magnitudes (spectral energy)
    const sumSquares = this.f.reduce((sum, magnitude) => sum + magnitude * magnitude, 0);

    return Math.sqrt(sumSquares / this.bins.length);
  }

  getEnergy(frequency1: number | FrequencyRangeKey = 0, frequency2?: number): number {
    const nyquist = this.sampleRate / 2;
    const freqDomain = this.a;

    if (typeof frequency1 === 'string') {
      const range = FREQUENCY_RANGES[frequency1];

      if (range) {
        [frequency1, frequency2] = range;
      } else {
        console.warn(`incorrect frequency range key: ${frequency1}`);
        return 0;
      }
    }

    // Single frequency bin
    if (typeof frequency2 !== 'number') {
      const index = Math.round((frequency1 / nyquist) * freqDomain.length);

      return freqDomain[index] ?? 0;
    }

    // Frequency range
    if (frequency1 < 0 || frequency2 < 0) {
      console.warn('frequency cannot be negative');
      return 0;
    }

    // Swap if needed
    if (frequency1 > frequency2) {
      [frequency1, frequency2] = [frequency2, frequency1];
    }

    const lowIndex = Math.round((frequency1 / nyquist) * freqDomain.length);
    const highIndex = Math.round((frequency2 / nyquist) * freqDomain.length);

    let total = 0;
    let numFrequencies = 0;

    for (let i = lowIndex; i <= highIndex && i < freqDomain.length; i++) {
      total += freqDomain[i];
      numFrequencies++;
    }

    return numFrequencies > 0 ? total / numFrequencies : 0;
  }
}
