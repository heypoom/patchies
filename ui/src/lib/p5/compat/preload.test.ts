import { afterEach, describe, expect, it, vi } from 'vitest';
import { addPreload } from './preload';

const createPreloadAddon = () => {
  const sketch = {
    loadJSON: vi.fn().mockResolvedValue({ value: 42 }),
    loadImage: vi.fn().mockResolvedValue({ width: 20 }),
    loadModel: vi.fn(),
    loadStrings: vi.fn(),
    loadFont: vi.fn(),
    loadBytes: vi.fn().mockResolvedValue(new Uint8Array([1, 2])),
    loadTable: vi.fn()
  } as unknown as Parameters<typeof addPreload>[1];

  const p5 = {
    prototype: sketch,
    Image: class {},
    Geometry: class {},
    Font: class {},
    Table: class {}
  } satisfies Parameters<typeof addPreload>[0];

  const lifecycles: Parameters<typeof addPreload>[2] = {};
  addPreload(p5, sketch, lifecycles);

  return { sketch, lifecycles };
};

describe('p5 preload compatibility', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fills immediate placeholders before setup and preserves async loading outside preload', async () => {
    const { sketch, lifecycles } = createPreloadAddon();

    let image: unknown;
    let bytes: unknown;

    vi.stubGlobal('window', {
      preload: () => {
        image = sketch.loadImage('image.png');
        bytes = sketch.loadBytes('data.bin');

        expect(image).toEqual({});
        expect(bytes).toEqual({});
      }
    });

    await lifecycles.presetup?.call(sketch);

    expect(image).toEqual({ width: 20 });
    expect(bytes).toEqual({ bytes: new Uint8Array([1, 2]) });
    expect(sketch._isInPreload).toBe(false);

    await expect(sketch.loadJSON('data.json')).resolves.toEqual({ value: 42 });
  });

  it('runs registered callbacks at the corresponding lifecycle with the sketch as this', async () => {
    const { sketch, lifecycles } = createPreloadAddon();

    const callbacks = Array.from({ length: 5 }, () => vi.fn());

    const methods = ['init', 'afterSetup', 'pre', 'post', 'remove'] as const;
    const hooks = ['presetup', 'postsetup', 'predraw', 'postdraw', 'remove'] as const;

    vi.stubGlobal('window', {});

    methods.forEach((method, index) => {
      sketch.registerMethod(method, callbacks[index]);
    });

    for (const hook of hooks) {
      await lifecycles[hook]?.call(sketch);
    }

    for (const callback of callbacks) {
      expect(callback).toHaveBeenCalledOnce();
      expect(callback.mock.contexts[0]).toBe(sketch);
    }
  });
});
