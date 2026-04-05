import type regl from 'regl';
import type { FBORenderer } from './fboRenderer';
import { CANVAS_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';
import { setupWorkerDOMMocks } from './workerDOMMocks';
import type { Textmodifier } from 'textmode.js';
import { BaseWorkerRenderer, type BaseRendererConfig } from './BaseWorkerRenderer';

export class TextmodeRenderer extends BaseWorkerRenderer<BaseRendererConfig> {
  public offscreenCanvas: OffscreenCanvas | null = null;
  public canvasTexture: regl.Texture2D | null = null;

  private timestamp = performance.now();
  private animationId: number | null = null;
  private drawCommand: regl.DrawCommand | null = null;
  private lastUploadedFrame = -1;

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

  /** Reset draw command when framebuffer changes */
  resetDrawCommand() {
    this.drawCommand = null;
    this.canvasTexture = null;
  }

  static async create(
    config: BaseRendererConfig,
    framebuffer: regl.Framebuffer2D,
    renderer: FBORenderer
  ): Promise<TextmodeRenderer> {
    const instance = new TextmodeRenderer(config, framebuffer, renderer);

    const [width, height] = instance.renderer.outputSize;

    instance.offscreenCanvas = new OffscreenCanvas(width, height);

    await instance.updateCode();

    return instance;
  }

  private drawCanvasToTexture() {
    if (!this.offscreenCanvas || !this.framebuffer) return;

    this.ensureDrawCommand();

    // @ts-expect-error -- regl type is wrong

    this.canvasTexture?.({ data: this.offscreenCanvas });
    this.drawCommand?.();
  }

  ensureDrawCommand() {
    if (this.drawCommand) return;

    // @ts-expect-error -- regl type is wrong
    this.canvasTexture = this.renderer.regl.texture({
      data: this.offscreenCanvas
    });

    this.drawCommand = this.renderer.regl({
      framebuffer: this.framebuffer,
      vert: `
        attribute vec2 position;
        varying vec2 uv;
        void main() {
          uv = vec2(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
          gl_Position = vec4(position, 0, 1);
        }
      `,
      frag: `
        precision mediump float;
        varying vec2 uv;
        uniform sampler2D canvasTexture;

        void main() {
          gl_FragColor = texture2D(canvasTexture, uv);
        }
      `,
      attributes: {
        position: [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1]
        ]
      },
      uniforms: { canvasTexture: this.canvasTexture },
      primitive: 'triangle strip',
      count: 4
    });
  }

  // Textmode uses its own render loop, not the pipeline's renderFrame
  renderFrame() {}

  public async updateCode() {
    if (!this.offscreenCanvas) return;

    this.resetState();

    // Cancel any existing animation frame
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    try {
      const [width, height] = this.renderer.outputSize;

      // Set canvas size
      this.offscreenCanvas.width = width;
      this.offscreenCanvas.height = height;

      // @ts-expect-error -- hack
      this.offscreenCanvas.style = {};

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

          // @ts-expect-error -- offscreen canvas hack
          canvas: this.offscreenCanvas
        });
      }

      const baseContext = this.buildBaseExtraContext();

      const extraContext = {
        ...baseContext,
        canvas: this.offscreenCanvas,
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

    this.offscreenCanvas = null;

    super.destroy();
  }

  public render() {
    if (!this.tm?.isLooping) return;

    // Prevent uploading more than the needed frame rate.
    const currentFrame = this.tm.frameCount;
    if (currentFrame === this.lastUploadedFrame) return;

    this.lastUploadedFrame = currentFrame;
    this.drawCanvasToTexture();
  }

  setHidePorts(hidePorts: boolean) {
    self.postMessage({
      type: 'setHidePorts',
      nodeId: this.config.nodeId,
      hidePorts
    });
  }
}
