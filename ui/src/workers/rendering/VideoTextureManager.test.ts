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

  it('uploads worker video frames as flipped RGBA8 bytes without float conversion', () => {
    const { regl } = createMockRegl();
    const gl = createMockWebGL2Context();
    const manager = new VideoTextureManager(regl as never, gl as never);
    const pixels = new Uint8ClampedArray(2 * 2 * 4);

    manager.setVideoFrame('worker-1', 2, 2, pixels);

    expect(gl.blitFramebuffer).toHaveBeenCalledWith(
      0,
      2,
      2,
      0,
      0,
      0,
      2,
      2,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST
    );
  });

  it('preserves texture bindings when uploading a float texture', () => {
    const { regl } = createMockRegl();
    const gl = createMockWebGL2Context();
    const texture0 = {} as WebGLTexture;
    const texture1 = {} as WebGLTexture;
    const bindings = new Map<number, WebGLTexture | null>([
      [gl.TEXTURE0, texture0],
      [gl.TEXTURE0 + 1, texture1]
    ]);
    let activeTexture = gl.TEXTURE0 + 1;

    gl.getParameter.mockImplementation((parameter: number) => {
      if (parameter === gl.ACTIVE_TEXTURE) return activeTexture;
      if (parameter === gl.TEXTURE_BINDING_2D) return bindings.get(activeTexture) ?? null;
      return null;
    });
    gl.activeTexture.mockImplementation((texture: number) => {
      activeTexture = texture;
    });
    gl.bindTexture.mockImplementation((_: number, texture: WebGLTexture | null) => {
      bindings.set(activeTexture, texture);
    });

    const manager = new VideoTextureManager(regl as never, gl as never);
    manager.setFloatTexture('float-1', 1, 1, new Float32Array(4));

    expect(activeTexture).toBe(gl.TEXTURE0 + 1);
    expect(bindings.get(gl.TEXTURE0)).toBe(texture0);
    expect(bindings.get(gl.TEXTURE0 + 1)).toBe(texture1);
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
