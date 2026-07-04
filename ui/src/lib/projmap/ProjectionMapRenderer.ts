import type regl from 'regl';
import type { FBORenderer } from '$workers/rendering/fboRenderer';
import type { RenderParams } from '$lib/rendering/types';
import type { ProjMapSurface } from './types';
import { WARP_SUBDIVISIONS } from './constants';
import { Earcut } from 'three/src/extras/Earcut.js';

export interface ProjectionMapConfig {
  nodeId: string;
  surfaces: ProjMapSurface[];
}

/** Precomputed geometry for a single surface */
interface SurfaceGeometry {
  positions: regl.Buffer;
  uvs: regl.Buffer;
  elements: regl.Elements;
  count: number;
}

export class ProjectionMapRenderer {
  public config: ProjectionMapConfig;

  private framebuffer: regl.Framebuffer2D;
  private reglInstance: regl.Regl;

  /** Precomputed geometry per surface, keyed by surface id */
  private geometries = new Map<string, SurfaceGeometry>();

  /** Regl draw command for textured surfaces */
  private drawSurface: regl.DrawCommand;

  private constructor(
    config: ProjectionMapConfig,
    framebuffer: regl.Framebuffer2D,
    renderer: FBORenderer
  ) {
    this.config = config;
    this.framebuffer = framebuffer;
    this.reglInstance = renderer.regl;

    this.drawSurface = this.reglInstance({
      vert: `
        precision mediump float;
        attribute vec2 position;
        attribute vec2 uv;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position * 2.0 - 1.0, 0, 1);
        }
      `,
      frag: `
        precision mediump float;
        varying vec2 vUv;
        uniform sampler2D inputTexture;
        void main() {
          gl_FragColor = texture2D(inputTexture, vUv);
        }
      `,
      attributes: {
        position: this.reglInstance.prop<{ position: regl.Buffer }, 'position'>('position'),
        uv: this.reglInstance.prop<{ uv: regl.Buffer }, 'uv'>('uv')
      },
      uniforms: {
        inputTexture: this.reglInstance.prop<{ inputTexture: regl.Texture2D }, 'inputTexture'>(
          'inputTexture'
        )
      },
      elements: this.reglInstance.prop<{ elements: regl.Elements }, 'elements'>('elements'),
      framebuffer: this.reglInstance.prop<{ framebuffer: regl.Framebuffer2D }, 'framebuffer'>(
        'framebuffer'
      ),
      blend: {
        enable: true,
        func: {
          srcRGB: 'src alpha',
          srcAlpha: 'one',
          dstRGB: 'one minus src alpha',
          dstAlpha: 'one minus src alpha'
        }
      },
      depth: { enable: false }
    });
  }

