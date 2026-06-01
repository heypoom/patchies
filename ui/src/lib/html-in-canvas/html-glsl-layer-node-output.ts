import { buildShaderToyFragmentShader, SHADERTOY_VERTEX_SHADER } from '$lib/canvas/shadertoy-draw';
import { createBrowserResolver } from '$lib/glsl-include/browser-resolver';
import { processIncludes } from '$lib/glsl-include/preprocessor';
import type { IncludeResolver } from '$lib/glsl-include/preprocessor';
import {
  configureHtmlCanvasElement,
  requestHtmlCanvasPaint,
  syncHtmlCanvasSize
} from './html-canvas-video-output';
import type { HtmlCanvasSize, HtmlCanvasSupport } from './html-canvas-video-output';
import { getRecord, resolveHtmlLayerSize } from './utils';

export type HtmlGlslLayerOptions = string | false | undefined;

export type HtmlGlslLayerNodeOutputState = {
  enabled: boolean;
};

export type HtmlGlslLayerNodeOutputHost = {
  getRootElement: () => HTMLElement | undefined;
  getCanvasElement: () => HTMLCanvasElement | undefined;
  getExplicitSize?: () => { width?: number; height?: number };
  warn: (message: string) => void;
  scheduleRun: () => void;
  onStateChange?: (state: HtmlGlslLayerNodeOutputState) => void;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
  now?: () => number;
  getPixelRatio?: () => number;
  detectSupport?: () => HtmlCanvasSupport;
  getElementTransform?: (element: Element) => DOMMatrix;
  includeResolver?: IncludeResolver;
};

type GlslProgram = {
  program: WebGLProgram;
  positionBuffer: WebGLBuffer;
  sourceTexture: WebGLTexture;
  positionLocation: number;
  sourceLocation: WebGLUniformLocation | null;
  resolutionLocation: WebGLUniformLocation | null;
  timeLocation: WebGLUniformLocation | null;
  timeDeltaLocation: WebGLUniformLocation | null;
  frameLocation: WebGLUniformLocation | null;
};

function createHtmlGlslLayerSupport({
  canvas,
  context
}: {
  canvas: unknown;
  context: unknown;
}): HtmlCanvasSupport {
  const missing: string[] = [];
  const canvasRecord = getRecord(canvas);
  const contextRecord = getRecord(context);

  if (typeof canvasRecord?.requestPaint !== 'function') {
    missing.push('HTMLCanvasElement.requestPaint');
  }

  if (typeof contextRecord?.texElementImage2D !== 'function') {
    missing.push('WebGL2RenderingContext.texElementImage2D');
  }

  return {
    supported: missing.length === 0,
    missing
  };
}

function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Could not create shader');

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || 'Shader compile failed');
  }

  return shader;
}

const createFragmentShader = (source: string) =>
  buildShaderToyFragmentShader({
    code: source,
    extraUniforms: 'uniform sampler2D source;',
    fragCoordExpression: 'vec2(gl_FragCoord.x, iResolution.y - gl_FragCoord.y)'
  });

function createProgram(gl: WebGL2RenderingContext, source: string): GlslProgram {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, SHADERTOY_VERTEX_SHADER);
  const userFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, createFragmentShader(source));

  const program = gl.createProgram();
  if (!program) throw new Error('Could not create shader program');

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, userFragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || 'Shader link failed');
  }

  const positionBuffer = gl.createBuffer();
  const sourceTexture = gl.createTexture();

  if (!positionBuffer || !sourceTexture) {
    throw new Error('Could not create WebGL resources');
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );

  gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return {
    program,
    positionBuffer,
    sourceTexture,
    positionLocation: gl.getAttribLocation(program, 'position'),
    sourceLocation: gl.getUniformLocation(program, 'source'),
    resolutionLocation: gl.getUniformLocation(program, 'iResolution'),
    timeLocation: gl.getUniformLocation(program, 'iTime'),
    timeDeltaLocation: gl.getUniformLocation(program, 'iTimeDelta'),
    frameLocation: gl.getUniformLocation(program, 'iFrame')
  };
}

