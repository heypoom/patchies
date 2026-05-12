import { describe, expect, it } from 'vitest';

import { FloatTextureUploadBufferPool } from './upload-buffer-pool';

describe('FloatTextureUploadBufferPool', () => {
  it('copies source data into an acquired upload buffer', () => {
    const pool = new FloatTextureUploadBufferPool();
    const source = new Float32Array([0.25, 0.5, 0.75, 1]);

    const upload = pool.acquire(source);

    expect(upload).not.toBe(source);
    expect(upload.buffer).not.toBe(source.buffer);
    expect(Array.from(upload)).toEqual([0.25, 0.5, 0.75, 1]);
  });

  it('reuses a released buffer with the same byte length', () => {
    const pool = new FloatTextureUploadBufferPool();
    const first = pool.acquire(new Float32Array([1, 2]));
    const buffer = first.buffer;

    pool.release(buffer);

    const second = pool.acquire(new Float32Array([3, 4]));

    expect(second.buffer).toBe(buffer);
    expect(Array.from(second)).toEqual([3, 4]);
  });

  it('does not reuse buffers with a different byte length', () => {
    const pool = new FloatTextureUploadBufferPool();
    const first = pool.acquire(new Float32Array([1, 2]));
    const buffer = first.buffer;

    pool.release(buffer);

    const second = pool.acquire(new Float32Array([3, 4, 5, 6]));

    expect(second.buffer).not.toBe(buffer);
    expect(Array.from(second)).toEqual([3, 4, 5, 6]);
  });

  it('keeps only the configured number of released buffers per byte length', () => {
    const pool = new FloatTextureUploadBufferPool({ maxBuffersPerByteLength: 1 });
    const first = pool.acquire(new Float32Array([1, 2]));
    const second = pool.acquire(new Float32Array([3, 4]));

    pool.release(first.buffer);
    pool.release(second.buffer);

    const third = pool.acquire(new Float32Array([5, 6]));
    const fourth = pool.acquire(new Float32Array([7, 8]));

    expect([first.buffer, second.buffer]).toContain(third.buffer);
    expect([first.buffer, second.buffer]).not.toContain(fourth.buffer);
  });
});
