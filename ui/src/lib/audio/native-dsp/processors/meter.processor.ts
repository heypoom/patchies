import { calculateRms } from '../../rms';

class MeterProcessor extends AudioWorkletProcessor {
  private shouldStop = false;
  private samplesSinceLastPost = 0;
  private readonly postIntervalSamples: number;

  constructor() {
    super();

    const workletSampleRate =
      (globalThis as unknown as { sampleRate?: number }).sampleRate ?? 44100;

    this.postIntervalSamples = Math.max(1, Math.floor(workletSampleRate / 60));

    this.port.onmessage = (event) => {
      if (event.data.type === 'stop') {
        this.shouldStop = true;
      }
    };
  }

  process(inputs: Float32Array[][]): boolean {
    if (this.shouldStop) return false;

    const input = inputs[0] ?? [];
    const blockSize = input[0]?.length ?? 128;
    this.samplesSinceLastPost += blockSize;

    if (this.samplesSinceLastPost < this.postIntervalSamples) {
      return true;
    }

    this.samplesSinceLastPost -= this.postIntervalSamples;

    this.port.postMessage({
      type: 'meter-levels',
      levels: input.length > 0 ? input.map(calculateRms) : [0]
    });

    return true;
  }
}

registerProcessor('meter~', MeterProcessor);