export class HtmlGlslLayerNodeOutput {
  private source: string | null = null;
  private program: GlslProgram | null = null;
  private resolvedSource: string | null = null;
  private pendingIncludeSource: string | null = null;
  private includeRequestId = 0;
  private frameId: number | null = null;
  private startedAt = 0;
  private lastFrameAt = 0;
  private frame = 0;

  constructor(private host: HtmlGlslLayerNodeOutputHost) {}

  get enabled() {
    return this.source !== null;
  }

  get state(): HtmlGlslLayerNodeOutputState {
    return { enabled: this.enabled };
  }

  enable = (options: HtmlGlslLayerOptions) => {
    if (options === false || options === undefined) {
      const wasEnabled = this.enabled;
      this.stop();
      if (wasEnabled) this.host.scheduleRun();
      return false;
    }

    const support = this.detectSupport();
    if (!support.supported) {
      this.host.warn(
        `htmlCanvas.glslLayer() requires Chrome's experimental HTML-in-Canvas API. Missing: ${support.missing.join(', ')}`
      );
      return false;
    }

    const wasEnabled = this.enabled;
    this.source = options;
    this.program = null;
    this.resolvedSource = null;
    this.pendingIncludeSource = null;
    this.includeRequestId += 1;
    this.frame = 0;
    this.startedAt = this.now();
    this.lastFrameAt = this.startedAt;
    this.emitState();

    if (!wasEnabled) this.host.scheduleRun();

    return true;
  };

  stop() {
    if (this.frameId !== null) {
      this.cancelFrame(this.frameId);
      this.frameId = null;
    }

    const wasEnabled = this.enabled;
    this.source = null;
    this.program = null;
    this.resolvedSource = null;
    this.pendingIncludeSource = null;
    this.includeRequestId += 1;

    if (wasEnabled) this.emitState();
  }

  setup() {
    const canvas = this.host.getCanvasElement();
    const rootElement = this.host.getRootElement();
    if (!this.source || !canvas || !rootElement) return false;

    const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
    const support = createHtmlGlslLayerSupport({ canvas, context: gl });

    if (!gl || !support.supported) {
      this.host.warn(
        `htmlCanvas.glslLayer() requires Chrome's experimental HTML-in-Canvas WebGL API. Missing: ${support.missing.join(', ')}`
      );

      this.stop();

      return false;
    }

    configureHtmlCanvasElement(canvas, this.resolveSize(rootElement));

    const htmlCanvas = canvas as HTMLCanvasElement & {
      onpaint: ((event: Event) => void) | null;
    };

    htmlCanvas.onpaint = () => this.paint();
    this.requestPaintLoop();

    try {
      const source = this.getPreparedSource();
      if (source) this.program = createProgram(gl, source);
    } catch (error) {
      this.host.warn(error instanceof Error ? error.message : String(error));
      this.stop();
      return false;
    }

    return true;
  }

