import type regl from 'regl';
import { match } from 'ts-pattern';
import type { FBORenderer } from './fboRenderer';
import type { RenderParams } from '$lib/rendering/types';
import type { GLUniformDef } from '../../types/uniform-config';
import { getFramebuffer } from './utils';
import { SHADERPARK_VIDEO_UNIFORM_COUNT, SHADERPARK_VIDEO_UNIFORMS } from './shaderParkRenderer';
import {
  createShaderParkOrbitState,
  getShaderParkOrbitCameraPosition,
  updateShaderParkOrbit,
  zoomShaderParkOrbit,
  type ShaderParkOrbitState
} from './shaderParkOrbit';
import {
  isShaderParkBuiltInUniform,
  normalizeShaderParkUniformValue
} from '$lib/shaderpark/uniforms';

type ShaderParkCore = typeof import('shader-park-core');

type ShaderParkUniform = {
  name: string;
  type: string;
  value?: unknown;
};

type ShaderParkThreeRendererConfig = {
  code: string;
  nodeId: string;
  uniformDefs?: GLUniformDef[];
  size: [number, number];
};

type ThreeTextureInteropProps = {
  __webglTexture?: WebGLTexture;
  __webglInit?: boolean;
};

type ThreeRenderTargetInteropProps = {
  __webglFramebuffer?: WebGLFramebuffer;
};

let shaderParkCorePromise: Promise<ShaderParkCore> | null = null;

function lazyLoadShaderParkCore(): Promise<ShaderParkCore> {
  shaderParkCorePromise ??= import('shader-park-core');

  return shaderParkCorePromise;
}

function injectVideoUniforms(fragment: string) {
  const marker = 'const float STEP_SIZE_CONSTANT';
  const markerIndex = fragment.indexOf(marker);

  if (markerIndex === -1) {
    return `${SHADERPARK_VIDEO_UNIFORMS}\n${fragment}`;
  }

  return `${fragment.slice(0, markerIndex)}${SHADERPARK_VIDEO_UNIFORMS}\n${fragment.slice(
    markerIndex
  )}`;
}

const getDefaultScalarValue = (value: unknown, fallback: number) =>
  typeof value === 'number' ? value : fallback;

function getDefaultVectorValue(value: unknown, fallback: number[]) {
  const normalized = normalizeShaderParkUniformValue(value, `vec${fallback.length}`);

  return Array.isArray(normalized) ? normalized : fallback;
}

export class ShaderParkThreeRenderer {
  private THREE: typeof import('three') | null = null;
  private threeWebGLRenderer: import('three').WebGLRenderer | null = null;
  private renderTarget: import('three').WebGLRenderTarget | null = null;
  private scene: import('three').Scene | null = null;
  private camera: import('three').PerspectiveCamera | null = null;
  private mesh: import('three').Mesh | null = null;
  private material: import('three').ShaderMaterial | null = null;
  private fallbackThreeTexture: import('three').Texture | null = null;
  private threeInputTextures: (import('three').Texture | undefined)[] = [];
  private orbit: ShaderParkOrbitState = createShaderParkOrbitState();
  private missingInteropWarnings = new Set<string>();

  private constructor(
    private config: ShaderParkThreeRendererConfig,
    private framebuffer: regl.Framebuffer2D,
    private renderer: FBORenderer
  ) {}

