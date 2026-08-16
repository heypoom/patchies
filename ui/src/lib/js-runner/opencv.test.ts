import { describe, expect, it, vi } from 'vitest';

describe('opencv', () => {
  it('waits for runtime initialization and caches the package load', async () => {
    const module: { Mat?: unknown; onRuntimeInitialized?: () => void } = {};
    let resolveImport!: (value: { default: typeof module }) => void;
    const esm = vi.fn(
      () =>
        new Promise<{ default: typeof module }>((resolve) => {
          resolveImport = resolve;
        })
    );
    const { opencv } = await import('./opencv');

    const first = opencv(esm);
    const second = opencv(esm);

    expect(esm).toHaveBeenCalledTimes(1);

    resolveImport({ default: module });
    await Promise.resolve();
    await Promise.resolve();
    expect(module.onRuntimeInitialized).toBeTypeOf('function');

    module.Mat = class Mat {};
    module.onRuntimeInitialized!();

    await expect(first).resolves.toBe(module);
    await expect(second).resolves.toBe(module);
  });

  it('retries after a failed package load', async () => {
    vi.resetModules();
    const module = { Mat: class Mat {} };
    const esm = vi
      .fn<() => Promise<{ default: typeof module }>>()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ default: module });
    const { opencv } = await import('./opencv');

    await expect(opencv(esm)).rejects.toThrow('network error');
    await expect(opencv(esm)).resolves.toBe(module);
    expect(esm).toHaveBeenCalledTimes(2);
  });
});