  static async create(
    config: ProjectionMapConfig,
    framebuffer: regl.Framebuffer2D,
    renderer: FBORenderer
  ): Promise<ProjectionMapRenderer> {
    const instance = new ProjectionMapRenderer(config, framebuffer, renderer);

    if (config.surfaces.length > 0) {
      instance.rebuildGeometries();
    }

    return instance;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resizeOutput(width: number, height: number) {
    // No-op: regl framebuffer is resized externally
  }

  updateSurfaces(surfaces: ProjMapSurface[]) {
    this.config.surfaces = surfaces;
    this.rebuildGeometries();
  }

  private rebuildGeometries() {
    // Dispose old geometries
    for (const geo of this.geometries.values()) {
      geo.positions.destroy();
      geo.uvs.destroy();
      geo.elements.destroy();
    }
    this.geometries.clear();

    for (const surface of this.config.surfaces) {
      if (surface.points.length < 3) continue;

      const geo =
        surface.mode === 'warp' ? this.buildWarpGeometry(surface) : this.buildMaskGeometry(surface);

      if (geo) this.geometries.set(surface.id, geo);
    }
  }

  /**
   * Warp mode: subdivided plane with bilinear interpolation from 4 corners.
   * Positions in [0,1] screen space, UVs uniform [0,1].
   */
  private buildWarpGeometry(surface: ProjMapSurface): SurfaceGeometry | null {
    const segs = WARP_SUBDIVISIONS;

    if (surface.points.length < 4) {
      console.warn(
        `[projmap] warp surface ${surface.id} has ${surface.points.length} points, need 4`
      );
      return null;
    }

    const [tl, tr, br, bl] = surface.points;
    const vertCount = (segs + 1) * (segs + 1);
    const positions = new Float32Array(vertCount * 2);
    const uvs = new Float32Array(vertCount * 2);

    for (let row = 0; row <= segs; row++) {
      for (let col = 0; col <= segs; col++) {
        const idx = (row * (segs + 1) + col) * 2;
        const u = col / segs;
        const v = row / segs;

        // Bilinear interpolation → screen-space [0,1]
        positions[idx] =
          (1 - u) * (1 - v) * tl.x + u * (1 - v) * tr.x + u * v * br.x + (1 - u) * v * bl.x;
        positions[idx + 1] =
          1 - ((1 - u) * (1 - v) * tl.y + u * (1 - v) * tr.y + u * v * br.y + (1 - u) * v * bl.y);

        uvs[idx] = u;
        uvs[idx + 1] = 1 - v;
      }
    }

    // Build triangle indices for the grid
    const indices = new Uint16Array(segs * segs * 6);
    let ei = 0;
    for (let row = 0; row < segs; row++) {
      for (let col = 0; col < segs; col++) {
        const a = row * (segs + 1) + col;
        const b = a + 1;
        const c = a + (segs + 1);
        const d = c + 1;
        indices[ei++] = a;
        indices[ei++] = b;
        indices[ei++] = c;
        indices[ei++] = b;
        indices[ei++] = d;
        indices[ei++] = c;
      }
    }

    return {
      positions: this.reglInstance.buffer(positions),
      uvs: this.reglInstance.buffer(uvs),
      elements: this.reglInstance.elements({ data: indices, type: 'uint16' }),
      count: indices.length
    };
  }

  /** Mask mode: earcut-triangulated polygon with 1:1 UV mapping */
  private buildMaskGeometry(surface: ProjMapSurface): SurfaceGeometry | null {
    // Flatten points for earcut: [x0, y0, x1, y1, ...]
    const flat = new Float64Array(surface.points.length * 2);
    for (let i = 0; i < surface.points.length; i++) {
      flat[i * 2] = surface.points[i].x;
      flat[i * 2 + 1] = surface.points[i].y;
    }

    const triIndices = Earcut.triangulate(Array.from(flat), undefined, 2);
    if (triIndices.length === 0) return null;

    // Positions and UVs: screen [0,1] mapped to clip space in vertex shader
    const positions = new Float32Array(surface.points.length * 2);
    const uvs = new Float32Array(surface.points.length * 2);

    for (let i = 0; i < surface.points.length; i++) {
      const p = surface.points[i];
      positions[i * 2] = p.x;
      positions[i * 2 + 1] = 1 - p.y; // flip Y for GL
      uvs[i * 2] = p.x;
      uvs[i * 2 + 1] = 1 - p.y;
    }

    return {
      positions: this.reglInstance.buffer(positions),
      uvs: this.reglInstance.buffer(uvs),
      elements: this.reglInstance.elements({
        data: new Uint16Array(triIndices),
        type: 'uint16'
      }),
      count: triIndices.length
    };
  }

  renderFrame(params: RenderParams) {
    const inputTextures = params.userParams as (regl.Texture2D | undefined)[];

    // Clear the framebuffer
    this.reglInstance.clear({
      color: [0, 0, 0, 0],
      framebuffer: this.framebuffer
    });

    // Draw each surface with its input texture
    for (let i = 0; i < this.config.surfaces.length; i++) {
      const surface = this.config.surfaces[i];
      const geo = this.geometries.get(surface.id);
      const tex = inputTextures[i];

      if (!geo || !tex) continue;

      this.drawSurface({
        position: geo.positions,
        uv: geo.uvs,
        elements: geo.elements,
        inputTexture: tex,
        framebuffer: this.framebuffer
      });
    }
  }

  destroy() {
    for (const geo of this.geometries.values()) {
      geo.positions.destroy();
      geo.uvs.destroy();
      geo.elements.destroy();
    }
    this.geometries.clear();
  }
}
