import { describe, expect, it, vi } from 'vitest';

import { VideoTextureManager } from './VideoTextureManager';

function createMockRegl() {
  const textures: Array<{ width: number; height: number; destroy: ReturnType<typeof vi.fn> }> = [];
  const framebuffers: Array<{ destroy: ReturnType<typeof vi.fn> }> = [];

  const texture = vi.fn((options: { width: number; height: number }) => {
    const result = {
      width: options.width,
      height: options.height,
      destroy: vi.fn(),
      _texture: { texture: {} }
    };

    textures.push(result);

    return result;
  });

  const framebuffer = vi.fn(() => {
    const result = {
      destroy: vi.fn(),
      _framebuffer: { framebuffer: {} }
    };

    framebuffers.push(result);

    return result;
  });

  return {
    regl: { texture, framebuffer },
    textures,
    framebuffers
  };
}

function createMockGl() {
  return {
    TEXTURE_BINDING_2D: 0x8069,
    ACTIVE_TEXTURE: 0x84e0,
    FRAMEBUFFER_BINDING: 0x8ca6,
    TEXTURE0: 0x84c0,
    TEXTURE_2D: 0x0de1,
    RGBA32F: 0x8814,
    RGBA: 0x1908,
    FLOAT: 0x1406,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    NEAREST: 0x2600,
    CLAMP_TO_EDGE: 0x812f,
    getExtension: vi.fn(() => ({})),
    getParameter: vi.fn(() => null),
    activeTexture: vi.fn(),
    bindTexture: vi.fn(),
    texImage2D: vi.fn(),
    texSubImage2D: vi.fn(),
    texParameteri: vi.fn(),
    bindFramebuffer: vi.fn()
  };
}

describe('VideoTextureManager', () => {
  it('replaces the framebuffer once when a float texture changes size', () => {
    const { regl, textures, framebuffers } = createMockRegl();
    const gl = createMockGl();
    const manager = new VideoTextureManager(regl as never, gl as never);

    manager.setFloatTexture('float-1', 5, 1, new Float32Array(5 * 4));
    const firstTexture = textures[0];
    const firstFramebuffer = framebuffers[0];

    manager.setFloatTexture('float-1', 20, 1, new Float32Array(20 * 4));

    expect(firstFramebuffer.destroy).toHaveBeenCalledTimes(1);
    expect(firstTexture.destroy).toHaveBeenCalledTimes(1);
    expect(manager.getDestinationTexture('float-1')?.width).toBe(20);
    expect(manager.getDestinationFBO('float-1')).toBe(framebuffers[1]);
  });
});
