import { describe, expect, it } from 'vitest';

import { screenToOrcaGridCell } from './pointer';

describe('screenToOrcaGridCell', () => {
  it('accounts for xyflow zoom in inline mode', () => {
    const cell = screenToOrcaGridCell({
      clientX: 140,
      clientY: 90,
      rect: { left: 100, top: 50 },
      zoom: 2,
      tileWidth: 10,
      tileHeight: 20
    });

    expect(cell).toEqual({ x: 2, y: 1 });
  });

  it('uses unscaled coordinates for portaled fullscreen mode', () => {
    const cell = screenToOrcaGridCell({
      clientX: 140,
      clientY: 90,
      rect: { left: 100, top: 50 },
      zoom: 1,
      tileWidth: 10,
      tileHeight: 20
    });

    expect(cell).toEqual({ x: 4, y: 2 });
  });
});
