import { describe, expect, it, vi } from 'vitest';
import { createHydraDatamosh } from './hydraDatamosh';

type TestCodecs = NonNullable<Parameters<typeof createHydraDatamosh>[0]['codecs']>;

const createSource = () => ({
  init: vi.fn(),
  tick: vi.fn(),
  getTexture: vi.fn()
});

describe('createHydraDatamosh', () => {
  it('returns the original source and warns once when WebCodecs are unavailable', () => {
    const warn = vi.fn();
    const datamosh = createHydraDatamosh({
      createSource,
      captureSourceFrame: vi.fn(),
      codecs: {},
      console: { warn }
    });
    const source = createSource();

    expect(datamosh(source)).toBe(source);
    expect(datamosh(source)).toBe(source);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('caches the datamoshed source per input source', () => {
    const datamosh = createHydraDatamosh({
      createSource,
      captureSourceFrame: vi.fn(),
      codecs: createCodecs() as unknown as TestCodecs,
      console: { warn: vi.fn() },
      createCanvas
    });
    const source = createSource();

    expect(datamosh(source)).toBe(datamosh(source));
    expect(datamosh(source)).not.toBe(source);
  });

  it('decodes non-key frames according to speed', () => {
    const codecs = createCodecs();
    const datamosh = createHydraDatamosh({
      createSource,
      captureSourceFrame: vi.fn(),
      codecs: codecs as unknown as TestCodecs,
      console: { warn: vi.fn() },
      createCanvas,
      now: () => 100
    });

    const source = createSource();
    const moshed = datamosh(source, { speed: 3 });

    moshed.tick();
    codecs.encoderOutput({ type: 'delta' });

    expect(codecs.decoderDecode).toHaveBeenCalledTimes(3);
  });

  it('advances active pipelines from the render tick', () => {
    const codecs = createCodecs();
    const captureSourceFrame = vi.fn(() => ({ width: 2, height: 2 }));
    const datamosh = createHydraDatamosh({
      createSource,
      captureSourceFrame,
      codecs: codecs as unknown as TestCodecs,
      console: { warn: vi.fn() },
      createCanvas,
      now: () => 100
    });

    const source = createSource();
    datamosh(source);

    datamosh.tick();

    expect(captureSourceFrame).toHaveBeenCalledTimes(1);
    expect(codecs.encoderEncode).toHaveBeenCalledTimes(1);
  });

  it('does not advance the pipeline while sampling the returned source texture', () => {
    const codecs = createCodecs();
    const captureSourceFrame = vi.fn(() => ({ width: 2, height: 2 }));
    const datamosh = createHydraDatamosh({
      createSource,
      captureSourceFrame,
      codecs: codecs as unknown as TestCodecs,
      console: { warn: vi.fn() },
      createCanvas,
      now: () => 100
    });

    const source = createSource();
    const moshed = datamosh(source);

    moshed.getTexture();

    expect(captureSourceFrame).not.toHaveBeenCalled();
    expect(codecs.encoderEncode).not.toHaveBeenCalled();
  });

  it('reconfigures the encoder when a later connected video inlet changes source size', () => {
    const codecs = createCodecs();
    let currentTime = 100;
    let size = { width: 1, height: 1 };
    const captureSourceFrame = vi.fn(() => size);
    const datamosh = createHydraDatamosh({
      createSource,
      captureSourceFrame,
      codecs: codecs as unknown as TestCodecs,
      console: { warn: vi.fn() },
      createCanvas,
      now: () => currentTime
    });

    const source = createSource();
    datamosh(source);

    datamosh.tick();
    size = { width: 640, height: 360 };
    currentTime = 200;
    datamosh.tick();

    expect(codecs.encoderConfigure).toHaveBeenCalledTimes(2);
    expect(codecs.encoderConfigure).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ width: 640, height: 360 })
    );
    expect(codecs.encoderEncode).toHaveBeenLastCalledWith(
      expect.any(codecs.VideoFrame),
      expect.objectContaining({ keyFrame: true })
    );
  });
});

function createCodecs() {
  let encoderOutput: (chunk: { type: 'key' | 'delta' }) => void = () => {};
  const encoderConfigure = vi.fn();
  const encoderEncode = vi.fn();
  const decoderDecode = vi.fn();

  class VideoEncoder {
    state = 'unconfigured';

    constructor(init: { output: typeof encoderOutput }) {
      encoderOutput = init.output;
    }

    configure(config: unknown) {
      encoderConfigure(config);
      this.state = 'configured';
    }

    encode = encoderEncode;
    close = vi.fn();
  }

  class VideoDecoder {
    state = 'unconfigured';

    constructor() {}

    configure() {
      this.state = 'configured';
    }

    decode = decoderDecode;
    close = vi.fn();
  }

  class VideoFrame {
    constructor() {}
    close = vi.fn();
  }

  return {
    VideoEncoder,
    VideoDecoder,
    VideoFrame,
    encoderConfigure,
    encoderEncode,
    encoderOutput: (chunk: { type: 'key' | 'delta' }) => encoderOutput(chunk),
    decoderDecode
  };
}

function createCanvas(width: number, height: number) {
  return {
    width,
    height,
    getContext: () => ({ drawImage: vi.fn() })
  } as unknown as OffscreenCanvas;
}
