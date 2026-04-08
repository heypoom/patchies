import type regl from 'regl';

import type { FBORenderer } from './fboRenderer';
import type { RenderParams } from '$lib/rendering/types';
import { TextureSampler, type SwissGL } from '$lib/rendering/swissgl';
import { getFramebuffer } from './utils';
import { BaseWorkerRenderer, type BaseRendererConfig } from './BaseWorkerRenderer';
import { processIncludes } from '$lib/glsl-include/preprocessor';
import { createWorkerResolver } from '$lib/glsl-include/worker-resolver';

const SAMPLER_2D_TEMPLATE = `
  uniform sampler2D $name;
  #define $name(p) (_sample($name, (p)))
  ivec2 $name_size() {return textureSize($name, 0);}
  vec2  $name_step() {return 1.0/vec2($name_size());}
`;

/**
 * Wraps a regl texture as a SwissGL-compatible TextureSampler so it can be
 * passed directly into glsl() calls as a uniform.
 *
 * Resolves the underlying WebGLTexture lazily at bind time via a callback,
 * so it always reads the current texture even if inputTextures changes
 * between frames.
 */
class ReglTextureSampler extends TextureSampler {
  declare _root: ReglTextureSampler;
  declare filter: string;
  declare wrap: string;
  gl: WebGL2RenderingContext;
  gltarget: number;

  /** Static handle for the fallback texture. */
  handle: WebGLTexture | null;

  /** Lazy resolver — when set, takes priority over static handle. */
  private resolveTexture: (() => WebGLTexture | null) | null;

  constructor(gl: WebGL2RenderingContext, texture: WebGLTexture);
  constructor(gl: WebGL2RenderingContext, resolver: () => WebGLTexture | null);
  constructor(gl: WebGL2RenderingContext, source: WebGLTexture | (() => WebGLTexture | null)) {
    super();
    this._root = this;
    this.gl = gl;
    this.gltarget = gl.TEXTURE_2D;
    this.filter = 'linear';
    this.wrap = 'repeat';

    if (typeof source === 'function') {
      this.resolveTexture = source;
      this.handle = null;
    } else {
      this.resolveTexture = null;
      this.handle = source;
    }
  }

  private getHandle(): WebGLTexture | null {
    return this.resolveTexture ? this.resolveTexture() : this.handle;
  }

  _getUniformCode(name: string) {
    return SAMPLER_2D_TEMPLATE.replaceAll('$name', name);
  }

  bindTexture() {
    this.gl.bindTexture(this.gltarget, this.getHandle());
  }
}

const SWGL_WRAPPER_OFFSET = 4;

export class SwissGLRenderer extends BaseWorkerRenderer<BaseRendererConfig> {
  private glsl: ReturnType<typeof SwissGL>;
  private gl: WebGL2RenderingContext;
  private swglTarget: { bindTarget: (gl: WebGL2RenderingContext) => number[] };

  // User's render function
  private userRenderFunc: ((params: { t: number }) => void) | null = null;

  // Video input textures (from connected nodes)
  private inputTextures: (regl.Texture2D | undefined)[] = [];
  private lazySamplers: (ReglTextureSampler | undefined)[] = [];

  /** 1x1 transparent texture returned when an inlet is not connected */
  private fallbackWebGLTexture: WebGLTexture | null = null;

  /** Cache of source→resolved include strings, pre-warmed during updateCode() */
  private includeCache = new Map<string, string>();

  /** Monotonic counter incremented on updateCode()/destroy() to detect stale async work */
  private generation = 0;

  private constructor(
    config: BaseRendererConfig,
    framebuffer: regl.Framebuffer2D,
    renderer: FBORenderer,
    glsl: ReturnType<typeof SwissGL>,
    gl: WebGL2RenderingContext,
    swglTarget: { bindTarget: (gl: WebGL2RenderingContext) => number[] }
  ) {
    super(config, framebuffer, renderer);
    this.glsl = glsl;
    this.gl = gl;
    this.swglTarget = swglTarget;
  }

