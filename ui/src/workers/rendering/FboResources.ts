import type regl from 'regl';
import { match } from 'ts-pattern';

import type { FBONode, FBOFormat, FBOResolution } from '$lib/rendering/types';

import { getRawTexture } from './utils';

/** FBO texture allocation and destruction details. */
export class FboResources {
  private colorBufferFloatSupported: boolean;
  private halfFloatLinearSupported: boolean;
  private floatLinearSupported: boolean;

  constructor(
    private regl: regl.Regl,
    private gl: WebGL2RenderingContext
  ) {
    this.colorBufferFloatSupported = !!gl.getExtension('EXT_color_buffer_float');
    this.halfFloatLinearSupported = !!gl.getExtension('OES_texture_half_float_linear');
    this.floatLinearSupported = !!gl.getExtension('OES_texture_float_linear');
  }

  resolveSize(
    resolution: FBOResolution | undefined,
    outputSize: [number, number]
  ): [number, number] {
    const [outputWidth, outputHeight] = outputSize;

    if (resolution == null) return [outputWidth, outputHeight];

    let width: number;
    let height: number;

    const fractionalMatch = typeof resolution === 'string' ? resolution.match(/^1\/(\d+)$/) : null;

    if (fractionalMatch) {
      const divisor = Number(fractionalMatch[1]);

      width = Math.floor(outputWidth / divisor);
      height = Math.floor(outputHeight / divisor);
    } else if (typeof resolution === 'number') {
      width = Math.floor(resolution);
      height = Math.floor(resolution);
    } else if (Array.isArray(resolution)) {
      width = Math.floor(resolution[0]);
      height = Math.floor(resolution[1]);
    } else {
      return [outputWidth, outputHeight];
    }

    return [Math.max(1, width), Math.max(1, height)];
  }

  createTexture(width: number, height: number, format: FBOFormat): regl.Texture2D {
    const texture = this.regl.texture({ width, height, wrapS: 'clamp', wrapT: 'clamp' });

    if (format === 'rgba8') {
      return texture;
    }

    if (!this.colorBufferFloatSupported) {
      console.warn(
        `[fbo] EXT_color_buffer_float not supported, falling back to rgba8 for ${format}`
      );

      return texture;
    }

    const rawTexture = getRawTexture(texture);

    const { internalFormat, type, linearSupported } = match(format)
      .with('rgba16f', () => ({
        internalFormat: this.gl.RGBA16F,
        type: this.gl.HALF_FLOAT,
        linearSupported: this.halfFloatLinearSupported
      }))
      .with('rgba32f', () => ({
        internalFormat: this.gl.RGBA32F,
        type: this.gl.FLOAT,
        linearSupported: this.floatLinearSupported
      }))
      .exhaustive();

    this.gl.bindTexture(this.gl.TEXTURE_2D, rawTexture);

    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      internalFormat,
      width,
      height,
      0,
      this.gl.RGBA,
      type,
      null
    );

    const filter = linearSupported ? this.gl.LINEAR : this.gl.NEAREST;
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, filter);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, filter);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);

    return texture;
  }

  destroyNode(fboNode: FBONode, cleanup = true): void {
    fboNode.framebuffer.destroy();

    for (const texture of fboNode.colorAttachments) {
      texture.destroy();
    }

    this.destroyFeedbackResources(fboNode);

    if (cleanup) {
      fboNode.cleanup?.();
    }
  }

  destroyFeedbackResources(fboNode: FBONode): void {
    for (const framebuffer of fboNode.prevFramebuffers ?? []) {
      framebuffer?.destroy();
    }

    for (const texture of fboNode.prevTextures ?? []) {
      texture?.destroy();
    }

    fboNode.prevFramebuffers = undefined;
    fboNode.prevTextures = undefined;
  }
}
