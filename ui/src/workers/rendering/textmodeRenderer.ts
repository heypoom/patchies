import type regl from 'regl';
import type { FBORenderer } from './fboRenderer';
import { CANVAS_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';
import { setupWorkerDOMMocks } from './workerDOMMocks';
import type { TextmodePlugin, Textmodifier } from 'textmode.js';
import { BaseWorkerRenderer, type BaseRendererConfig } from './BaseWorkerRenderer';
import { getFramebuffer } from './utils';

export class TextmodeRenderer extends BaseWorkerRenderer<BaseRendererConfig> {
  // textmode.js text modifier
  public tm: Textmodifier | null = null;
  public textmode: typeof import('textmode.js') | null = null;

  private lastRedrawAt: number | undefined;

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
  ): Promise<TextmodeRenderer> {
    const instance = new TextmodeRenderer(config, framebuffer, renderer);

    await instance.updateCode();

    return instance;
  }

  // Drive textmode synchronously: one frame → restore regl state.
  // The PatchiesPlugin redirects textmode's null framebuffer binds to our
  // regl FBO, so textmode renders directly into it — no blit needed.
  renderFrame() {
    if (!this.tm) return;

    const now = performance.now();
    const targetFrameRate = this.tm.targetFrameRate();

    const frameInterval =
      typeof targetFrameRate === 'number' && targetFrameRate > 0
        ? 1000 / targetFrameRate
        : undefined;

    if (
      frameInterval !== undefined &&
      this.lastRedrawAt !== undefined &&
      now - this.lastRedrawAt < frameInterval
    ) {
      return;
    }

    this.lastRedrawAt = now;
    this.tm.redraw();
    this.renderer.regl._refresh();
  }

  public async updateCode() {
    this.resetState();
    this.lastRedrawAt = undefined;

    try {
      const [width, height] = this.renderer.outputSize;

      // Setup DOM mocks before importing textmode.js (it expects document, window APIs)
      setupWorkerDOMMocks();

      // Import and create textmode instance
      if (!this.textmode) {
        this.textmode = await import('textmode.js');
      }

      const gl = this.renderer.gl;
      // Mutable ref so the plugin always targets the current FBO,
      // even after graph rebuilds swap the regl framebuffer.
      const getTargetFBO = () => getFramebuffer(this.framebuffer);

      // Create a textmode if not already created
      if (!this.tm) {
        // @ts-expect-error -- OffscreenCanvas is looked up thru GL context.
        this.renderer.offscreenCanvas.style = {};

        const { FiltersPlugin } = await import('textmode.filters.js');
        const { SynthPlugin } = await import('textmode.synth.js');

        const originalBindFramebuffer = gl.bindFramebuffer.bind(gl);
        // During textmode's draw cycle, redirect null (default FB) → our regl FBO.
        // This makes textmode render directly into the FBO, avoiding a blit step
        // and the OffscreenCanvas transferToImageBitmap() workaround.
        const redirectedBindFramebuffer = (
          target: number,
          framebuffer: WebGLFramebuffer | null
        ) => {
          if (target === gl.FRAMEBUFFER && framebuffer === null) {
            originalBindFramebuffer(target, getTargetFBO());
          } else {
            originalBindFramebuffer(target, framebuffer);
          }
        };

        const PatchiesPlugin: TextmodePlugin = {
          name: 'patchies',
          install(_tm, api) {
            api.on('preDraw', () => {
              gl.bindFramebuffer = redirectedBindFramebuffer;
            });

            api.on('postDraw', () => {
              gl.bindFramebuffer = originalBindFramebuffer;
            });
          }
        };

        this.tm = this.textmode.textmode.create({
          width,
          height,
          fontSize: 18,
          frameRate: 60,
          plugins: [FiltersPlugin, SynthPlugin, PatchiesPlugin],

          // Share regl's WebGL2 context — no separate canvas, no CPU roundtrip
          gl: this.renderer.gl,

          loadingScreen: {
            transition: 'none',
            transitionDuration: 0
          }
        });
      }

      const {
        cellColor,
        char,
        charColor,
        gradient,
        noise,
        plasma,
        moire,
        osc,
        paint,
        shape,
        solid,
        src,
        voronoi,
        setGlobalErrorCallback
      } = await import('textmode.synth.js');

      // Route synth parameter evaluation errors through our error handler
      setGlobalErrorCallback((error: unknown) => {
        this.handleCodeError(error, CANVAS_WRAPPER_OFFSET);
      });

      const extraContext = {
        ...this.buildBaseExtraContext(),
        t: this.tm,
        tm: this.tm,
        textmode: this.textmode.textmode,
        cellColor,
        char,
        charColor,
        gradient,
        noise,
        plasma,
        moire,
        osc,
        paint,
        shape,
        solid,
        src,
        voronoi
      };

      await this.executeUserCode(this.config.code, extraContext);
    } catch (error) {
      this.handleCodeError(error, CANVAS_WRAPPER_OFFSET);
    } finally {
      // Stop textmode's internal rAF loop. We drive rendering synchronously
      // from render() via redraw(), just like Three.js — this avoids two
      // async rAF loops fighting over GL state on the shared context.
      this.tm?.noLoop();
    }
  }

  destroy() {
    this.tm?.destroy();

    super.destroy();
  }

  setHidePorts(hidePorts: boolean) {
    self.postMessage({
      type: 'setHidePorts',
      nodeId: this.config.nodeId,
      hidePorts
    });
  }
}