  static async create(
    config: BaseRendererConfig,
    framebuffer: regl.Framebuffer2D,
    renderer: FBORenderer
  ): Promise<SwissGLRenderer> {
    const { SwissGL } = await import('$lib/rendering/swissgl');

    const [width, height] = renderer.outputSize;
    const gl = renderer.regl._gl as WebGL2RenderingContext;
    const glsl = SwissGL(gl);

    const destinationFramebuffer = getFramebuffer(framebuffer);
    const swglTarget = {
      bindTarget: (gl: WebGL2RenderingContext) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, destinationFramebuffer);
        return [width, height];
      }
    };

    const instance = new SwissGLRenderer(config, framebuffer, renderer, glsl, gl, swglTarget);

    // Create a 1x1 transparent fallback texture for unconnected inlets
    const fallbackTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, fallbackTex);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0])
    );

    gl.bindTexture(gl.TEXTURE_2D, null);
    instance.fallbackWebGLTexture = fallbackTex;

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

    this.framebuffer?.use(() => {
      try {
        this.userRenderFunc!({ t: params.transportTime });
      } catch (error) {
        this.handleRuntimeError(error, SWGL_WRAPPER_OFFSET);
      }
    });

    // SwissGL manipulates WebGL state directly; tell regl its cache is stale
    this.renderer.regl._refresh();
  }

  async updateCode() {
    this.userRenderFunc = null;
    this.glsl.reset();
    this.includeCache.clear();
    this.generation++;

    this.resetState();

    try {
      const resolver = createWorkerResolver(this.config.nodeId);
      const includeCache = this.includeCache;

      const wrappedGlsl = (
        shaderConfig: Record<string, unknown>,
        targetConfig: Record<string, unknown> = {}
      ) => {
        // Resolve #include directives from cache (pre-warmed during init)
        let patched = shaderConfig;

        for (const field of ['FP', 'VP', 'Inc'] as const) {
          const src = patched[field];

          if (typeof src === 'string' && src.includes('#include')) {
            const cached = includeCache.get(src);
            if (cached) {
              patched = patched === shaderConfig ? { ...patched } : patched;
              patched[field] = cached;
            }
          }
        }

        return this.glsl(patched, { ...targetConfig, ...this.swglTarget });
      };

      /**
       * Async version of glsl() for initialization code that needs #include.
       * User code should call this during setup, not per-frame.
       */
      const wrappedGlslAsync = async (
        shaderConfig: Record<string, unknown>,
        targetConfig: Record<string, unknown> = {}
      ) => {
        const gen = this.generation;
        let patched = shaderConfig;

        for (const field of ['FP', 'VP', 'Inc'] as const) {
          const src = patched[field];

          if (typeof src === 'string' && src.includes('#include')) {
            let resolved = includeCache.get(src);

            if (!resolved) {
              resolved = await processIncludes(src, resolver);

              // Renderer was reset/destroyed while awaiting — discard stale result
              if (gen !== this.generation) return;

              includeCache.set(src, resolved);
            }

            patched = patched === shaderConfig ? { ...patched } : patched;
            patched[field] = resolved;
          }
        }

        return this.glsl(patched, { ...targetConfig, ...this.swglTarget });
      };

      const extraContext = {
        ...this.buildBaseExtraContext(),
        glsl: wrappedGlsl,
        glslAsync: wrappedGlslAsync,
        setVideoCount: this.setVideoCount.bind(this),
        getTexture: this.getTexture.bind(this)
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
          'No render() function found. Define a render(t) function to draw each frame.'
        );
      }
    } catch (error) {
      this.handleCodeError(error, SWGL_WRAPPER_OFFSET);
    }
  }

  /**
   * Gets a SwissGL-compatible TextureSampler from a video inlet.
   * Returns a lazy sampler that resolves the actual texture at bind time,
   * so it always reads the current frame's inputTextures.
   */
  getTexture(index: number): ReglTextureSampler {
    const cached = this.lazySamplers[index];
    if (cached) return cached;

    const sampler = new ReglTextureSampler(this.gl, () => {
      const reglTex = this.inputTextures[index];
      if (!reglTex) return this.fallbackWebGLTexture;

      // @ts-expect-error -- accessing internal regl property
      return (reglTex._texture?.texture as WebGLTexture) ?? this.fallbackWebGLTexture;
    });

    this.lazySamplers[index] = sampler;

    return sampler;
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

  destroy() {
    this.generation++;
    this.glsl.reset();
    this.userRenderFunc = null;
    this.includeCache.clear();

    if (this.fallbackWebGLTexture) {
      this.gl.deleteTexture(this.fallbackWebGLTexture);
      this.fallbackWebGLTexture = null;
    }

    this.lazySamplers.length = 0;
    super.destroy();
  }
}
