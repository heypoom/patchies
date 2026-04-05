import type { Hydra, HydraErrorContext } from '$lib/hydra';
import type regl from 'regl';
import type { FBORenderer } from './fboRenderer';
import type { RenderParams } from '$lib/rendering/types';
import { getFramebuffer } from './utils';
import { parseJSError, countLines } from '$lib/js-runner/js-error-parser';
import { HYDRA_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';
import { BaseWorkerRenderer, type BaseRendererConfig } from './BaseWorkerRenderer';

export class HydraRenderer extends BaseWorkerRenderer<BaseRendererConfig> {
  public precision: 'highp' | 'mediump' = 'highp';
  public hydra: Hydra | null = null;

  private timestamp = performance.now();
  private sourceToParamIndexMap: (number | null)[] = [null, null, null, null];

  // Mouse scope: 'local' = canvas-relative, 'global' = screen-relative
  private mouseScope: 'global' | 'local' = 'local';

  // Hydra-specific error throttling (separate from base class to avoid key collisions)
  private hydraLastRuntimeError: string | null = null;
  private hydraLastRuntimeErrorTime = 0;

  private constructor(
    config: BaseRendererConfig,
    framebuffer: regl.Framebuffer2D,
    renderer: FBORenderer
  ) {
    super(config, framebuffer, renderer);
  }

  static async create(
    config: BaseRendererConfig,
    framebuffer: regl.Framebuffer2D,
    renderer: FBORenderer
  ): Promise<HydraRenderer> {
    const { Hydra } = await import('$lib/hydra');
    const arrayUtils = await import('$lib/hydra/lib/array-utils');

    arrayUtils.default.init();

    const instance = new HydraRenderer(config, framebuffer, renderer);

    const [width, height] = instance.renderer.outputSize;

    instance.hydra = new Hydra({
      regl: instance.renderer.regl,
      width,
      height,
      numSources: 4,
      numOutputs: 4,
      precision: instance.precision,
      onError: (error: unknown, context: HydraErrorContext) =>
        instance.handleHydraRuntimeError(error, context)
    });

    await instance.updateCode();

    return instance;
  }

  renderFrame(params: RenderParams) {
    if (!this.hydra) return;

    // Update mouse state from render params
    this.mouseX = params.mouseX;
    this.mouseY = params.mouseY;

    const time = performance.now();
    const deltaTime = time - this.timestamp;

    // Use global transport time for synchronized timing
    this.hydra.synth.time = params.transportTime;
    this.hydra.timeSinceLastUpdate += deltaTime;

    this.hydra.sources.forEach((source, sourceIndex) => {
      if (!this.hydra) return;

      if (this.sourceToParamIndexMap[sourceIndex] !== null) {
        const paramIndex = this.sourceToParamIndexMap[sourceIndex];

        const param = params.userParams[paramIndex] as regl.Texture2D;
        if (!param) return;

        if (
          'width' in param &&
          'height' in param &&
          // @ts-expect-error -- internal regl property
          param._reglType === 'texture2d'
        ) {
          source.tex = param;
        }

        return;
      }

      source.tick();
    });

    this.hydra.outputs.forEach((output) => {
      if (!this.hydra) return;

      output.tick(this.hydra.synth);
    });

    const hydraFramebuffer = this.hydra.output.getCurrent();
    const gl = this.renderer.gl;

    const [hydraWidth, hydraHeight] = this.hydra.synth.resolution;
    const [outputWidth, outputHeight] = this.renderer.outputSize;

    if (!gl || !hydraFramebuffer) return;

    const sourceFBO = getFramebuffer(hydraFramebuffer);
    const destPreviewFBO = getFramebuffer(this.framebuffer);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, destPreviewFBO);

    // Flip Y coordinates to match standard screen coordinates
    gl.blitFramebuffer(
      0,
      0,
      hydraWidth,
      hydraHeight,
      0,
      outputHeight,
      outputWidth,
      0,
      gl.COLOR_BUFFER_BIT,
      gl.LINEAR
    );

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

    this.hydra.timeSinceLastUpdate = 0;
    this.timestamp = time;
  }

  async updateCode() {
    if (!this.hydra) return;

    this.sourceToParamIndexMap = [null, null, null, null];

    this.resetState();

    // Reset mouse scope to local (default)
    this.mouseScope = 'local';

    try {
      const { generators } = await import('$lib/hydra');

      const { src, osc, gradient, shape, voronoi, noise, solid } = generators;
      const { sources, outputs, hush, render } = this.hydra;

      const [s0, s1, s2, s3] = sources;
      const [o0, o1, o2, o3] = outputs;

      // Clear any existing patterns
      this.stop();

      // Apply Hydra-specific code transformation (.out() -> .out(o0))
      const hydraCode = processCode(this.config.code);

      const extraContext = {
        ...this.buildBaseExtraContext(),
        h: this.hydra.synth,
        render,
        hush,

        // Generators
        osc,
        gradient,
        shape,
        voronoi,
        noise,
        src,
        solid,

        // Sources
        s0,
        s1,
        s2,
        s3,

        // Outputs
        o0,
        o1,
        o2,
        o3,

        setVideoCount: this.setVideoCount.bind(this),
        setMouseScope: this.setMouseScope.bind(this)
      };

      await this.executeUserCode(hydraCode, extraContext);
    } catch (error) {
      this.handleCodeError(error, HYDRA_WRAPPER_OFFSET);
    }
  }

  stop() {
    if (!this.hydra) return;

    this.hydra.hush();

    for (const source of this.hydra.sources) source.clear();
  }

  destroy() {
    if (!this.hydra) return;

    this.stop();

    for (const source of this.hydra.sources) {
      source.getTexture()?.destroy();
    }

    for (const output of this.hydra.outputs) {
      output.fbos.forEach((fbo) => fbo.destroy());
    }

    this.hydra = null;

    super.destroy();
  }

  setVideoCount(inletCount = 1, outletCount = 1) {
    // hydra allows max 4 inlets and outlets
    inletCount = Math.min(inletCount, 4);
    outletCount = Math.min(outletCount, 4);

    self.postMessage({
      type: 'setPortCount',
      portType: 'video',
      nodeId: this.config.nodeId,
      inletCount,
      outletCount
    });

    for (let i = 0; i < inletCount; i++) {
      this.sourceToParamIndexMap[i] = i;
    }
  }

  setHidePorts(hidePorts: boolean) {
    self.postMessage({
      type: 'setHidePorts',
      nodeId: this.config.nodeId,
      hidePorts
    });
  }

  setMouseScope(scope: 'global' | 'local') {
    this.mouseScope = scope;

    self.postMessage({
      type: 'setMouseScope',
      nodeId: this.config.nodeId,
      scope
    });
  }

  /**
   * Handles runtime errors from Hydra transforms (e.g., errors in arrow functions
   * passed to osc(), rotate(), etc.). Throttled to avoid flooding at high frame rates.
   */
  private handleHydraRuntimeError(error: unknown, context: HydraErrorContext): void {
    const { nodeId, code } = this.config;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const errorKey = `${context.transformName}:${context.paramName}:${errorMessage}`;
    const now = performance.now();

    if (this.hydraLastRuntimeError === errorKey && now - this.hydraLastRuntimeErrorTime < 1000) {
      return;
    }

    this.hydraLastRuntimeError = errorKey;
    this.hydraLastRuntimeErrorTime = now;

    const contextInfo =
      context.transformType === 'render'
        ? 'during render'
        : `in ${context.transformName}() parameter "${context.paramName}"`;

    const errorInfo = parseJSError(error, countLines(code), HYDRA_WRAPPER_OFFSET);

    self.postMessage({
      type: 'consoleOutput',
      nodeId,
      level: 'error',
      args: [`Error ${contextInfo}: ${errorMessage}`],
      lineErrors: errorInfo?.lineErrors
    });
  }
}

const processCode = (code: string) => code.replace('.out()', '.out(o0)');
