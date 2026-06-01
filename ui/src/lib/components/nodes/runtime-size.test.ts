import { describe, expect, it } from 'vitest';

import { DEFAULT_OUTPUT_SIZE, PREVIEW_SCALE_FACTOR } from '$lib/canvas/constants';
import { resetCanvasSize } from './runtime-size';

describe('runtime size resets', () => {
  it('resets canvas element dimensions to the default output size', () => {
    const canvas = {
      width: 640,
      height: 360,
      style: {
        width: '160px',
        height: '90px'
      }
    } as HTMLCanvasElement;

    resetCanvasSize(canvas, DEFAULT_OUTPUT_SIZE);

    expect(canvas.width).toBe(DEFAULT_OUTPUT_SIZE[0]);
    expect(canvas.height).toBe(DEFAULT_OUTPUT_SIZE[1]);
    expect(canvas.style.width).toBe(`${DEFAULT_OUTPUT_SIZE[0] / PREVIEW_SCALE_FACTOR}px`);
    expect(canvas.style.height).toBe(`${DEFAULT_OUTPUT_SIZE[1] / PREVIEW_SCALE_FACTOR}px`);
  });
});
