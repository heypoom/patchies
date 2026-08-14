import { describe, expect, it } from 'vitest';
import { getLivePreviewContainScale } from './live-preview-contain';

describe('getLivePreviewContainScale', () => {
  it('fits a wide preview by viewport width', () => {
    expect(
      getLivePreviewContainScale({ width: 1600, height: 900 }, { width: 1000, height: 900 })
    ).toBe(0.625);
  });

  it('fits a tall preview by viewport height', () => {
    expect(
      getLivePreviewContainScale({ width: 600, height: 1200 }, { width: 1200, height: 800 })
    ).toBe(2 / 3);
  });

  it('can enlarge a smaller preview without changing its aspect ratio', () => {
    expect(
      getLivePreviewContainScale({ width: 320, height: 180 }, { width: 1280, height: 720 })
    ).toBe(4);
  });
});
