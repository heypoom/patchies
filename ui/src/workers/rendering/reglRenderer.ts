import type regl from 'regl';
import type { FBORenderer } from './fboRenderer';
import type { RenderParams } from '$lib/rendering/types';
import { REGL_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';
import { BaseWorkerRenderer, type BaseRendererConfig } from './BaseWorkerRenderer';
import { processIncludes } from '$lib/glsl-include/preprocessor';
import type { IncludeResolver } from '$lib/glsl-include/preprocessor';
import { createWorkerResolver } from '$lib/glsl-include/worker-resolver';

const hasIncludes = (s: unknown): s is string => typeof s === 'string' && s.includes('#include');

async function preprocessReglConfig(
  config: Record<string, unknown>,
  resolver: IncludeResolver
): Promise<Record<string, unknown>> {
  // Trim frag/vert so `#version 300 es` lands on the first line even when
  // the shader is written as an indented template literal.
  const hasFrag = typeof config.frag === 'string';
  const hasVert = typeof config.vert === 'string';
  if (!hasFrag && !hasVert) return config;

  const result = { ...config };
  if (hasFrag) result.frag = (result.frag as string).trim();
  if (hasVert) result.vert = (result.vert as string).trim();

  if (hasIncludes(result.frag)) {
    result.frag = await processIncludes(result.frag, resolver);
  }

  if (hasIncludes(result.vert)) {
    result.vert = await processIncludes(result.vert, resolver);
  }

  return result;
}

/**
 * Creates a tracked wrapper around regl that auto-cleans allocated resources.
 * Intercepts buffer/texture/elements/framebuffer/renderbuffer creation and
 * draw command creation to track them for bulk cleanup.
 *
 * Also intercepts regl.clear() to auto-inject the output framebuffer when
 * the user omits it, preventing accidental main canvas clears.
 *
 * When a resolver is provided, #include directives in frag/vert shaders are
 * resolved automatically. regl() returns a Promise<DrawCommand> when includes
 * are detected, otherwise returns a DrawCommand synchronously.
 */
function createTrackedRegl(
  reglInstance: regl.Regl,
  getFramebuffer: () => regl.Framebuffer2D | null,
  resolver?: IncludeResolver,
  nodeId?: string
) {
  const tracked: Array<{ destroy(): void }> = [];
  let generation = 0;

  const proxy = new Proxy(reglInstance, {
    apply(target, thisArg, args) {
      const config = args[0] as Record<string, unknown> | undefined;

      // If shader strings contain #include, resolve them async then create the command
      if (resolver && config && (hasIncludes(config.frag) || hasIncludes(config.vert))) {
        const gen = generation;

        if (nodeId) self.postMessage({ type: 'includeProcessing', nodeId, active: true });

        return preprocessReglConfig(config, resolver).then((resolved) => {
          if (nodeId) self.postMessage({ type: 'includeProcessing', nodeId, active: false });

          const command = Reflect.apply(target, thisArg, [resolved, ...args.slice(1)]);

          // If destroyAll() was called while we were awaiting, discard the command
          if (gen !== generation) {
            try {
              command.destroy();
            } catch {
              /* already destroyed */
            }
            return command;
          }

          tracked.push(command);

          return command;
        });
      }

      // No includes preprocessing = synchronous draw calls
      const command = Reflect.apply(target, thisArg, args);
      tracked.push(command);

      return command;
    },
    get(target, prop) {
      const value = Reflect.get(target, prop);

      // Intercept resource creation methods
      if (
        prop === 'buffer' ||
        prop === 'texture' ||
        prop === 'elements' ||
        prop === 'framebuffer' ||
        prop === 'renderbuffer'
      ) {
        return (...args: unknown[]) => {
          const resource = value.apply(target, args);

          tracked.push(resource);

          return resource;
        };
      }

      // Intercept clear() to auto-inject framebuffer without mutating caller's object
      if (prop === 'clear') {
        return (options: Record<string, unknown>) => {
          if (options && !('framebuffer' in options)) {
            const framebuffer = getFramebuffer();

            if (framebuffer) {
              return value.call(target, { ...options, framebuffer });
            }
          }

          return value.call(target, options);
        };
      }

      return value;
    }
  });

  return {
    regl: proxy as regl.Regl,

    destroyAll() {
      generation++;

      for (const resource of tracked) {
        try {
          resource.destroy();
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
      // Create tracked regl wrapper with #include preprocessing
      const resolver = createWorkerResolver(this.config.nodeId);

      this.trackedRegl = createTrackedRegl(
        this.renderer.regl,
        () => this.framebuffer,
        resolver,
        this.config.nodeId
      );

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
