import type regl from 'regl';
import type { FBORenderer } from './fboRenderer';
import { CANVAS_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';
import { BaseWorkerRenderer, type BaseRendererConfig } from './BaseWorkerRenderer';

export class CanvasRenderer extends BaseWorkerRenderer<BaseRendererConfig> {
  public offscreenCanvas: OffscreenCanvas | null = null;
  public ctx: OffscreenCanvasRenderingContext2D | null = null;
  public canvasTexture: regl.Texture2D | null = null;

  private timestamp = performance.now();
  private animationId: number | null = null;
  private drawCommand: regl.DrawCommand | null = null;
  private pausedCallback: FrameRequestCallback | null = null;

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
  ): Promise<CanvasRenderer> {
    const instance = new CanvasRenderer(config, framebuffer, renderer);

    const [width, height] = instance.renderer.outputSize;

    instance.offscreenCanvas = new OffscreenCanvas(width, height);
    instance.ctx = instance.offscreenCanvas.getContext('2d');

    if (!instance.ctx) {
      throw new Error('Failed to get 2D context from OffscreenCanvas');
    }

    await instance.updateCode();

    return instance;
  }

  private drawCanvasToTexture() {
    if (!this.ctx || !this.offscreenCanvas || !this.framebuffer) return;

    this.ensureDrawCommand();

    // @ts-expect-error -- regl type is wrong
    this.canvasTexture?.({ data: this.offscreenCanvas, flipY: true });
    this.drawCommand?.();
  }

  ensureDrawCommand() {
    if (this.drawCommand || !this.ctx) return;

    // @ts-expect-error -- regl type is wrong
    this.canvasTexture = this.renderer.regl.texture({
      data: this.offscreenCanvas,
      flipY: true
    });

    this.drawCommand = this.renderer.regl({
      framebuffer: this.framebuffer,
      vert: `
        attribute vec2 position;
        varying vec2 uv;
        void main() {
          uv = position * 0.5 + 0.5;
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

  // Canvas uses RAF internally, not the pipeline's renderFrame
  renderFrame() {}

  public async updateCode() {
    if (!this.ctx || !this.offscreenCanvas) return;

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

      const extraContext = {
        ...this.buildBaseExtraContext(),
        canvas: this.offscreenCanvas,
        ctx: this.ctx,

        requestAnimationFrame: (callback: FrameRequestCallback) => {
          // Store callback for resume
          this.pausedCallback = callback;

          // Don't schedule if paused
          if (this.renderer.isNodePaused(this.config.nodeId)) {
            return -1;
          }

          this.animationId = requestAnimationFrame((ts) => {
            this.renderer.drawProfiler.measure(this.config.nodeId, 'draw', () => callback(ts));

            this.drawCanvasToTexture();
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
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this.offscreenCanvas = null;
    this.ctx = null;

    super.destroy();
  }

  /** Resume animation loop after unpausing */
  resumeAnimation() {
    if (this.pausedCallback && !this.renderer.isNodePaused(this.config.nodeId)) {
      const callback = this.pausedCallback;

      this.animationId = requestAnimationFrame(() => {
        callback(performance.now());

        this.drawCanvasToTexture();
      });
    }
  }

  setHidePorts(hidePorts: boolean) {
    self.postMessage({
      type: 'setHidePorts',
      nodeId: this.config.nodeId,
      hidePorts
    });
  }
}
