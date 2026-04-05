import type regl from 'regl';
import type { FBORenderer } from './fboRenderer';
import type { RenderParams } from '$lib/rendering/types';
import type { SwissGL } from '$lib/rendering/swissgl';
import { getFramebuffer } from './utils';
import { BaseWorkerRenderer, type BaseRendererConfig } from './BaseWorkerRenderer';

const SWGL_WRAPPER_OFFSET = 4;

export class SwissGLRenderer extends BaseWorkerRenderer<BaseRendererConfig> {
  private glsl: ReturnType<typeof SwissGL>;
  private gl: WebGL2RenderingContext;
  private swglTarget: { bindTarget: (gl: WebGL2RenderingContext) => number[] };

  // User's render function
  private userRenderFunc: ((params: { t: number }) => void) | null = null;

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

    this.framebuffer?.use(() => {
      try {
        this.userRenderFunc!({ t: params.transportTime });
      } catch (error) {
        this.handleRuntimeError(error, SWGL_WRAPPER_OFFSET);
      }
    });
  }

  async updateCode() {
    this.userRenderFunc = null;
    this.glsl.reset();

    this.resetState();

    try {
      const wrappedGlsl = (shaderConfig: unknown, targetConfig: Record<string, unknown> = {}) =>
        this.glsl(shaderConfig, { ...targetConfig, ...this.swglTarget });

      const extraContext = {
        ...this.buildBaseExtraContext(),
        glsl: wrappedGlsl
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

  destroy() {
    this.glsl.reset();
    this.userRenderFunc = null;
    super.destroy();
  }
}
