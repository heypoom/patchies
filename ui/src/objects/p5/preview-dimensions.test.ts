import { describe, expect, it } from 'vitest';
import { getP5PreviewDimensions } from './preview-dimensions';

describe('getP5PreviewDimensions', () => {
  it('uses the surface preview scale for createSurfaceCanvas containers', () => {
    expect(getP5PreviewDimensions({ width: 1280, height: 720, isSurfaceCanvas: true })).toEqual({
      width: 320,
      height: 180
    });
  });

  it('keeps ordinary createCanvas dimensions unchanged', () => {
    expect(getP5PreviewDimensions({ width: 400, height: 400, isSurfaceCanvas: false })).toEqual({
      width: 400,
      height: 400
    });
  });
});
