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
    RGBA8: 0x8058,
    RGBA16F: 0x881a,
    RGBA32F: 0x8814,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
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

  it('recreates the texture when a float texture changes format', () => {
    const { regl, textures, framebuffers } = createMockRegl();
    const gl = createMockGl();
    const manager = new VideoTextureManager(regl as never, gl as never);

    manager.setFloatTexture('float-1', 5, 1, new Float32Array(5 * 4), 'rgba32f');
    const firstTexture = textures[0];
    const firstFramebuffer = framebuffers[0];

    manager.setFloatTexture('float-1', 5, 1, new Float32Array(5 * 4), 'rgba16f');

    expect(firstFramebuffer.destroy).toHaveBeenCalledTimes(1);
    expect(firstTexture.destroy).toHaveBeenCalledTimes(1);
    expect(manager.getDestinationTexture('float-1')).toBe(textures[1]);
    expect(manager.getDestinationFBO('float-1')).toBe(framebuffers[1]);
  });

  it('uploads rgba8 float texture data as clamped bytes', () => {
    const { regl } = createMockRegl();
    const gl = createMockGl();
    const manager = new VideoTextureManager(regl as never, gl as never);

    manager.setFloatTexture('float-1', 1, 1, new Float32Array([-1, 0.5, 2, 1]), 'rgba8');

    const texImageArgs = gl.texImage2D.mock.calls[0];

    expect(texImageArgs[2]).toBe(gl.RGBA8);
    expect(texImageArgs[6]).toBe(gl.RGBA);
    expect(texImageArgs[7]).toBe(gl.UNSIGNED_BYTE);
    expect(Array.from(texImageArgs[8] as Uint8Array)).toEqual([0, 128, 255, 255]);
  });

  it('skips float texture uploads when the data length does not match dimensions', () => {
    const { regl } = createMockRegl();
    const gl = createMockGl();
    const manager = new VideoTextureManager(regl as never, gl as never);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    manager.setFloatTexture('float-1', 2, 2, new Float32Array(4));

    expect(gl.texImage2D).not.toHaveBeenCalled();
    expect(regl.texture).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[float.tex] Expected RGBA data length 16, received 4; skipping upload'
    );

    warn.mockRestore();
  });
});
