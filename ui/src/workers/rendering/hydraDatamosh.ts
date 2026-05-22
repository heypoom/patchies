import { Source, type Hydra } from '$lib/hydra';
import type regl from 'regl';
import type { FBORenderer } from './fboRenderer';
import { getFramebuffer } from './utils';

export type DatamoshParams = {
  speed?: number;
  keyFrame?: boolean;
  fps?: number;
  bitrate?: number;
};

type HydraSource = Pick<Source, 'init' | 'tick' | 'getTexture'>;

type CaptureSourceFrame = (
  source: HydraSource,
  canvas: OffscreenCanvas,
  ctx: OffscreenCanvasRenderingContext2D
) => { width: number; height: number } | null;

type VideoEncoderConstructor = new (init: VideoEncoderInit) => VideoEncoder;
type VideoDecoderConstructor = new (init: VideoDecoderInit) => VideoDecoder;
type VideoFrameConstructor = new (source: CanvasImageSource, init?: VideoFrameInit) => VideoFrame;

type CodecConstructors = {
  VideoEncoder?: VideoEncoderConstructor;
  VideoDecoder?: VideoDecoderConstructor;
  VideoFrame?: VideoFrameConstructor;
};

type DatamoshConsole = Pick<Console, 'warn'>;

type DatamoshPipeline = {
  encoder: VideoEncoder;
  decoder: VideoDecoder;
  outputSource: HydraSource;
  params: DatamoshParams;
};

type EncoderSize = {
  width: number;
  height: number;
};

type CopyDrawProps = {
  sourceTexture: regl.Texture2D | regl.Framebuffer2D;
  framebuffer: regl.Framebuffer2D | null;
};

export type HydraDatamosh = ((source: HydraSource, params?: DatamoshParams) => HydraSource) & {
  destroy: () => void;
  tick: () => void;
};

export function createHydraDatamosh(options: {
  createSource: () => HydraSource;
  captureSourceFrame: CaptureSourceFrame;
  codecs?: CodecConstructors;
  console?: DatamoshConsole;
  createCanvas?: (width: number, height: number) => OffscreenCanvas;
  now?: () => number;
}): HydraDatamosh {
  const codecs = options.codecs ?? globalThis;
  const warn = options.console?.warn ?? console.warn;

  const createCanvas =
    options.createCanvas ?? ((width, height) => new OffscreenCanvas(width, height));

  const now = options.now ?? (() => performance.now());
  const pipelines = new WeakMap<object, DatamoshPipeline>();
  const activePipelines = new Set<DatamoshPipeline>();

  let warnedUnsupported = false;

  const hasWebCodecs = () =>
    Boolean(codecs.VideoEncoder && codecs.VideoDecoder && codecs.VideoFrame);

  const datamosh = ((source: HydraSource, params: DatamoshParams = {}) => {
    if (!hasWebCodecs()) {
      if (!warnedUnsupported) {
        warn('datamosh() requires WebCodecs support; returning the original Hydra source.');
        warnedUnsupported = true;
      }

      return source;
    }

    const cached = pipelines.get(source);
    if (cached) {
      Object.assign(cached.params, params);
      return cached.outputSource;
    }

    const pipeline = createPipeline(source, params);
    pipelines.set(source, pipeline);
    activePipelines.add(pipeline);

    return pipeline.outputSource;
  }) as HydraDatamosh;

  datamosh.destroy = () => {
    for (const pipeline of activePipelines) {
      closeCodec(pipeline.encoder);
      closeCodec(pipeline.decoder);
    }

    activePipelines.clear();
  };

  datamosh.tick = () => {
    for (const pipeline of activePipelines) {
      pipeline.outputSource.tick();
    }
  };

  function createPipeline(source: HydraSource, params: DatamoshParams): DatamoshPipeline {
    const VideoDecoderCtor = codecs.VideoDecoder!;
    const VideoEncoderCtor = codecs.VideoEncoder!;
    const pipelineParams = { ...params };
    const encodeCanvas = createCanvas(1, 1);
    const encodeCtx = encodeCanvas.getContext('2d')!;
    const outputCanvas = createCanvas(1, 1);
    const outputCtx = outputCanvas.getContext('2d')!;
    const outputSource = options.createSource();
    const originalTick = outputSource.tick.bind(outputSource);
    const encoderSize: EncoderSize = { width: 0, height: 0 };

    let lastFrame = 0;

    const decoder = new VideoDecoderCtor({
      output(frame) {
        outputCtx.drawImage(frame, 0, 0, outputCanvas.width, outputCanvas.height);
        frame.close();
      },
      error(error) {
        warn(`datamosh() decoder error: ${error.message}`);
      }
    });

    decoder.configure({ codec: 'vp8' });

    const encoder = new VideoEncoderCtor({
      output(chunk) {
        const repetitions = chunk.type === 'key' ? 1 : normalizeSpeed(pipelineParams.speed);

        for (let i = 0; i < repetitions; i++) {
          decoder.decode(chunk);
        }
      },
      error(error) {
        warn(`datamosh() encoder error: ${error.message}`);
      }
    });

    outputSource.init({
      src: outputCanvas as unknown as Source['src'],
      dynamic: true
    });

    outputSource.tick = () => {
      const currentTime = now();
      const fpsInterval = 1000 / normalizeFps(pipelineParams.fps);

      if (currentTime - lastFrame >= fpsInterval) {
        processFrame(
          source,
          pipelineParams,
          encodeCanvas,
          encodeCtx,
          outputCanvas,
          encoder,
          encoderSize
        );

        lastFrame = currentTime;
      }

      originalTick();
    };

    return {
      encoder,
      decoder,
      outputSource,
      params: pipelineParams
    };
  }

  function processFrame(
    source: HydraSource,
    params: DatamoshParams,
    encodeCanvas: OffscreenCanvas,
    encodeCtx: OffscreenCanvasRenderingContext2D,
    outputCanvas: OffscreenCanvas,
    encoder: VideoEncoder,
    encoderSize: EncoderSize
  ) {
    const size = options.captureSourceFrame(source, encodeCanvas, encodeCtx);
    if (!size) return;

    if (outputCanvas.width !== size.width || outputCanvas.height !== size.height) {
      outputCanvas.width = size.width;
      outputCanvas.height = size.height;
    }

    const sizeChanged = encoderSize.width !== size.width || encoderSize.height !== size.height;

    if (encoder.state === 'unconfigured' || sizeChanged) {
      encoder.configure({
        codec: 'vp8',
        width: size.width,
        height: size.height,
        bitrate: params.bitrate ?? 1_000_000,
        framerate: normalizeFps(params.fps),
        latencyMode: 'realtime'
      });

      encoderSize.width = size.width;
      encoderSize.height = size.height;
    }

    const VideoFrameConstructor = codecs.VideoFrame!;

    const frame = new VideoFrameConstructor(encodeCanvas, {
      timestamp: now() * 1000
    });

    encoder.encode(frame, { keyFrame: sizeChanged || Boolean(params.keyFrame) });

    params.keyFrame = false;
    frame.close();
  }

  return datamosh;
}

