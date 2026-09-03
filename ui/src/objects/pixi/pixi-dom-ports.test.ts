import { describe, expect, it, vi } from 'vitest';

import { createPixiDomSetPortCount, getPixiDomPortLayout } from './pixi-dom-ports';

describe('pixi.dom message ports', () => {
  it('turns setPortCount values into exposed inlet and outlet positions', () => {
    const data: { inletCount?: number; outletCount?: number } = {};
    const updateNodeInternals = vi.fn();

    const updateNodeData = vi.fn((_nodeId: string, updates: typeof data) => {
      Object.assign(data, updates);
    });

    const setPortCount = createPixiDomSetPortCount({
      getNodeId: () => 'pixi.dom-1',
      updateNodeData,
      updateNodeInternals
    });

    setPortCount(2, 3);

    expect(getPixiDomPortLayout(data, true)).toEqual({
      inletIndices: [0, 1],
      messageOutletIndices: [1, 2, 3],
      totalOutletCount: 4,
      videoOutletIndex: 0
    });

    expect(updateNodeData).toHaveBeenCalledWith('pixi.dom-1', {
      inletCount: 2,
      outletCount: 3
    });

    expect(updateNodeInternals).toHaveBeenCalledWith('pixi.dom-1');
  });

  it('uses the standard one-inlet, zero-outlet defaults', () => {
    expect(getPixiDomPortLayout({}, false)).toEqual({
      inletIndices: [0],
      messageOutletIndices: [],
      totalOutletCount: 0,
      videoOutletIndex: undefined
    });
  });
});
