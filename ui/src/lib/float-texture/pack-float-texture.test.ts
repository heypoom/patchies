import { describe, expect, it } from 'vitest';

import { inferFloatTextureDataFormat, packFloatTexture } from './pack-float-texture';

describe('packFloatTexture', () => {
  it('packs a Float32Array as one row of red channel data', () => {
    const result = packFloatTexture(new Float32Array([0.25, 0.5]));

    expect(result.width).toBe(2);
    expect(result.height).toBe(1);
    expect(Array.from(result.data)).toEqual([0.25, 0, 0, 1, 0.5, 0, 0, 1]);
  });

  it('groups Float32Array channels into RGBA rows by order', () => {
    const result = packFloatTexture(
      [
        new Float32Array([1, 2]),
        new Float32Array([3, 4]),
        new Float32Array([5, 6]),
        new Float32Array([7, 8]),
        new Float32Array([9])
      ],
      { dataFormat: 'rgba' }
    );

    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(Array.from(result.data)).toEqual([1, 3, 5, 7, 2, 4, 6, 8, 9, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('defaults Float32Array channel arrays to RGBA packing', () => {
    const result = packFloatTexture([
      new Float32Array([1]),
      new Float32Array([0.5]),
      new Float32Array([0.25]),
      new Float32Array([1])
    ]);

    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(Array.from(result.data)).toEqual([1, 0.5, 0.25, 1]);
  });

  it('infers data format from Float32Array channel count', () => {
    expect(inferFloatTextureDataFormat(new Float32Array([1]))).toBe('r');
    expect(inferFloatTextureDataFormat([new Float32Array([1])])).toBe('r');
    expect(inferFloatTextureDataFormat([new Float32Array([1]), new Float32Array([2])])).toBe('rg');
    expect(
      inferFloatTextureDataFormat([
        new Float32Array([1]),
        new Float32Array([2]),
        new Float32Array([3])
      ])
    ).toBe('rgb');
    expect(
      inferFloatTextureDataFormat([
        new Float32Array([1]),
        new Float32Array([2]),
        new Float32Array([3]),
        new Float32Array([4]),
        new Float32Array([5])
      ])
    ).toBe('rgba');
  });
});
