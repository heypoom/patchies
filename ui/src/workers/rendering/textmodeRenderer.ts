import type regl from 'regl';
import type { FBORenderer } from './fboRenderer';
import { CANVAS_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';
import { setupWorkerDOMMocks } from './workerDOMMocks';
import type { Textmodifier } from 'textmode.js';
import { BaseWorkerRenderer, type BaseRendererConfig } from './BaseWorkerRenderer';
import { getFramebuffer } from './utils';

export class TextmodeRenderer extends BaseWorkerRenderer<BaseRendererConfig> {
  // textmode.js text modifier
  public tm: Textmodifier | null = null;
  public textmode: typeof import('textmode.js') | null = null;

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

  // Drive textmode synchronously: one frame → blit → restore regl state.
  // This mirrors how Three.js renders on the shared GL context.
  renderFrame() {
    if (!this.tm) return;

    this.tm.redraw();
    this.renderer.regl._refresh();

    this.blitToReglFramebuffer();
  }

  /** Blit from default framebuffer (textmode's present target) to regl FBO */
  private blitToReglFramebuffer() {
    if (!this.framebuffer) return;

    const gl = this.renderer.gl;
    const [width, height] = this.renderer.outputSize;
    const destFBO = getFramebuffer(this.framebuffer);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, destFBO);
    gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  public async updateCode() {
    this.resetState();

    try {
      const [width, height] = this.renderer.outputSize;

      // Setup DOM mocks before importing textmode.js (it expects document, window APIs)
      setupWorkerDOMMocks();

      // Import and create textmode instance
      if (!this.textmode) {
        this.textmode = await import('textmode.js');
      }

      // Create a textmode if not already created
      if (!this.tm) {
        // @ts-expect-error -- OffscreenCanvas is looked up thru GL context.
        this.renderer.offscreenCanvas.style = {};

        const { FiltersPlugin } = await import('textmode.filters.js');

        this.tm = this.textmode.create({
          width,
          height,
          fontSize: 18,
          frameRate: 60,
          plugins: [FiltersPlugin],

          // Share regl's WebGL2 context — no separate canvas, no CPU roundtrip
          gl: this.renderer.gl,

          loadingScreen: {
            message: 'Loading textmode...',
            tone: 'dark',
            transition: 'none',
            transitionDuration: 0
          }
        });
      }

      const extraContext = {
        ...this.buildBaseExtraContext(),
        tm: this.tm,
        textmode: this.textmode
      };

      await this.executeUserCode(this.config.code, extraContext);

      // Stop textmode's internal rAF loop. We drive rendering synchronously
      // from render() via redraw(), just like Three.js — this avoids two
      // async rAF loops fighting over GL state on the shared context.
      this.tm?.noLoop();
    } catch (error) {
      this.handleCodeError(error, CANVAS_WRAPPER_OFFSET);
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
