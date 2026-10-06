import { describe, expect, it } from 'vitest';
import createRegl from 'regl';

import {
  createFinalOutputPresentationCommand,
  FBO_RENDERER_CONTEXT_ATTRIBUTES
} from './finalOutputPresentation';

const renderOutputBitmap = (pixels: number[]): ImageBitmap => {
  const canvas = new OffscreenCanvas(pixels.length / 4, 1);
  const gl = canvas.getContext('webgl2', FBO_RENDERER_CONTEXT_ATTRIBUTES)!;
  const regl = createRegl({ gl });

  const texture = regl.texture({
    width: canvas.width,
    height: canvas.height,
    data: new Uint8Array(pixels)
  });

  try {
    const draw = createFinalOutputPresentationCommand(regl);
    draw({ texture, sourceUvRect: [0, 0, 1, 1] });

    return canvas.transferToImageBitmap();
  } finally {
    regl.destroy();
  }
};

const renderPreviewBitmap = (pixels: number[]): ImageBitmap => {
  const canvas = new OffscreenCanvas(pixels.length / 4, 1);

  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), canvas.width, 1), 0, 0);

  return canvas.transferToImageBitmap();
};

const readPresentedPixels = ({
  bitmap,
  background
}: {
  bitmap: ImageBitmap;
  background?: string;
}): number[] => {
  const display = new OffscreenCanvas(bitmap.width, bitmap.height);
  const target = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = target.getContext('2d')!;

  display.getContext('bitmaprenderer', { alpha: true })!.transferFromImageBitmap(bitmap);

  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, target.width, target.height);
  }

  ctx.drawImage(display, 0, 0);

  return Array.from(ctx.getImageData(0, 0, target.width, target.height).data);
};

describe('final output alpha presentation', () => {
  it.each(['#000000', '#204060'])('matches preview brightness over %s', (background) => {
    const pixels = [200, 100, 50, 128];

    const preview = readPresentedPixels({
      bitmap: renderPreviewBitmap(pixels),
      background
    });

    const output = readPresentedPixels({
      bitmap: renderOutputBitmap(pixels),
      background
    });

    expect(output).toEqual(preview);
  });

  it('preserves partial transparency', () => {
    const output = readPresentedPixels({
      bitmap: renderOutputBitmap([200, 100, 50, 128])
    });

    expect(output[3]).toBe(128);
  });

  it('does not leak hidden RGB from fully transparent pixels', () => {
    const output = readPresentedPixels({
      bitmap: renderOutputBitmap([255, 255, 255, 0])
    });

    expect(output).toEqual([0, 0, 0, 0]);
  });

  it('preserves a Circle-style transparent exterior, feathered edge, and opaque center', () => {
    const pixels = [255, 255, 255, 0, 255, 255, 255, 128, 255, 255, 255, 255];

    const output = readPresentedPixels({
      bitmap: renderOutputBitmap(pixels),
      background: '#000000'
    });

    expect(output.slice(0, 4)).toEqual([0, 0, 0, 255]);
    expect(output.slice(4, 8)).toEqual([128, 128, 128, 255]);
    expect(output.slice(8, 12)).toEqual([255, 255, 255, 255]);
  });
});