  paint = (timestamp = this.now()) => {
    const canvas = this.host.getCanvasElement();
    const rootElement = this.host.getRootElement();
    if (!this.source || !canvas || !rootElement) return;

    const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
    if (!gl) return;

    if (!this.program) {
      try {
        const source = this.getPreparedSource();
        if (!source) return;

        this.program = createProgram(gl, source);
      } catch (error) {
        this.host.warn(error instanceof Error ? error.message : String(error));
        this.stop();
        return;
      }
    }

    const size = this.resolveSize(rootElement);
    const resized = syncHtmlCanvasSize(canvas, size);

    if (resized) {
      this.requestPaint();
      return;
    }

    gl.bindTexture(gl.TEXTURE_2D, this.program.sourceTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    try {
      (
        gl as WebGL2RenderingContext & {
          texElementImage2D: (
            target: number,
            level: number,
            internalformat: number,
            width: number,
            height: number,
            format: number,
            type: number,
            element: Element
          ) => void;
        }
      ).texElementImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        size.width,
        size.height,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        rootElement
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'InvalidStateError') {
        this.requestPaint();
        return;
      }

      throw error;
    }

    rootElement.style.transform = this.getTransform(rootElement).toString();

    const elapsed = timestamp - this.startedAt;
    const delta = timestamp - this.lastFrameAt;
    this.lastFrameAt = timestamp;

    gl.viewport(0, 0, size.width, size.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.program.positionBuffer);
    gl.enableVertexAttribArray(this.program.positionLocation);
    gl.vertexAttribPointer(this.program.positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.program.sourceTexture);

    if (this.program.sourceLocation) gl.uniform1i(this.program.sourceLocation, 0);
    if (this.program.resolutionLocation) {
      gl.uniform3f(
        this.program.resolutionLocation,
        size.width,
        size.height,
        size.width / size.height
      );
    }
    if (this.program.timeLocation) gl.uniform1f(this.program.timeLocation, elapsed / 1000);
    if (this.program.timeDeltaLocation) gl.uniform1f(this.program.timeDeltaLocation, delta / 1000);
    if (this.program.frameLocation) gl.uniform1i(this.program.frameLocation, this.frame);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.frame += 1;
  };

  requestPaint() {
    requestHtmlCanvasPaint(this.host.getCanvasElement());
  }

  private resolveSize(rootElement: HTMLElement): HtmlCanvasSize {
    return resolveHtmlLayerSize({
      rootElement,
      explicitSize: this.host.getExplicitSize?.(),
      pixelRatio: this.pixelRatio()
    });
  }

  private getTransform(element: Element) {
    return this.host.getElementTransform?.(element) ?? new DOMMatrix();
  }

  private requestPaintLoop() {
    this.requestPaint();

    if (this.frameId !== null) this.cancelFrame(this.frameId);

    this.frameId = this.requestFrame(() => {
      this.frameId = null;
      this.requestPaintLoop();
    });
  }

  private detectSupport() {
    if (this.host.detectSupport) return this.host.detectSupport();

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2');

    return createHtmlGlslLayerSupport({ canvas, context });
  }

  private getPreparedSource() {
    if (!this.source) return null;
    if (this.resolvedSource) return this.resolvedSource;

    if (!this.source.includes('#include')) {
      this.resolvedSource = this.source;

      return this.resolvedSource;
    }

    const requestId = ++this.includeRequestId;
    const source = this.source;
    if (this.pendingIncludeSource === source) return null;

    this.pendingIncludeSource = source;
    const resolver = this.host.includeResolver ?? createBrowserResolver();

    processIncludes(source, resolver).then(
      (resolved) => {
        if (requestId !== this.includeRequestId || this.source !== source) return;

        this.resolvedSource = resolved;
        this.pendingIncludeSource = null;
        this.program = null;
        this.host.scheduleRun();
      },
      (error) => {
        if (requestId !== this.includeRequestId || this.source !== source) return;

        this.pendingIncludeSource = null;
        this.host.warn(error instanceof Error ? error.message : String(error));
        this.stop();
      }
    );

    return null;
  }

  private requestFrame(callback: FrameRequestCallback) {
    return this.host.requestFrame?.(callback) ?? requestAnimationFrame(callback);
  }

  private cancelFrame(id: number) {
    (this.host.cancelFrame ?? cancelAnimationFrame)(id);
  }

  private now() {
    return this.host.now?.() ?? performance.now();
  }

  private pixelRatio() {
    return Math.max(1, this.host.getPixelRatio?.() ?? globalThis.devicePixelRatio ?? 1);
  }

  private emitState() {
    this.host.onStateChange?.(this.state);
  }
}
