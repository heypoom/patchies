import type regl from 'regl';
import type { FBORenderer } from './fboRenderer';
import type { RenderParams } from '$lib/rendering/types';
import { REGL_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';
import { BaseWorkerRenderer, type BaseRendererConfig } from './BaseWorkerRenderer';

/**
 * Creates a tracked wrapper around regl that auto-cleans allocated resources.
 * Intercepts buffer/texture/elements/framebuffer/renderbuffer creation and
 * draw command creation to track them for bulk cleanup.
 *
 * Also intercepts regl.clear() to auto-inject the output framebuffer when
 * the user omits it, preventing accidental main canvas clears.
 */
function createTrackedRegl(
  reglInstance: regl.Regl,
  getFramebuffer: () => regl.Framebuffer2D | null
) {
  const tracked: Array<{ destroy(): void }> = [];

  const proxy = new Proxy(reglInstance, {
    apply(target, thisArg, args) {
      // regl({...}) creates a draw command
      const cmd = Reflect.apply(target, thisArg, args);
      tracked.push(cmd);
      return cmd;
    },
    get(target, prop) {
      const val = Reflect.get(target, prop);

      // Intercept resource creation methods
      if (
        prop === 'buffer' ||
        prop === 'texture' ||
        prop === 'elements' ||
        prop === 'framebuffer' ||
        prop === 'renderbuffer'
      ) {
        return (...args: unknown[]) => {
          const resource = (val as Function).apply(target, args);
          tracked.push(resource);
          return resource;
        };
      }

      // Intercept clear() to auto-inject framebuffer without mutating caller's object
      if (prop === 'clear') {
        return (opts: Record<string, unknown>) => {
          if (opts && !('framebuffer' in opts)) {
            const fb = getFramebuffer();
            if (fb) {
              return (val as Function).call(target, { ...opts, framebuffer: fb });
            }
          }
          return (val as Function).call(target, opts);
        };
      }

      return val;
    }
  });

  return {
    regl: proxy as regl.Regl,
    destroyAll() {
      for (const r of tracked) {
        try {
          r.destroy();
        } catch {
          // Resource may already be destroyed
        }
      }
      tracked.length = 0;
    }
  };
}

export class ReglRenderer extends BaseWorkerRenderer<BaseRendererConfig> {
  // User's render function
  private userRenderFunc: ((time: number) => void) | null = null;

  // Video input textures (from connected nodes)
  private inputTextures: (regl.Texture2D | undefined)[] = [];

  // Tracked regl wrapper for automatic resource cleanup
  private trackedRegl: ReturnType<typeof createTrackedRegl> | null = null;

  /** 1x1 transparent texture returned when an inlet is not connected */
  private fallbackTexture: regl.Texture2D;

  private constructor(
    config: BaseRendererConfig,
    framebuffer: regl.Framebuffer2D,
    renderer: FBORenderer
  ) {
    super(config, framebuffer, renderer);
    this.fallbackTexture = renderer.regl.texture({
      width: 1,
      height: 1,
      data: new Uint8Array([0, 0, 0, 0])
    });
  }

  static async create(
    config: BaseRendererConfig,
    framebuffer: regl.Framebuffer2D,
    renderer: FBORenderer
  ): Promise<ReglRenderer> {
    const instance = new ReglRenderer(config, framebuffer, renderer);
    await instance.updateCode();
    return instance;
  }

  renderFrame(params: RenderParams) {
    if (!this.userRenderFunc) return;

    // Skip rendering when transport is paused — FBO retains last frame
    if (this.renderer.transportTime && !this.renderer.transportTime.isPlaying) return;

    // Update mouse state from render params
    this.mouseX = params.mouseX;
    this.mouseY = params.mouseY;

    // Store input textures for getTexture() access
    this.inputTextures = params.userParams as (regl.Texture2D | undefined)[];

    // FBO is already bound by the pipeline (fboNode.framebuffer.use())
    try {
      this.userRenderFunc(params.transportTime);
    } catch (error) {
      this.handleRuntimeError(error, REGL_WRAPPER_OFFSET);
    }
  }

  async updateCode() {
    // Prevent stale render function from running during async rebuild
    this.userRenderFunc = null;

    // Clean up previous tracked resources
    this.trackedRegl?.destroyAll();

    this.resetState();

    try {
      // Create tracked regl wrapper
      this.trackedRegl = createTrackedRegl(this.renderer.regl, () => this.framebuffer);

      const extraContext = {
        ...this.buildBaseExtraContext(),
        regl: this.trackedRegl.regl,
        setVideoCount: this.setVideoCount.bind(this),
        getTexture: this.getTexture.bind(this),
        // No-op: regl uses render(time) called by the pipeline, not RAF
        requestAnimationFrame: () => {}
      };

      // Wrapper that extracts render() function
      const codeWithWrapper = `
        var recv = onMessage;
        var render;

        ${this.config.code}

        return typeof render === 'function' ? render : null;
      `;

      const userRender = await this.executeUserCode(codeWithWrapper, extraContext);

      this.userRenderFunc = typeof userRender === 'function' ? userRender : null;

      if (!this.userRenderFunc) {
        this.createCustomConsole().warn(
          'No render() function found. Define a render(time) function to draw each frame.'
        );
      }
    } catch (error) {
      this.handleCodeError(error, REGL_WRAPPER_OFFSET);
    }
  }

  destroy() {
    this.trackedRegl?.destroyAll();
    this.trackedRegl = null;
    this.fallbackTexture.destroy();
    this.userRenderFunc = null;
    super.destroy();
  }

  /**
   * Gets a regl texture from a video inlet.
   * Returns a 1x1 transparent fallback texture when the inlet is not connected,
   * so regl uniforms always receive a valid texture.
   */
  getTexture(index: number): regl.Texture2D {
    return this.inputTextures[index] ?? this.fallbackTexture;
  }

  setVideoCount(inletCount = 1, outletCount = 1) {
    self.postMessage({
      type: 'setPortCount',
      portType: 'video',
      nodeId: this.config.nodeId,
      inletCount,
      outletCount
    });
  }
}
