import { describe, expect, it } from 'vitest';
import { createDynamicCanvasDimension } from './dynamic-canvas-dimension';

describe('createDynamicCanvasDimension', () => {
  it('coerces to the latest canvas dimension for each arithmetic read', () => {
    let value = 200;
    const dimension = createDynamicCanvasDimension(() => value);

    expect(dimension / 4).toBe(50);

    value = 400;

    expect(dimension / 4).toBe(100);
    expect(`${dimension}`).toBe('400');
    expect(dimension.toFixed(1)).toBe('400.0');
    expect(dimension.toExponential(1)).toBe('4.0e+2');
    expect(dimension.toPrecision(3)).toBe('400');
  });
});
