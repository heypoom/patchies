import type { Hydra, HydraErrorContext } from '$lib/hydra';
import {
  processGlsl,
  createGenerator,
  addTransformChainMethod
} from '$lib/hydra/glsl/createGenerators';
import type { TransformDefinition } from '$lib/hydra/glsl/transformDefinitions';
import { createWorkerResolver } from '$lib/glsl-include/worker-resolver';
import { processIncludes } from '$lib/glsl-include/preprocessor';
import type regl from 'regl';
import type { FBORenderer } from './fboRenderer';
import type { RenderParams } from '$lib/rendering/types';
import { getFramebuffer } from './utils';
import { parseJSError, countLines } from '$lib/js-runner/js-error-parser';
import { HYDRA_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';
import { BaseWorkerRenderer, type BaseRendererConfig } from './BaseWorkerRenderer';

export interface HydraRendererConfig extends BaseRendererConfig {
  videoInletCount?: number;
  videoOutletCount?: number;
}

export class HydraRenderer extends BaseWorkerRenderer<HydraRendererConfig> {
  public precision: 'highp' | 'mediump' = 'highp';
  public hydra: Hydra | null = null;

  private timestamp = performance.now();
  private sourceToParamIndexMap: (number | null)[] = [null, null, null, null];
  private videoOutletCount = 1;

  // Mouse scope: 'local' = canvas-relative, 'global' = screen-relative
  private mouseScope: 'global' | 'local' = 'local';

  // Hydra-specific error throttling (separate from base class to avoid key collisions)
  private hydraLastRuntimeError: string | null = null;
  private hydraLastRuntimeErrorTime = 0;

  private constructor(
    config: HydraRendererConfig,
    framebuffer: regl.Framebuffer2D,
    renderer: FBORenderer
  ) {
    super(config, framebuffer, renderer);
  }

  static async create(
    config: HydraRendererConfig,
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
      numSources: config.videoInletCount ?? 4,
      numOutputs: config.videoOutletCount ?? 4,
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

    const gl = this.renderer.gl;
    if (!gl) return;

    const [hydraWidth, hydraHeight] = this.hydra.synth.resolution;
    const [outputWidth, outputHeight] = this.renderer.outputSize;
    const destPreviewFBO = getFramebuffer(this.framebuffer);

    for (let i = 0; i < this.videoOutletCount; i++) {
      const hydraFramebuffer = this.hydra.outputs[i]?.getCurrent();
      if (!hydraFramebuffer) continue;

      const sourceFBO = getFramebuffer(hydraFramebuffer);

      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceFBO);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, destPreviewFBO);

      if (this.videoOutletCount > 1) {
        // Target only the i-th color attachment for MRT
        const drawBuffers = new Array(this.videoOutletCount).fill(gl.NONE) as number[];
        drawBuffers[i] = gl.COLOR_ATTACHMENT0 + i;
        gl.drawBuffers(drawBuffers);
      }

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
    }

    if (this.videoOutletCount > 1) {
      // Restore full drawBuffers state on the MRT FBO
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, destPreviewFBO);
      gl.drawBuffers(
        Array.from({ length: this.videoOutletCount }, (_, i) => gl.COLOR_ATTACHMENT0 + i)
      );
    }

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

    this.hydra.timeSinceLastUpdate = 0;
    this.timestamp = time;
  }

  async updateCode() {
    if (!this.hydra) return;

    this.sourceToParamIndexMap = [null, null, null, null];
    this.videoOutletCount = 1;

    this.resetState();

    // Reset mouse scope to local (default)
    this.mouseScope = 'local';

    try {
      const { generators } = await import('$lib/hydra');

      const { src, osc, gradient, shape, voronoi, noise, solid, TransformChainClass } = generators;

      const resolver = createWorkerResolver(this.config.nodeId);

      // Used to add more Hydra operators. Supports #include in the glsl field.
      const setFunction = async (definition: TransformDefinition) => {
        // Extract #include lines from the glsl body. Included files resolve to top-level
        // function definitions which must live outside the transform function body.
        const includeRegex = /#include\s+[^\n]+/g;
        const includeLines = [...definition.glsl.matchAll(includeRegex)].map((m) => m[0]);
        const bodyGlsl = definition.glsl.replace(includeRegex, '');

        const preamble =
          includeLines.length > 0 ? await processIncludes(includeLines.join('\n'), resolver) : '';

        // Build the processed definition: preamble (helper functions) before the wrapped body
        const processed = processGlsl({ ...definition, glsl: bodyGlsl });
        const finalProcessed = { ...processed, glsl: preamble + processed.glsl };

        if (definition.type === 'src') {
          // processGlsl is now idempotent — createGenerator won't double-wrap
          return createGenerator(finalProcessed, TransformChainClass);
        } else {
          addTransformChainMethod(TransformChainClass, finalProcessed);
        }
      };

      const { sources, outputs, hush, render } = this.hydra;

      // Clear any existing patterns
      this.stop();

      // Apply Hydra-specific code transformation (.out() -> .out(o0))
      const hydraCode = processCode(this.config.code);

      // Build sN/oN context entries dynamically from the actual sources/outputs arrays
      const sourceContext = Object.fromEntries(sources.map((s, i) => [`s${i}`, s]));
      const outputContext = Object.fromEntries(outputs.map((o, i) => [`o${i}`, o]));

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

        // Sources (s0..sN-1) and outputs (o0..oN-1) derived from Hydra instance
        ...sourceContext,
        ...outputContext,

        setFunction,
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
    // cap to WebGL2's guaranteed MAX_COLOR_ATTACHMENTS / MAX_DRAW_BUFFERS
    inletCount = Math.min(inletCount, 8);
    outletCount = Math.min(outletCount, 8);

    this.videoOutletCount = outletCount;

    self.postMessage({
      type: 'setPortCount',
      portType: 'video',
      nodeId: this.config.nodeId,
      inletCount,
      outletCount
    });

    this.sourceToParamIndexMap = [null, null, null, null];
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
