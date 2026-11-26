import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

interface Processor {
  port: {
    onmessage: (event: { data: { type: string; message: number; inlet: number } }) => void;
    postMessage: ReturnType<typeof vi.fn>;
  };
  process: (
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ) => boolean;
}

let ProcessorClass: new () => Processor;

beforeAll(async () => {
  vi.stubGlobal(
    'AudioWorkletProcessor',
    class {
      port = { onmessage: null, postMessage: vi.fn() };
    }
  );

  vi.stubGlobal('registerProcessor', (_name: string, processor: new () => Processor) => {
    ProcessorClass = processor;
  });

  await import('./env.processor');
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const setWindow = (processor: Processor, size: number) =>
  processor.port.onmessage({
    data: { type: 'message-inlet', message: size, inlet: 1 }
  });

const processBlock = (processor: Processor, input = new Float32Array(128).fill(0.5)) =>
  processor.process([[input]], [], {});

describe('env~ output scheduling', () => {
  test('limits a one-sample window to one message per audio block', () => {
    const processor = new ProcessorClass();
    setWindow(processor, 1);

    // One second at 48 kHz must not produce 48,000 main-thread messages.
    for (let block = 0; block < 375; block++) {
      processBlock(processor);
      expect(processor.port.postMessage).toHaveBeenCalledTimes(block + 1);
    }
  });

  test.each([1, 64, 128, 129, 256, 300, 1024])(
    'rounds the reporting interval up to whole blocks for window %i',
    (windowSize) => {
      const processor = new ProcessorClass();
      setWindow(processor, windowSize);
      const blocksPerOutput = Math.ceil(windowSize / 128);

      for (let block = 1; block <= blocksPerOutput * 3; block++) {
        processBlock(processor);

        expect(processor.port.postMessage).toHaveBeenCalledTimes(
          Math.floor(block / blocksPerOutput)
        );
      }
    }
  );

  test('reports the latest analysis window without enlarging it or changing linear units', () => {
    const processor = new ProcessorClass();
    setWindow(processor, 2);
    const input = new Float32Array(128).fill(1);
    input[126] = -0.25;
    input[127] = 0.5;

    processBlock(processor, input);

    expect(processor.port.postMessage).toHaveBeenCalledTimes(1);
    expect(processor.port.postMessage).toHaveBeenCalledWith({
      type: 'send-message',
      message: Math.sqrt((0.25 ** 2 + 0.5 ** 2) / 2),
      outlet: 0,
      directTargets: undefined
    });
  });

  test('keeps the default 1024-sample reporting interval', () => {
    const processor = new ProcessorClass();

    for (let block = 0; block < 7; block++) {
      processBlock(processor);
    }

    expect(processor.port.postMessage).not.toHaveBeenCalled();
    processBlock(processor);

    expect(processor.port.postMessage).toHaveBeenCalledExactlyOnceWith({
      type: 'send-message',
      message: 0.5,
      outlet: 0,
      directTargets: undefined
    });
  });

  test('resets analysis history and scheduling when the window changes', () => {
    const processor = new ProcessorClass();
    setWindow(processor, 1);
    processBlock(processor, new Float32Array(128).fill(1));
    processor.port.postMessage.mockClear();

    setWindow(processor, 256);
    processBlock(processor);
    expect(processor.port.postMessage).not.toHaveBeenCalled();

    processBlock(processor);

    expect(processor.port.postMessage).toHaveBeenCalledExactlyOnceWith({
      type: 'send-message',
      message: 0.5,
      outlet: 0,
      directTargets: undefined
    });
  });
});
