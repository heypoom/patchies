import { describe, expect, it } from 'vitest';

import {
  getFloatTextureTextureFormat,
  inferFloatTextureDataFormat,
  isFloatTextureSharedSource,
  packFloatTexture
} from './pack-float-texture';

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

  it('reuses the target buffer when it has the expected size', () => {
    const target = new Float32Array(8);
    const result = packFloatTexture(new Float32Array([0.25, 0.5]), { target });

    expect(result.data).toBe(target);
    expect(Array.from(target)).toEqual([0.25, 0, 0, 1, 0.5, 0, 0, 1]);
  });

  it('allocates a new target buffer when the provided target has the wrong size', () => {
    const target = new Float32Array(4);
    const result = packFloatTexture(new Float32Array([0.25, 0.5]), { target });

    expect(result.data).not.toBe(target);
    expect(result.data.length).toBe(8);
  });

  it('uses explicit RGBA pixel data without repacking', () => {
    const data = new Float32Array([1, 0, 0, 1, 0, 0, 1, 1]);
    const result = packFloatTexture({ data, width: 2, height: 1, type: 'rgba' });

    expect(result.width).toBe(2);
    expect(result.height).toBe(1);
    expect(result.data).toBe(data);
  });

  it('rejects explicit RGBA pixel data with the wrong length', () => {
    expect(() =>
      packFloatTexture({
        data: new Float32Array([1, 0, 0, 1]),
        width: 2,
        height: 1,
        type: 'rgba'
      })
    ).toThrow('Expected RGBA data length 8, received 4');
  });

  it('uses explicit SharedArrayBuffer RGBA pixel data without copying', () => {
    const buffer = new SharedArrayBuffer(2 * 1 * 4 * Float32Array.BYTES_PER_ELEMENT);
    const pixels = new Float32Array(buffer);

    pixels.set([1, 0, 0, 1, 0, 0, 1, 1]);

    const result = packFloatTexture({ buffer, width: 2, height: 1, type: 'rgba', version: 1 });

    expect(result.width).toBe(2);
    expect(result.height).toBe(1);
    expect(result.data.buffer).toBe(buffer);
    expect(Array.from(result.data)).toEqual([1, 0, 0, 1, 0, 0, 1, 1]);
  });

  it('rejects SharedArrayBuffer RGBA pixel data with the wrong byte length', () => {
    expect(() =>
      packFloatTexture({
        buffer: new SharedArrayBuffer(4 * Float32Array.BYTES_PER_ELEMENT),
        width: 2,
        height: 1,
        type: 'rgba',
        version: 1
      })
    ).toThrow('Expected RGBA buffer byteLength 32, received 16');
  });

  it('detects SharedArrayBuffer RGBA sources', () => {
    const source = {
      buffer: new SharedArrayBuffer(4 * Float32Array.BYTES_PER_ELEMENT),
      width: 1,
      height: 1,
      type: 'rgba',
      version: 1
    };

    expect(isFloatTextureSharedSource(source)).toBe(true);
  });

  it('reads texture format from object-shaped texture sources', () => {
    expect(
      getFloatTextureTextureFormat({
        data: new Float32Array([1, 0, 0, 1]),
        width: 1,
        height: 1,
        type: 'rgba',
        textureFormat: 'rgba8'
      })
    ).toBe('rgba8');

    expect(
      getFloatTextureTextureFormat({
        type: 'wrapped',
        channels: new Float32Array([1]),
        width: 1,
        textureFormat: 'rgba16f'
      })
    ).toBe('rgba16f');
  });

  it('wraps long channel rows by the requested width', () => {
    const result = packFloatTexture({
      type: 'wrapped',
      channels: new Float32Array([1, 2, 3, 4, 5]),
      width: 2
    });

    expect(result.width).toBe(2);
    expect(result.height).toBe(3);
    expect(Array.from(result.data)).toEqual([
      1, 0, 0, 1, 2, 0, 0, 1, 3, 0, 0, 1, 4, 0, 0, 1, 5, 0, 0, 1, 0, 0, 0, 1
    ]);
  });

  it('starts each channel group on a new row in wrapped layout', () => {
    const result = packFloatTexture({
      type: 'wrapped',
      channels: [new Float32Array([1, 2, 3]), new Float32Array([4, 5, 6])],
      format: 'r',
      width: 2
    });

    expect(result.width).toBe(2);
    expect(result.height).toBe(4);
    expect(Array.from(result.data)).toEqual([
      1, 0, 0, 1, 2, 0, 0, 1, 3, 0, 0, 1, 0, 0, 0, 1, 4, 0, 0, 1, 5, 0, 0, 1, 6, 0, 0, 1, 0, 0, 0, 1
    ]);
  });

  it('packs channel groups into a square texture', () => {
    const result = packFloatTexture({
      type: 'square',
      channels: [new Float32Array([1, 2, 3]), new Float32Array([4, 5])],
      format: 'r'
    });

    expect(result.width).toBe(3);
    expect(result.height).toBe(3);
    expect(Array.from(result.data)).toEqual([
      1, 0, 0, 1, 2, 0, 0, 1, 3, 0, 0, 1, 4, 0, 0, 1, 5, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0,
      1, 0, 0, 0, 1
    ]);
  });

  it('wraps SharedArrayBuffer channel rows by the requested width', () => {
    const buffer = new SharedArrayBuffer(5 * Float32Array.BYTES_PER_ELEMENT);
    new Float32Array(buffer).set([1, 2, 3, 4, 5]);

    const result = packFloatTexture({
      type: 'wrapped',
      channels: buffer,
      width: 2,
      version: 1
    });

    expect(result.width).toBe(2);
    expect(result.height).toBe(3);
    expect(Array.from(result.data)).toEqual([
      1, 0, 0, 1, 2, 0, 0, 1, 3, 0, 0, 1, 4, 0, 0, 1, 5, 0, 0, 1, 0, 0, 0, 1
    ]);
  });

  it('packs SharedArrayBuffer channel groups into a square texture', () => {
    const x = new SharedArrayBuffer(3 * Float32Array.BYTES_PER_ELEMENT);
    const y = new SharedArrayBuffer(2 * Float32Array.BYTES_PER_ELEMENT);

    new Float32Array(x).set([1, 2, 3]);
    new Float32Array(y).set([4, 5]);

    const result = packFloatTexture({
      type: 'square',
      channels: [x, y],
      format: 'r',
      version: 1
    });

    expect(result.width).toBe(3);
    expect(result.height).toBe(3);
    expect(Array.from(result.data)).toEqual([
      1, 0, 0, 1, 2, 0, 0, 1, 3, 0, 0, 1, 4, 0, 0, 1, 5, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0,
      1, 0, 0, 0, 1
    ]);
  });
});
