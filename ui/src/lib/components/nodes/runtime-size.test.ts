import { describe, expect, it } from 'vitest';

import { DEFAULT_OUTPUT_SIZE, PREVIEW_SCALE_FACTOR } from '$lib/canvas/constants';
import { measureDomSize, resetCanvasSize, shouldResetDomSize } from './runtime-size';

describe('runtime size resets', () => {
  it('keeps persisted DOM dimensions when code calls setSize', () => {
    expect(
      shouldResetDomSize(`setTitle('MOD-04 Calculator');
setSize(270, 390);
noDrag();`)
    ).toBe(false);
  });

  it('clears persisted DOM dimensions when code no longer calls setSize', () => {
    expect(
      shouldResetDomSize(`setTitle('MOD-04 Calculator');
noDrag();`)
    ).toBe(true);
  });

  it('clears persisted DOM dimensions when setSize only appears in a line comment', () => {
    expect(
      shouldResetDomSize(`setTitle('MOD-04 Calculator');
// setSize(270, 390);
noDrag();`)
    ).toBe(true);
  });

  it('clears persisted DOM dimensions when setSize only appears in a block comment', () => {
    expect(
      shouldResetDomSize(`setTitle('MOD-04 Calculator');
/* setSize(270, 390); */
noDrag();`)
    ).toBe(true);
  });

  it('measures current DOM dimensions before clearing persisted size', () => {
    const element = {
      getBoundingClientRect: () => ({ width: 270, height: 390 })
    } as HTMLElement;

    expect(measureDomSize(element, {}, 1)).toEqual({ width: 270, height: 390 });
  });

  it('accounts for xyflow zoom when measuring current DOM dimensions', () => {
    const element = {
      getBoundingClientRect: () => ({ width: 540, height: 780 })
    } as HTMLElement;

    expect(measureDomSize(element, {}, 2)).toEqual({ width: 270, height: 390 });
  });

  it('falls back to persisted DOM dimensions when measured dimensions are not available', () => {
    const element = {
      getBoundingClientRect: () => ({ width: 0, height: 0 })
    } as HTMLElement;

    expect(measureDomSize(element, { width: 270, height: 390 }, 2)).toEqual({
      width: 270,
      height: 390
    });
  });

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