  static async create(
    config: ShaderParkThreeRendererConfig,
    framebuffer: regl.Framebuffer2D,
    renderer: FBORenderer
  ): Promise<ShaderParkThreeRenderer> {
    const instance = new ShaderParkThreeRenderer(config, framebuffer, renderer);
    instance.THREE = await import('three');

    const [width, height] = instance.config.size;

    const fakeCanvas = {
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    instance.threeWebGLRenderer = new instance.THREE.WebGLRenderer({
      // @ts-expect-error -- worker renderer reuses the shared WebGL context.
      canvas: fakeCanvas,
      context: renderer.gl!,
      antialias: true,
      alpha: true
    });

    instance.threeWebGLRenderer.setSize(width, height, false);
    instance.threeWebGLRenderer.setClearColor(0x000000, 0);

    instance.renderTarget = new instance.THREE.WebGLRenderTarget(width, height, {
      format: instance.THREE.RGBAFormat,
      type: instance.THREE.UnsignedByteType
    });

    instance.scene = new instance.THREE.Scene();
    instance.camera = new instance.THREE.PerspectiveCamera(75, width / height, 0.1, 1000);

    instance.fallbackThreeTexture = new instance.THREE.DataTexture(
      new Uint8Array([0, 0, 0, 255]),
      1,
      1,
      instance.THREE.RGBAFormat
    );

    instance.fallbackThreeTexture.needsUpdate = true;

    await instance.updateCode();

    return instance;
  }

  async updateCode() {
    if (!this.THREE || !this.scene) return;

    this.disposeMesh();

    const { sculptToThreeJSShaderSource } = await lazyLoadShaderParkCore();
    const generated = sculptToThreeJSShaderSource(this.config.code);

    if (generated.error) {
      throw new Error(String(generated.error));
    }

    const material = this.createMaterial(generated.uniforms, generated.vert, generated.frag);
    const geometry = new this.THREE.BoxGeometry(2, 2, 2);
    const mesh = new this.THREE.Mesh(geometry, material);

    this.material = material;
    this.mesh = mesh;

    this.scene.add(mesh);
  }

  renderFrame(params: RenderParams) {
    if (
      !this.THREE ||
      !this.threeWebGLRenderer ||
      !this.renderTarget ||
      !this.scene ||
      !this.camera ||
      !this.material
    ) {
      return;
    }

    this.resizeToNodeSize();
    this.updateThreeTextures(params.userParams as (regl.Texture2D | undefined)[]);
    this.updateUniforms(params);
    this.updateCamera(params);

    this.threeWebGLRenderer.resetState();
    this.threeWebGLRenderer.setRenderTarget(this.renderTarget);
    this.threeWebGLRenderer.clear(true, true, true);
    this.threeWebGLRenderer.render(this.scene, this.camera);

    this.blitToReglFramebuffer();
    this.threeWebGLRenderer.resetState();
    this.refreshReglState();
  }

  zoom(deltaY: number) {
    zoomShaderParkOrbit(this.orbit, deltaY);
  }

  destroy() {
    this.disposeMesh();
    this.renderTarget?.dispose();
    this.fallbackThreeTexture?.dispose();

    for (const texture of this.threeInputTextures) {
      texture?.dispose();
    }

    this.threeInputTextures = [];
    this.threeWebGLRenderer = null;
    this.renderTarget = null;
    this.scene = null;
    this.camera = null;
    this.material = null;
    this.mesh = null;
  }

  private createMaterial(
    uniforms: ShaderParkUniform[],
    vertexShader: string,
    fragmentShader: string
  ) {
    if (!this.THREE) {
      throw new Error('Three.js is not loaded');
    }

    const material = new this.THREE.ShaderMaterial({
      uniforms: this.createThreeUniforms(uniforms),
      vertexShader,
      fragmentShader: injectVideoUniforms(fragmentShader),
      transparent: true,
      side: this.THREE.BackSide
    });

    return material;
  }

  private createThreeUniforms(uniforms: ShaderParkUniform[]) {
    if (!this.THREE) return {};

    const threeUniforms: Record<string, { value: unknown }> = {};

    for (const uniform of uniforms) {
      threeUniforms[uniform.name] = {
        value: this.defaultThreeUniformValue(uniform)
      };
    }

    for (let index = 0; index < SHADERPARK_VIDEO_UNIFORM_COUNT; index++) {
      threeUniforms[`iChannel${index}`] = { value: this.fallbackThreeTexture };
    }

    return threeUniforms;
  }

  private defaultThreeUniformValue(uniform: ShaderParkUniform) {
    if (!this.THREE) {
      return uniform.value ?? 0;
    }

    const THREE = this.THREE;

    return match(uniform)
      .with({ name: 'opacity' }, () => 1)
      .with({ name: '_scale' }, ({ value }) => getDefaultScalarValue(value, 1))
      .with({ name: 'stepSize' }, ({ value }) => getDefaultScalarValue(value, 0.85))
      .with({ name: 'time' }, () => 0)
      .with({ name: 'resolution' }, () => new THREE.Vector2(...this.config.size))
      .with({ name: 'mouse' }, () => new THREE.Vector3(0, 0, -0.5))
      .with(
        { type: 'vec2' },
        ({ value }) => new THREE.Vector2(...getDefaultVectorValue(value, [0, 0]))
      )
      .with(
        { type: 'vec3' },
        ({ value }) => new THREE.Vector3(...getDefaultVectorValue(value, [0, 0, 0]))
      )
      .with(
        { type: 'vec4' },
        ({ value }) => new THREE.Vector4(...getDefaultVectorValue(value, [0, 0, 0, 0]))
      )
      .otherwise(({ value }) => getDefaultScalarValue(value, 0));
  }

  private updateUniforms(params: RenderParams) {
    if (!this.THREE || !this.material) return;

    const uniforms = this.material.uniforms;

    const overrides = params.userParams[SHADERPARK_VIDEO_UNIFORM_COUNT] as
      | Record<string, unknown>
      | undefined;

    if (uniforms.time) {
      uniforms.time.value = params.transportTime;
    }

    if (uniforms.resolution) {
      uniforms.resolution.value.set(...this.config.size);
    }

    if (uniforms.mouse) {
      const [width, height] = this.config.size;

      uniforms.mouse.value.set(
        width > 0 ? (2 * params.mouseX) / width - 1 : 0,
        height > 0 ? 2 * (1 - params.mouseY / height) - 1 : 0,
        params.mouseZ ?? -0.5
      );
    }

    for (const [name, value] of Object.entries(overrides ?? {})) {
      const uniform = uniforms[name];

      if (!uniform || isShaderParkBuiltInUniform(name)) continue;

      const normalized = normalizeShaderParkUniformValue(value, this.findUniformType(name));

      if (Array.isArray(normalized) && uniform.value?.set) {
        uniform.value.set(...normalized);
      } else {
        uniform.value = normalized;
      }
    }

    for (let index = 0; index < SHADERPARK_VIDEO_UNIFORM_COUNT; index++) {
      const uniform = uniforms[`iChannel${index}`];
      if (!uniform) continue;

      uniform.value = this.threeInputTextures[index] ?? this.fallbackThreeTexture;
    }
  }

  private findUniformType(name: string) {
    return this.config.uniformDefs?.find((def) => def.name === name)?.type ?? 'float';
  }

  private updateCamera(params: RenderParams) {
    if (!this.camera) return;

    updateShaderParkOrbit(this.orbit, {
      mouseX: params.mouseX,
      mouseY: params.mouseY,
      mouseZ: params.mouseZ,
      mouseW: params.mouseW
    });

    const [x, y, z] = getShaderParkOrbitCameraPosition(this.orbit);
    const [targetX, targetY, targetZ] = this.orbit.target;

    this.camera.position.set(x, y, z);
    this.camera.lookAt(targetX, targetY, targetZ);
    this.camera.updateProjectionMatrix();
  }

  private updateThreeTextures(inputTextures: (regl.Texture2D | undefined)[]) {
    if (!this.THREE || !this.threeWebGLRenderer) return;

    for (let i = 0; i < SHADERPARK_VIDEO_UNIFORM_COUNT; i++) {
      const reglTex = inputTextures[i];
      if (!reglTex) {
        this.clearThreeInputTexture(i);
        continue;
      }

      let threeTexture = this.threeInputTextures[i];

      if (!threeTexture) {
        threeTexture = new this.THREE.Texture();
        threeTexture.minFilter = this.THREE.LinearFilter;
        threeTexture.magFilter = this.THREE.LinearFilter;

        this.threeInputTextures[i] = threeTexture;
      }

      const webglTexture = this.getReglTextureHandle(reglTex, i);
      if (!webglTexture) continue;

      const props = this.getThreeTextureInteropProps(threeTexture, i);
      if (!props) continue;

      props.__webglTexture = webglTexture;
      props.__webglInit = true;

      threeTexture.image = { width: reglTex.width, height: reglTex.height };
      threeTexture.needsUpdate = false;
    }
  }

  private blitToReglFramebuffer() {
    if (!this.threeWebGLRenderer || !this.renderTarget || !this.framebuffer) return;

    const gl = this.renderer.gl;
    const [width, height] = this.config.size;

    const sourceFBO = this.getThreeRenderTargetFramebuffer();
    if (!sourceFBO) return;

    const destFBO = getFramebuffer(this.framebuffer);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, destFBO);
    gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.LINEAR);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  private resizeToNodeSize() {
    if (!this.renderTarget || !this.threeWebGLRenderer || !this.camera) return;

    const [width, height] = this.config.size;
    if (width <= 0 || height <= 0) return;

    if (this.renderTarget.width !== width || this.renderTarget.height !== height) {
      this.renderTarget.setSize(width, height);
      this.threeWebGLRenderer.setSize(width, height, false);

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
  }

  private refreshReglState() {
    const reglInstance = this.renderer.regl as regl.Regl & {
      _refresh?: () => void;
    };

    if (typeof reglInstance._refresh !== 'function') {
      throw new Error('Shader Park 3D renderer expected regl._refresh() after Three.js blit');
    }

    reglInstance._refresh();
  }

  private getReglTextureHandle(reglTex: regl.Texture2D, index: number) {
    // Private regl/Three.js internals bridge the shared WebGL context; keep exact package versions pinned.
    const rawTexture = reglTex as regl.Texture2D & {
      _texture?: { texture?: WebGLTexture };
    };

    const webglTexture = rawTexture._texture?.texture;

    if (!webglTexture) {
      this.warnMissingInterop(
        `regl-texture-${index}`,
        `Shader Park 3D renderer skipped iChannel${index}: missing regl texture handle`
      );
    }

    return webglTexture;
  }

  private getThreeTextureInteropProps(texture: import('three').Texture, index: number) {
    if (!this.threeWebGLRenderer) return null;

    const props = this.threeWebGLRenderer.properties.get(texture) as
      | ThreeTextureInteropProps
      | undefined;

    if (!props) {
      this.warnMissingInterop(
        `three-texture-${index}`,
        `Shader Park 3D renderer skipped iChannel${index}: missing Three.js texture properties`
      );

      return null;
    }

    return props;
  }

  private clearThreeInputTexture(index: number) {
    const texture = this.threeInputTextures[index];
    if (!texture || !this.threeWebGLRenderer) return;

    const props = this.threeWebGLRenderer.properties.get(texture) as
      | ThreeTextureInteropProps
      | undefined;

    if (props) {
      props.__webglTexture = undefined;
      props.__webglInit = false;
    }

    this.threeWebGLRenderer.properties.remove(texture);
    texture.dispose();

    this.threeInputTextures[index] = undefined;
  }

  private getThreeRenderTargetFramebuffer() {
    if (!this.threeWebGLRenderer || !this.renderTarget) return null;

    const threeProps = this.threeWebGLRenderer.properties.get(this.renderTarget) as
      | ThreeRenderTargetInteropProps
      | undefined;

    if (!threeProps?.__webglFramebuffer) {
      this.warnMissingInterop(
        'three-render-target-framebuffer',
        'Shader Park 3D renderer skipped blit: missing Three.js render target framebuffer'
      );

      return null;
    }

    return threeProps.__webglFramebuffer;
  }

  private warnMissingInterop(key: string, message: string) {
    if (this.missingInteropWarnings.has(key)) return;

    this.missingInteropWarnings.add(key);
    console.warn(message, { nodeId: this.config.nodeId });
  }

  private disposeMesh() {
    if (!this.scene || !this.mesh) return;

    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material?.dispose();

    this.mesh = null;
    this.material = null;
  }
}
