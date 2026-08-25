import type regl from 'regl';
import type { Container, RenderTexture, WebGLRenderer } from 'pixi.js';

import type { RenderParams } from '$lib/rendering/types';
import { getFramebuffer } from './utils';
import { BaseWorkerRenderer, type BaseRendererConfig } from './BaseWorkerRenderer';
import type { FBORenderer } from './fboRenderer';

type PixiRendererConfig = BaseRendererConfig & { runRevision?: number };
type PixiRuntime = typeof import('pixi.js');

type PixiGpuRenderTarget = {
  framebuffer: WebGLFramebuffer | null;
  resolveTargetFramebuffer: WebGLFramebuffer | null;
};

type SizedFramebuffer = regl.Framebuffer2D & { width: number; height: number };

let pixiRuntimePromise: Promise<PixiRuntime> | null = null;

const loadPixiRuntime = () => {
  pixiRuntimePromise ??= (async () => {
    const PIXI = await import('pixi.js');

    // Graphics is an extension side-effect import. Load it before constructing
    // the renderer so user code can create PIXI.Graphics instances.
    await import('pixi.js/graphics');

    return PIXI;
  })();

  return pixiRuntimePromise;
};

export class PixiRenderer extends BaseWorkerRenderer<PixiRendererConfig> {
  private pixi: WebGLRenderer | null = null;
  private pixiRuntime: PixiRuntime | null = null;
  private stage: Container | null = null;
  private target: RenderTexture | null = null;
  private draw: ((time: number) => void) | null = null;
  private codeRevision = 0;

  private constructor(
    config: PixiRendererConfig,
    framebuffer: regl.Framebuffer2D,
    renderer: FBORenderer
  ) {
    super(config, framebuffer, renderer);
  }

  static async create(
    config: PixiRendererConfig,
    framebuffer: regl.Framebuffer2D,
    renderer: FBORenderer
  ) {
    const instance = new PixiRenderer(config, framebuffer, renderer);
    const PIXI = await loadPixiRuntime();

    PIXI.DOMAdapter.set(PIXI.WebWorkerAdapter);

    const sizedFramebuffer = framebuffer as SizedFramebuffer;
    const [outputWidth, outputHeight] = renderer.outputSize;
    const canvas = renderer.offscreenCanvas;

    instance.pixiRuntime = PIXI;
    instance.stage = new PIXI.Container();
    instance.pixi = new PIXI.WebGLRenderer();

    await instance.pixi.init({
      canvas,
      context: renderer.gl!,
      width: outputWidth,
      height: outputHeight,
      antialias: true
    });

    instance.target = PIXI.RenderTexture.create({
      width: sizedFramebuffer.width,
      height: sizedFramebuffer.height
    });

    await instance.updateCode();

    return instance;
  }

  renderFrame(params: RenderParams) {
    if (!this.pixi || !this.stage || !this.target || !this.framebuffer) return;
    if (this.renderer.transportTime && !this.renderer.transportTime.isPlaying) return;

    this.mouseX = params.mouseX;
    this.mouseY = params.mouseY;

    this.pixi.resetState();

    try {
      this.draw?.(params.transportTime);
      this.pixi.render({ container: this.stage, target: this.target, clear: true });
      this.blitTarget();
    } catch (error) {
      this.handleRuntimeError(error, 4);
    }

    this.pixi.resetState();
    this.renderer.regl._refresh();
  }

  async updateCode() {
    if (!this.pixi || !this.pixiRuntime) return;

    const revision = ++this.codeRevision;
    const nextStage = new this.pixiRuntime.Container();

    this.resetState();

    const code = `var draw;\n${this.config.code}\nreturn typeof draw === 'function' ? draw : null;`;

    try {
      const framebuffer = this.framebuffer as SizedFramebuffer | null;

      const result = await this.executeUserCode(code, {
        ...this.buildBaseExtraContext(),
        PIXI: this.pixiRuntime,
        renderer: this.pixi,
        stage: nextStage,
        width: framebuffer?.width ?? 0,
        height: framebuffer?.height ?? 0,
        mouse: { x: this.mouseX, y: this.mouseY }
      });

      if (revision !== this.codeRevision) {
        nextStage.destroy({ children: true });
        return;
      }

      this.stage?.destroy({ children: true });
      this.stage = nextStage;

      this.draw = typeof result === 'function' ? result : null;
    } catch (error) {
      this.handleCodeError(error, 4);
    }
  }

  async updateConfig(config: PixiRendererConfig, framebuffer: regl.Framebuffer2D) {
    const rerun =
      this.config.code !== config.code || this.config.runRevision !== config.runRevision;

    const previousFramebuffer = this.framebuffer as SizedFramebuffer | null;
    const nextFramebuffer = framebuffer as SizedFramebuffer;

    const hasResized =
      previousFramebuffer?.width !== nextFramebuffer.width ||
      previousFramebuffer?.height !== nextFramebuffer.height;

    this.config = config;
    this.framebuffer = framebuffer;

    const [outputWidth, outputHeight] = this.renderer.outputSize;

    this.pixi?.resize(outputWidth, outputHeight);

    if (hasResized) {
      this.target?.destroy(true);

      this.target =
        this.pixiRuntime?.RenderTexture.create({
          width: nextFramebuffer.width,
          height: nextFramebuffer.height
        }) ?? null;
    }

    if (rerun) {
      await this.updateCode();
    }
  }

  destroy() {
    this.codeRevision += 1;
    this.target?.destroy(true);
    this.stage?.destroy({ children: true });

    if (this.pixi) {
      // Pixi assumes it owns its WebGL context and loses it during destroy().
      // This renderer shares FBORenderer's context, so only destroy Pixi-owned resources.
      this.pixi.context.extensions.loseContext = undefined;
      this.pixi.destroy();
    }

    super.destroy();

    this.target = null;
    this.pixi = null;
    this.pixiRuntime = null;
    this.stage = null;
    this.draw = null;
  }

  private blitTarget() {
    if (!this.pixi || !this.target || !this.framebuffer) return;

    const source = this.getTargetFramebuffer();
    const destination = getFramebuffer(this.framebuffer);

    const gl = this.renderer.gl!;
    const { width, height } = this.framebuffer as SizedFramebuffer;

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, source);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, destination);

    gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private getTargetFramebuffer() {
    if (!this.pixi || !this.target) return null;

    const target = this.pixi.renderTarget.getRenderTarget(this.target);
    const gpuTarget = this.pixi.renderTarget.getGpuRenderTarget(target) as PixiGpuRenderTarget;

    this.pixi.renderTarget.finishRenderPass();

    return gpuTarget.resolveTargetFramebuffer ?? gpuTarget.framebuffer;
  }
}
