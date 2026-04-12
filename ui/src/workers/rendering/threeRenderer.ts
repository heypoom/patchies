import type regl from 'regl';
import type { FBORenderer } from './fboRenderer';
import type { RenderParams } from '$lib/rendering/types';
import { getFramebuffer } from './utils';
import { THREE_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';
import { BaseWorkerRenderer, type BaseRendererConfig } from './BaseWorkerRenderer';

export class ThreeRenderer extends BaseWorkerRenderer<BaseRendererConfig> {
  private animationId: number | null = null;

  // Three.js instances
  private THREE: typeof import('three') | null = null;
  private threeWebGLRenderer: import('three').WebGLRenderer | null = null;
  private renderTarget: import('three').WebGLRenderTarget | null = null;

  // User-defined render function
  private userRenderFunc: ((time: number) => void) | null = null;

  // Video input textures (from connected nodes)
  private inputTextures: (regl.Texture2D | undefined)[] = [];

  // Three.js textures wrapping regl textures
  private threeInputTextures: import('three').Texture[] = [];

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
  ): Promise<ThreeRenderer> {
    const instance = new ThreeRenderer(config, framebuffer, renderer);
    instance.THREE = await import('three');

    const [width, height] = instance.renderer.outputSize;

    try {
      const fakeCanvas = {
        addEventListener: () => {}
      };

      instance.threeWebGLRenderer = new instance.THREE.WebGLRenderer({
        // @ts-expect-error -- hack: use fake canvas
        canvas: fakeCanvas,
        context: renderer.gl!,
        antialias: true
      });

      instance.threeWebGLRenderer.setSize(width, height, false);

      instance.renderTarget = new instance.THREE.WebGLRenderTarget(width, height, {
        format: instance.THREE.RGBAFormat,
        type: instance.THREE.UnsignedByteType
      });
    } catch (error) {
      console.error('error creating THREE', error);
    }

    await instance.updateCode();

    return instance;
  }

  renderFrame(params: RenderParams) {
    if (!this.threeWebGLRenderer || !this.renderTarget || !this.userRenderFunc) return;

    // Skip rendering when transport is paused — FBO retains last frame
    if (this.renderer.transportTime && !this.renderer.transportTime.isPlaying) return;

    const gl = this.renderer.gl;
    if (!gl) return;

    // Update mouse state from render params
    this.mouseX = params.mouseX;
    this.mouseY = params.mouseY;

    // Store input textures for getTexture() access
    this.inputTextures = params.userParams as (regl.Texture2D | undefined)[];

    // Update Three.js textures from regl textures
    this.updateThreeTextures();

    // Reset Three.js internal GL state cache before rendering.
    // Other nodes (GLSL, SwissGL) may have changed the viewport via regl
    // to a different size (e.g. @resolution 100), and Three.js won't know
    // unless we invalidate its cached state.
    this.threeWebGLRenderer.resetState();

    // Render to Three.js's own render target
    this.threeWebGLRenderer.setRenderTarget(this.renderTarget);

    try {
      this.userRenderFunc(params.transportTime);
    } catch (error) {
      this.handleRuntimeError(error, THREE_WRAPPER_OFFSET);
    }

    // Blit from Three.js render target to our regl FBO
    this.blitToReglFramebuffer();

    // Refresh Three.js and REGL states
    this.threeWebGLRenderer.resetState();
    this.renderer.regl._refresh();
  }

  /**
   * Blits the Three.js render target to our regl framebuffer.
   */
  private blitToReglFramebuffer() {
    if (!this.threeWebGLRenderer || !this.renderTarget || !this.framebuffer) return;

    const gl = this.renderer.gl;
    if (!gl) return;

    const [width, height] = this.renderer.outputSize;

    const threeProps = this.threeWebGLRenderer.properties.get(this.renderTarget);

    // @ts-expect-error -- accessing internal Three.js property
    const sourceFBO = threeProps.__webglFramebuffer as WebGLFramebuffer | undefined;
    if (!sourceFBO) return;

    const destFBO = getFramebuffer(this.framebuffer);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, destFBO);

    gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.LINEAR);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  async updateCode() {
    if (!this.THREE || !this.threeWebGLRenderer || !this.renderTarget) return;

    this.resetState();

    // Cancel any existing animation frame
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    try {
      const THREE = this.THREE;
      const renderer = this.threeWebGLRenderer;
      const renderTarget = this.renderTarget;

      const extraContext = {
        ...this.buildBaseExtraContext(),
        THREE,
        renderer,
        renderTarget,
        setVideoCount: this.setVideoCount.bind(this),
        getTexture: this.getTexture.bind(this),
        requestAnimationFrame: () => {}
      };

      // Three.js wrapper code that extracts the draw function
      const codeWithWrapper = `
        var recv = onMessage;
        var draw;

        ${this.config.code}

        return typeof draw === 'function' ? draw : null;
      `;

      const userDraw = await this.executeUserCode(codeWithWrapper, extraContext);

      this.userRenderFunc = typeof userDraw === 'function' ? userDraw : null;

      if (!this.userRenderFunc) {
        this.createCustomConsole().warn(
          'No draw() function found. Define a draw(time) function to render.'
        );
      }
    } catch (error) {
      this.handleCodeError(error, THREE_WRAPPER_OFFSET);
    }
  }

  destroy() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this.renderTarget?.dispose();

    this.threeWebGLRenderer = null;
    this.renderTarget = null;
    this.userRenderFunc = null;

    super.destroy();
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

  /**
   * Updates Three.js textures to use regl's WebGL textures directly.
   */
  private updateThreeTextures() {
    if (!this.THREE || !this.threeWebGLRenderer) return;

    for (let i = 0; i < this.inputTextures.length; i++) {
      const reglTex = this.inputTextures[i];
      if (!reglTex) continue;

      if (!this.threeInputTextures[i]) {
        this.threeInputTextures[i] = new this.THREE.Texture();
        this.threeInputTextures[i].minFilter = this.THREE.LinearFilter;
        this.threeInputTextures[i].magFilter = this.THREE.LinearFilter;
      }

      const threeTex = this.threeInputTextures[i];

      // @ts-expect-error -- accessing internal regl property
      const webglTexture = reglTex._texture?.texture as WebGLTexture | undefined;

      if (webglTexture) {
        const props = this.threeWebGLRenderer.properties.get(threeTex) as {
          __webglTexture?: WebGLTexture;
          __webglInit?: boolean;
        };
        props.__webglTexture = webglTexture;
        props.__webglInit = true;

        // Use the actual regl texture dimensions, not the global output size.
        // Input textures may be smaller when the source uses @resolution.
        threeTex.image = { width: reglTex.width, height: reglTex.height };
        threeTex.needsUpdate = false;
      }
    }
  }

  /**
   * Gets a Three.js texture from a video inlet.
   */
  getTexture(index: number): import('three').Texture | null {
    return this.threeInputTextures[index] ?? null;
  }
}
