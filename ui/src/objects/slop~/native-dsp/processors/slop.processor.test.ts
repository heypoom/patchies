import { beforeAll, describe, expect, test, vi } from 'vitest';

type Processor = {
  process: (
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ) => boolean;
};

let ProcessorClass: new () => Processor;

beforeAll(async () => {
  vi.stubGlobal('sampleRate', 48000);
  vi.stubGlobal(
    'AudioWorkletProcessor',
    class {
      port = { onmessage: null, postMessage: vi.fn() };
    }
  );
  vi.stubGlobal('registerProcessor', (_name: string, processor: new () => Processor) => {
    ProcessorClass = processor;
  });

  await import('./slop.processor');
});

describe('slop~ processor', () => {
  test('emits an audible signal when the limit supports audio-rate changes', () => {
    const processor = new ProcessorClass();
    const input = new Float32Array(128);
    const output = new Float32Array(128);

    for (let i = 0; i < input.length; i++) {
      input[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
    }

    processor.process([[input]], [[output]], { limit: new Float32Array([10000]) });

    expect(Math.max(...output.map(Math.abs))).toBeGreaterThan(0.5);
  });
});
