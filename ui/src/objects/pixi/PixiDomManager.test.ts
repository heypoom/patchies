import { afterAll, describe, expect, it, vi } from 'vitest';

const pixiMocks = vi.hoisted(() => ({
  applications: [] as Array<{ destroy: ReturnType<typeof vi.fn> }>,
  extensionVersion: 0,
  initWaiters: [] as Promise<void>[],
  resizeRenderTarget: vi.fn(),
  loadExtensions: vi.fn(async () => {
    pixiMocks.extensionVersion += 1;
  })
}));

vi.mock('$objects/pixi/extensions', () => ({
  getPixiExtensionVersion: () => pixiMocks.extensionVersion,
  loadPixiDomExtensions: pixiMocks.loadExtensions
}));

vi.mock('pixi.js', () => ({
  Application: class {
    renderer = {
      extensionVersion: -1,
      events: {
        rootBoundary: { rootTarget: null },
        setTargetElement: vi.fn()
      },
      renderTarget: {
        getRenderTarget: vi.fn(() => ({
          colorTexture: { source: { resize: pixiMocks.resizeRenderTarget } }
        }))
      }
    };

    ticker = {
      add: vi.fn(),
      remove: vi.fn(),
      start: vi.fn()
    };

    destroy = vi.fn();

    constructor() {
      pixiMocks.applications.push(this);
    }

    async init() {
      this.renderer.extensionVersion = pixiMocks.extensionVersion;

      await pixiMocks.initWaiters.shift();
    }
  },
  Container: class {
    destroy = vi.fn();
  }
}));

import { pixiDomManager } from './PixiDomManager';

const deferred = () => {
  let resolve!: () => void;

  const promise = new Promise<void>((next) => {
    resolve = next;
  });

  return { promise, resolve };
};

describe('PixiDomManager', () => {
  afterAll(() => {
    pixiDomManager.destroy();
    vi.unstubAllGlobals();
  });

  it('serializes concurrent extension loads through application recreation', async () => {
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    await pixiDomManager.getApplication();

    const recreation = deferred();
    pixiMocks.initWaiters.push(recreation.promise);

    const firstLoad = pixiDomManager.loadExtensions('filters');
    await vi.waitFor(() => expect(pixiMocks.applications).toHaveLength(2));

    const secondLoad = pixiDomManager.loadExtensions('text');
    expect(pixiMocks.loadExtensions).toHaveBeenCalledTimes(1);

    recreation.resolve();
    await Promise.all([firstLoad, secondLoad]);

    expect(pixiMocks.loadExtensions.mock.calls).toEqual([['filters'], ['text']]);

    expect(
      (pixiDomManager.getRenderer() as unknown as { extensionVersion: number }).extensionVersion
    ).toBe(2);
  });

  it('resizes the cached render target when a node canvas grows', async () => {
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    const canvas = {
      addEventListener: vi.fn(),
      getContext: vi.fn(),
      height: 180,
      removeEventListener: vi.fn(),
      width: 320
    } as unknown as HTMLCanvasElement;

    await pixiDomManager.register(
      'node-1',
      canvas,
      { width: 320, height: 180 },
      vi.fn(),
      vi.fn(),
      vi.fn()
    );

    pixiMocks.resizeRenderTarget.mockClear();
    pixiDomManager.resize('node-1', { width: 640, height: 360 });

    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(360);
    expect(pixiMocks.resizeRenderTarget).toHaveBeenCalledWith(640, 360);
  });
});