export class HydraDatamoshRuntime {
  readonly datamosh: HydraDatamosh;

  private copyDraw: regl.DrawCommand | null = null;
  private readFbo: regl.Framebuffer2D | null = null;
  private readWidth = 0;
  private readHeight = 0;
  private pixels: Uint8Array | null = null;
  private scratchCanvas: OffscreenCanvas | null = null;
  private scratchCtx: OffscreenCanvasRenderingContext2D | null = null;

  constructor(
    private hydra: Hydra,
    private renderer: FBORenderer,
    console: DatamoshConsole
  ) {
    this.datamosh = createHydraDatamosh({
      createSource: () => new Source(this.hydra.glEnvironment),
      captureSourceFrame: this.captureSourceFrame.bind(this),
      console
    });
  }

  destroy() {
    this.datamosh.destroy();

    this.readFbo?.destroy();
    this.readFbo = null;
  }

  tick() {
    this.datamosh.tick();
  }

  private captureSourceFrame(
    source: { getTexture: () => regl.Texture2D | regl.Framebuffer2D },
    canvas: OffscreenCanvas,
    ctx: OffscreenCanvasRenderingContext2D
  ): { width: number; height: number } | null {
    const texture = source.getTexture();
    if (!texture) return null;

    const { width, height } = getTextureSize(texture);
    if (!width || !height) return null;

    this.ensureReadback(width, height);

    const draw = this.getCopyDraw();
    draw({ sourceTexture: texture, framebuffer: this.readFbo });

    const gl = this.renderer.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, getFramebuffer(this.readFbo));
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels!);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const array = new Uint8ClampedArray(this.pixels!);
    const imageData = new ImageData(array, width, height);

    this.scratchCtx!.putImageData(imageData, 0, 0);

    ctx.save();
    ctx.scale(1, -1);
    ctx.drawImage(this.scratchCanvas!, 0, -height);
    ctx.restore();

    return { width, height };
  }

  private ensureReadback(width: number, height: number) {
    if (this.readFbo && this.readWidth === width && this.readHeight === height) {
      return;
    }

    this.readFbo?.destroy();

    this.readFbo = this.renderer.regl.framebuffer({
      color: this.renderer.regl.texture({
        width,
        height,
        wrapS: 'clamp',
        wrapT: 'clamp'
      }),
      depthStencil: false
    });

    this.readWidth = width;
    this.readHeight = height;
    this.pixels = new Uint8Array(width * height * 4);
    this.scratchCanvas = new OffscreenCanvas(width, height);
    this.scratchCtx = this.scratchCanvas.getContext('2d');
  }

  private getCopyDraw() {
    if (this.copyDraw) {
      return this.copyDraw;
    }

    this.copyDraw = this.renderer.regl({
      frag: `
        precision mediump float;
        varying vec2 uv;
        uniform sampler2D sourceTexture;

        void main () {
          gl_FragColor = texture2D(sourceTexture, uv);
        }
      `,
      vert: `
        precision mediump float;
        attribute vec2 position;
        varying vec2 uv;

        void main () {
          uv = position;
          gl_Position = vec4(2.0 * position - 1.0, 0, 1);
        }
      `,
      attributes: {
        position: [
          [-2, 0],
          [0, -2],
          [2, 2]
        ]
      },
      uniforms: {
        sourceTexture: this.renderer.regl.prop<CopyDrawProps, 'sourceTexture'>('sourceTexture')
      },
      framebuffer: this.renderer.regl.prop<CopyDrawProps, 'framebuffer'>('framebuffer'),
      count: 3,
      depth: { enable: false }
    });

    return this.copyDraw;
  }
}

const normalizeSpeed = (speed: number | undefined): number => Math.max(1, Math.floor(speed ?? 2));

const normalizeFps = (fps: number | undefined): number =>
  Math.max(1, Math.min(240, Math.floor(fps ?? 60)));

function closeCodec(codec: { state?: string; close: () => void }) {
  if (codec.state === 'closed') return;

  codec.close();
}

function getTextureSize(texture: regl.Texture2D | regl.Framebuffer2D): {
  width: number;
  height: number;
} {
  const sized = texture as unknown as { width?: number; height?: number };

  return { width: sized.width ?? 0, height: sized.height ?? 0 };
}
