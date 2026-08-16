import { describe, expect, it, vi } from 'vitest';

import { opencv } from './opencv';

describe('opencv', () => {
  it('waits for runtime initialization and caches the package load', async () => {
    const module: { Mat?: unknown; onRuntimeInitialized?: () => void } = {};
    const esm = vi.fn(async () => ({ default: module }));

    const first = opencv(esm);
    const second = opencv(esm);

    expect(esm).toHaveBeenCalledTimes(1);

    module.Mat = class Mat {};
    module.onRuntimeInitialized?.();

    await expect(first).resolves.toBe(module);
    await expect(second).resolves.toBe(module);
  });
});
