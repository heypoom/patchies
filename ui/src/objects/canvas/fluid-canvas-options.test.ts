import { describe, expect, it } from 'vitest';
import { resolveFluidCanvasOptions } from './fluid-canvas-options';

describe('resolveFluidCanvasOptions', () => {
  it('defaults to a visible freeform resizer', () => {
    expect(resolveFluidCanvasOptions()).toEqual({
      showResizer: true,
      resize: 'both',
      keepAspectRatio: false,
      initialSize: undefined
    });
  });

  it('preserves each supported resize constraint', () => {
    expect(resolveFluidCanvasOptions({ resize: 'horizontal' })).toMatchObject({
      resize: 'horizontal'
    });
    expect(resolveFluidCanvasOptions({ resize: 'vertical' })).toMatchObject({ resize: 'vertical' });
    expect(resolveFluidCanvasOptions({ showResizer: false })).toMatchObject({ showResizer: false });
    expect(resolveFluidCanvasOptions({ keepAspectRatio: true })).toMatchObject({
      keepAspectRatio: true
    });
    expect(resolveFluidCanvasOptions({ initialSize: { width: 800, height: 600 } })).toMatchObject({
      initialSize: { width: 800, height: 600 }
    });
  });
});
