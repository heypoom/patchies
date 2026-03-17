import type regl from 'regl';
import type { FBORenderer } from '$workers/rendering/fboRenderer';
import type { RenderParams } from '$lib/rendering/types';
import { getFramebuffer } from '$workers/rendering/utils';
import type { ProjMapSurface } from './types';

export interface ProjectionMapConfig {
  nodeId: string;
  surfaces: ProjMapSurface[];
}

export class ProjectionMapRenderer {
  public config: ProjectionMapConfig;

  private framebuffer: regl.Framebuffer2D;
  private renderer: FBORenderer;

  private THREE: typeof import('three') | null = null;
  private threeWebGLRenderer: import('three').WebGLRenderer | null = null;
  private renderTarget: import('three').WebGLRenderTarget | null = null;
  private scene: import('three').Scene | null = null;
  private camera: import('three').OrthographicCamera | null = null;

  /** One mesh per surface, keyed by surface id */
  private meshes = new Map<string, import('three').Mesh>();

  /** Regl textures from upstream nodes (set each frame) */
  private inputTextures: (regl.Texture2D | undefined)[] = [];

  /** Three.js wrappers around the regl textures (zero-copy) */
  private threeInputTextures: import('three').Texture[] = [];

  private constructor(
    config: ProjectionMapConfig,
    framebuffer: regl.Framebuffer2D,
    renderer: FBORenderer
  ) {
    this.config = config;
    this.framebuffer = framebuffer;
    this.renderer = renderer;
  }

  static async create(
    config: ProjectionMapConfig,
    framebuffer: regl.Framebuffer2D,
    renderer: FBORenderer
  ): Promise<ProjectionMapRenderer> {
    const instance = new ProjectionMapRenderer(config, framebuffer, renderer);
    instance.THREE = await import('three');

    const [width, height] = renderer.outputSize;

    const fakeCanvas = { addEventListener: () => {} };

    instance.threeWebGLRenderer = new instance.THREE.WebGLRenderer({
      // @ts-expect-error -- share WebGL context with regl
      canvas: fakeCanvas,
      context: renderer.gl!,
      antialias: true
    });

    instance.threeWebGLRenderer.setSize(width, height, false);

    instance.renderTarget = new instance.THREE.WebGLRenderTarget(width, height, {
      format: instance.THREE.RGBAFormat,
      type: instance.THREE.UnsignedByteType
    });

    instance.scene = new instance.THREE.Scene();

    // Orthographic camera mapping [0,1] screen space to [-0.5, 0.5] Three space
    instance.camera = new instance.THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
    instance.camera.position.z = 1;

    if (config.surfaces.length > 0) {
      instance.rebuildScene();
    }

    return instance;
  }

  updateSurfaces(surfaces: ProjMapSurface[]) {
    this.config.surfaces = surfaces;

    this.rebuildScene();
  }

  private rebuildScene() {
    if (!this.THREE || !this.scene) return;

    // Dispose and remove all existing meshes
    for (const mesh of this.meshes.values()) {
      this.scene.remove(mesh);

      mesh.geometry.dispose();

      (mesh.material as import('three').Material).dispose();
    }

    this.meshes.clear();

    for (const surface of this.config.surfaces) {
      if (surface.points.length < 3) continue;
      const mesh = this.buildSurfaceMesh(surface);
      this.meshes.set(surface.id, mesh);
      this.scene.add(mesh);
    }
  }

  private buildSurfaceMesh(surface: ProjMapSurface): import('three').Mesh {
    const THREE = this.THREE!;

    // Build a Shape from screen-space [0,1] coords → Three ortho [-0.5, 0.5]
    const shape = new THREE.Shape();
    const first = surface.points[0];
    shape.moveTo(first.x - 0.5, 0.5 - first.y);
    for (let i = 1; i < surface.points.length; i++) {
      const p = surface.points[i];
      shape.lineTo(p.x - 0.5, 0.5 - p.y);
    }
    shape.closePath();

    const geometry = new THREE.ShapeGeometry(shape);

    // UV mapping: x+0.5 and y+0.5 maps back to [0,1] screen space
    const posAttr = geometry.attributes.position;
    const uvAttr = geometry.attributes.uv;

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      uvAttr.setXY(i, x + 0.5, y + 0.5);
    }

    uvAttr.needsUpdate = true;

    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    return new THREE.Mesh(geometry, material);
  }

  renderFrame(params: RenderParams) {
    if (!this.threeWebGLRenderer || !this.renderTarget || !this.scene || !this.camera) return;
    const gl = this.renderer.gl;

    if (!gl) return;

    this.inputTextures = params.userParams as (regl.Texture2D | undefined)[];

    this.updateThreeTextures();
    this.updateMeshTextures();

    this.threeWebGLRenderer.setRenderTarget(this.renderTarget);
    this.threeWebGLRenderer.render(this.scene, this.camera);

    this.blitToReglFramebuffer();

    // Restore shared WebGL context state
    this.threeWebGLRenderer.resetState();
    this.renderer.regl._refresh();
  }

  /** Assign inlet N texture to surface N */
  private updateMeshTextures() {
    for (let i = 0; i < this.config.surfaces.length; i++) {
      const mesh = this.meshes.get(this.config.surfaces[i].id);
      if (!mesh) continue;

      const threeTex = this.threeInputTextures[i] ?? null;
      const material = mesh.material as import('three').MeshBasicMaterial;

      if (material.map !== threeTex) {
        material.map = threeTex;
        material.needsUpdate = true;
      }
    }
  }

  /**
   * Wraps each regl texture with a Three.js Texture by directly swapping the
   * underlying WebGLTexture handle — zero GPU copy.
   */
  private updateThreeTextures() {
    if (!this.THREE || !this.threeWebGLRenderer) return;

    const [width, height] = this.renderer.outputSize;

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

        threeTex.image = { width, height };
        threeTex.needsUpdate = false;
      }
    }
  }

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

  destroy() {
    for (const mesh of this.meshes.values()) {
      mesh.geometry.dispose();
      (mesh.material as import('three').Material).dispose();
    }

    this.meshes.clear();
    this.renderTarget?.dispose();

    // Don't dispose threeWebGLRenderer — it shares the WebGL context with regl!
  }
}
