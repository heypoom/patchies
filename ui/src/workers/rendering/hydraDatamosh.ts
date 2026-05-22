import { Source, type Hydra } from '$lib/hydra';
import type regl from 'regl';
import type { FBORenderer } from './fboRenderer';
import { getFramebuffer } from './utils';

export type DatamoshParams = {
  speed?: number;
  keyFrame?: boolean;
  fps?: number;
  bitrate?: number;
  scale?: number;
  width?: number;
  height?: number;
};

type HydraSource = Pick<Source, 'init' | 'tick' | 'getTexture'>;

type CaptureSourceFrame = (
  source: HydraSource,
  canvas: OffscreenCanvas,
  ctx: OffscreenCanvasRenderingContext2D,
  params: DatamoshParams
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

type PendingRead = {
  pbo: WebGLBuffer;
  sync: WebGLSync;
  width: number;
  height: number;
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
  getRenderFpsCap?: () => number;
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
      const fpsInterval = 1000 / normalizeFps(pipelineParams.fps, options.getRenderFpsCap?.());

      if (currentTime - lastFrame >= fpsInterval) {
        const encoded = processFrame(
          source,
          pipelineParams,
          encodeCanvas,
          encodeCtx,
          outputCanvas,
          encoder,
          encoderSize
        );

        if (encoded) {
          lastFrame = currentTime;
        }
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
  ): boolean {
    const size = options.captureSourceFrame(source, encodeCanvas, encodeCtx, params);
    if (!size) return false;

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
        framerate: normalizeFps(params.fps, options.getRenderFpsCap?.()),
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

    return true;
  }

  return datamosh;
}

export class HydraDatamoshRuntime {
  readonly datamosh: HydraDatamosh;

  private copyDraw: regl.DrawCommand | null = null;
  private pendingReads = new WeakMap<object, PendingRead>();
  private activePendingReads = new Set<PendingRead>();

  constructor(
    private hydra: Hydra,
    private renderer: FBORenderer,
    console: DatamoshConsole
  ) {
    this.datamosh = createHydraDatamosh({
      createSource: () => new Source(this.hydra.glEnvironment),
      captureSourceFrame: this.captureSourceFrame.bind(this),
      getRenderFpsCap: () => this.renderer.renderFpsCap,
      console
    });
  }

  destroy() {
    this.datamosh.destroy();

    const { gl, pixelReadbackService } = this.renderer;

    for (const pending of this.activePendingReads) {
      gl.deleteSync(pending.sync);

      pixelReadbackService.returnPbo(pending.pbo);
    }

    this.activePendingReads.clear();
    this.pendingReads = new WeakMap();
  }

  tick() {
    this.datamosh.tick();
  }

  private captureSourceFrame(
    source: { getTexture: () => regl.Texture2D | regl.Framebuffer2D },
    canvas: OffscreenCanvas,
    ctx: OffscreenCanvasRenderingContext2D,
    params: DatamoshParams
  ): { width: number; height: number } | null {
    const texture = source.getTexture();
    if (!texture) return null;

    const sourceSize = getTextureSize(texture);
    if (!sourceSize.width || !sourceSize.height) return null;

    const targetSize = getDatamoshFrameSize(sourceSize.width, sourceSize.height, params);
    const completed = this.harvestRead(source, canvas, ctx);

    this.initiateRead(source, texture, targetSize);

    return completed;
  }

  private harvestRead(
    source: object,
    canvas: OffscreenCanvas,
    ctx: OffscreenCanvasRenderingContext2D
  ): { width: number; height: number } | null {
    const pending = this.pendingReads.get(source);
    if (!pending) return null;

    const { gl, pixelReadbackService } = this.renderer;
    const status = gl.clientWaitSync(pending.sync, 0, 0);

    if (status === gl.TIMEOUT_EXPIRED) {
      return null;
    }

    gl.deleteSync(pending.sync);
    this.pendingReads.delete(source);
    this.activePendingReads.delete(pending);

    if (status === gl.WAIT_FAILED) {
      pixelReadbackService.returnPbo(pending.pbo);

      return null;
    }

    const { pbo, width, height } = pending;
    const pixels = new Uint8ClampedArray(width * height * 4);

    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);

    const start = pixelReadbackService.profiler.isEnabled ? performance.now() : 0;

    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pixels);

    if (pixelReadbackService.profiler.isEnabled) {
      pixelReadbackService.profiler.recordReglRead(performance.now() - start);
    }

    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    pixelReadbackService.returnPbo(pbo);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const imageData = new ImageData(pixels, width, height);
    ctx.putImageData(imageData, 0, 0);

    return { width, height };
  }

  private initiateRead(
    source: object,
    texture: regl.Texture2D | regl.Framebuffer2D,
    targetSize: { width: number; height: number }
  ) {
    if (this.pendingReads.has(source)) {
      return;
    }

    const { gl, pixelReadbackService } = this.renderer;
    const { width, height } = targetSize;

    pixelReadbackService.ensureIntermediateFboSize(width, height);

    const draw = this.getCopyDraw();
    draw({ sourceTexture: texture, framebuffer: pixelReadbackService.getIntermediateFbo() });

    const pbo = pixelReadbackService.getPbo();
    const size = width * height * 4;

    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, size, gl.STREAM_READ);

    gl.bindFramebuffer(
      gl.READ_FRAMEBUFFER,
      getFramebuffer(pixelReadbackService.getIntermediateFbo())
    );

    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, 0);

    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);

    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);

    if (!sync) {
      pixelReadbackService.returnPbo(pbo);

      return;
    }

    const pending = { pbo, sync, width, height };

    this.pendingReads.set(source, pending);
    this.activePendingReads.add(pending);
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
          gl_FragColor = texture2D(sourceTexture, vec2(uv.x, 1.0 - uv.y));
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

export const normalizeFps = (fps: number | undefined, renderFpsCap = 0): number => {
  const requestedFps = Math.max(1, Math.min(240, Math.floor(fps ?? 60)));
  const cap = Math.floor(renderFpsCap);

  if (cap <= 0) {
    return requestedFps;
  }

  return Math.max(1, Math.min(requestedFps, cap));
};

export function getDatamoshFrameSize(
  sourceWidth: number,
  sourceHeight: number,
  params: DatamoshParams
): { width: number; height: number } {
  const explicitWidth = normalizeDimension(params.width);
  const explicitHeight = normalizeDimension(params.height);

  if (explicitWidth && explicitHeight) {
    return clampFrameSize(explicitWidth, explicitHeight, sourceWidth, sourceHeight);
  }

  if (explicitWidth) {
    const height = Math.round(explicitWidth * (sourceHeight / sourceWidth));

    return clampFrameSize(explicitWidth, height, sourceWidth, sourceHeight);
  }

  if (explicitHeight) {
    const width = Math.round(explicitHeight * (sourceWidth / sourceHeight));

    return clampFrameSize(width, explicitHeight, sourceWidth, sourceHeight);
  }

  const scale = Math.max(0.05, Math.min(1, params.scale ?? 1));

  return {
    width: Math.max(1, Math.floor(sourceWidth * scale)),
    height: Math.max(1, Math.floor(sourceHeight * scale))
  };
}

const normalizeDimension = (value: number | undefined): number | null => {
  if (!Number.isFinite(value) || value === undefined) return null;

  return Math.max(1, Math.floor(value));
};

const clampFrameSize = (
  width: number,
  height: number,
  sourceWidth: number,
  sourceHeight: number
): { width: number; height: number } => ({
  width: Math.max(1, Math.min(width, sourceWidth)),
  height: Math.max(1, Math.min(height, sourceHeight))
});

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
