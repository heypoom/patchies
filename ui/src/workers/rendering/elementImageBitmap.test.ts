import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderElementImageToBitmap } from './elementImageBitmap';

describe('renderElementImageToBitmap', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('draws a transferable ElementImage into an OffscreenCanvas bitmap', () => {
    const bitmap = { width: 320, height: 180 };
    const drawElementImage = vi.fn();
    const clearRect = vi.fn();
    const close = vi.fn();
    const transferToImageBitmap = vi.fn(() => bitmap);

    class OffscreenCanvasStub {
      width: number;
      height: number;

      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
      }

      getContext(kind: string) {
        return kind === '2d' ? { clearRect, drawElementImage } : null;
      }

      transferToImageBitmap = transferToImageBitmap;
    }

    vi.stubGlobal('OffscreenCanvas', OffscreenCanvasStub);

    const elementImage = { width: 320, height: 180, close };
    const result = renderElementImageToBitmap(elementImage, 320, 180);

    expect(result).toBe(bitmap);
    expect(clearRect).toHaveBeenCalledWith(0, 0, 320, 180);
    expect(drawElementImage).toHaveBeenCalledWith(elementImage, 0, 0, 320, 180);
    expect(transferToImageBitmap).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it('closes the ElementImage and returns null when the worker lacks drawElementImage', () => {
    const close = vi.fn();

    class OffscreenCanvasStub {
      constructor(_width: number, _height: number) {}

      getContext(kind: string) {
        return kind === '2d' ? { clearRect: vi.fn() } : null;
      }
    }

    vi.stubGlobal('OffscreenCanvas', OffscreenCanvasStub);

    expect(renderElementImageToBitmap({ width: 1, height: 1, close }, 1, 1)).toBeNull();
    expect(close).toHaveBeenCalledOnce();
  });
});
