import { describe, expect, it, vi } from 'vitest';

import { VideoTextureManager } from './VideoTextureManager';
import { createMockRegl, createMockWebGL2Context } from '$lib/test-utils/mockWebGL';

describe('VideoTextureManager', () => {
  it('replaces the framebuffer once when a float texture changes size', () => {
    const { regl, textures, framebuffers } = createMockRegl();
    const gl = createMockWebGL2Context();
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
    const gl = createMockWebGL2Context();
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
    const gl = createMockWebGL2Context();
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
    const gl = createMockWebGL2Context();
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
