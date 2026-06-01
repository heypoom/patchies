import { describe, expect, it } from 'vitest';
import { isFBOCompatible } from '$lib/rendering/types';

describe('detached code editor output override policy', () => {
  it('allows render-graph nodes to become temporary background output targets', () => {
    expect(isFBOCompatible('glsl')).toBe(true);
    expect(isFBOCompatible('hydra')).toBe(true);
    expect(isFBOCompatible('canvas')).toBe(true);
    expect(isFBOCompatible('three')).toBe(true);
  });

  it('does not auto-pin non-render-graph nodes when opening the expanded editor', () => {
    expect(isFBOCompatible('p5')).toBe(false);
    expect(isFBOCompatible('canvas.dom')).toBe(false);
    expect(isFBOCompatible('dom')).toBe(false);
    expect(isFBOCompatible('vue')).toBe(false);
    expect(isFBOCompatible(undefined)).toBe(false);
  });
});
