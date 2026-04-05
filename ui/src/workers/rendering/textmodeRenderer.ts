import type regl from 'regl';
import type { FBORenderer } from './fboRenderer';
import { CANVAS_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';
import { setupWorkerDOMMocks } from './workerDOMMocks';
import type { Textmodifier } from 'textmode.js';
import { BaseWorkerRenderer, type BaseRendererConfig } from './BaseWorkerRenderer';

export class TextmodeRenderer extends BaseWorkerRenderer<BaseRendererConfig> {
  private animationId: number | null = null;
  private lastUploadedFrame = -1;

  // textmode.js text modifier
  public tm: Textmodifier | null = null;
  public textmode: typeof import('textmode.js') | null = null;

  // Blit state for GPU-to-GPU copy
  private blitFBO: WebGLFramebuffer | null = null;

  private constructor(
    config: BaseRendererConfig,
    framebuffer: regl.Framebuffer2D,
    renderer: FBORenderer
  ) {
    super(config, framebuffer, renderer);
  }

  /** Reset draw command when framebuffer changes */
  resetDrawCommand() {}

  static async create(
    config: BaseRendererConfig,
    framebuffer: regl.Framebuffer2D,
    renderer: FBORenderer
  ): Promise<TextmodeRenderer> {
    const instance = new TextmodeRenderer(config, framebuffer, renderer);

    await instance.updateCode();

    return instance;
  }

  /** GPU-to-GPU blit from default framebuffer to regl FBO */
  private blitToFramebuffer() {
    if (!this.framebuffer) return;

    const gl = this.renderer.gl;
    const [width, height] = this.renderer.outputSize;

    // Get the regl FBO's underlying WebGL framebuffer
    // @ts-expect-error -- accessing regl internals
    const destFBO = this.framebuffer._framebuffer.framebuffer;

    // Read from default framebuffer (textmode's render target)
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    // Write to our destination FBO
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, destFBO);

    gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);

    // Restore default state
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  // Textmode uses its own render loop, not the pipeline's renderFrame
  renderFrame() {}

  public async updateCode() {
    this.resetState();

    // Cancel any existing animation frame
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

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
        const { createFiltersPlugin } = await import('textmode.filters.js');

        this.tm = this.textmode.create({
          width,
          height,
          fontSize: 18,
          frameRate: 60,
          plugins: [createFiltersPlugin()],

          // Share regl's WebGL2 context — no separate canvas, no CPU roundtrip
          gl: this.renderer.gl,

          // textmode needs a canvas for style/touch setup
          // @ts-expect-error -- OffscreenCanvas hack: textmode expects HTMLCanvasElement with style
          canvas: Object.assign(this.renderer.offscreenCanvas, { style: {} })
        });
      }

      const baseContext = this.buildBaseExtraContext();

      const extraContext = {
        ...baseContext,
        tm: this.tm,
        textmode: this.textmode,

        requestAnimationFrame: (callback: FrameRequestCallback) => {
          this.animationId = requestAnimationFrame((ts) => {
            this.renderer.drawProfiler.measure(this.config.nodeId, 'draw', () => callback(ts));
          });

          return this.animationId;
        },

        cancelAnimationFrame: (id: number) => {
          cancelAnimationFrame(id);

          if (this.animationId === id) {
            this.animationId = null;
          }
        }
      };

      await this.executeUserCode(this.config.code, extraContext);
    } catch (error) {
      this.handleCodeError(error, CANVAS_WRAPPER_OFFSET);
    }
  }

  destroy() {
    this.tm?.destroy();

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.blitFBO) {
      this.renderer.gl.deleteFramebuffer(this.blitFBO);
      this.blitFBO = null;
    }

    super.destroy();
  }

  public render() {
    if (!this.tm?.isLooping) return;

    // Prevent uploading more than the needed frame rate.
    const currentFrame = this.tm.frameCount;
    if (currentFrame === this.lastUploadedFrame) return;

    this.lastUploadedFrame = currentFrame;
    this.blitToFramebuffer();
  }

  setHidePorts(hidePorts: boolean) {
    self.postMessage({
      type: 'setHidePorts',
      nodeId: this.config.nodeId,
      hidePorts
    });
  }
}
