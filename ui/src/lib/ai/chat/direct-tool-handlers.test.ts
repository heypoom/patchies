import { describe, expect, test } from 'vitest';

import { resolveInsertObject, resolveInsertObjects } from './direct-tool-handlers';

const viewportSummary = {
  viewport: { x: -1000, y: -900, zoom: 1 },
  center: { x: 1200, y: 900 },
  bounds: {
    left: 800,
    top: 600,
    right: 1600,
    bottom: 1200,
    width: 800,
    height: 600
  },
  screen: { x: 0, y: 0, width: 800, height: 600 }
};

describe('direct chat tool handlers', () => {
  test('preserves optional position for insert_object', () => {
    const action = resolveInsertObject({
      type: 'p5',
      data: { code: 'function draw() {}' },
      position: { x: 120, y: -40 }
    });

    expect(action.result).toEqual({
      kind: 'single',
      type: 'p5',
      data: { code: 'function draw() {}' },
      position: { x: 120, y: -40 }
    });
  });

  test('uses viewport center for insert_object when position is omitted after get_viewport', () => {
    const action = resolveInsertObject(
      {
        type: 'p5',
        data: { code: 'function draw() {}' }
      },
      { viewportSummary }
    );

    expect(action.result).toEqual({
      kind: 'single',
      type: 'p5',
      data: { code: 'function draw() {}' },
      position: { x: 1200, y: 900 }
    });
  });

  test('uses viewport center as multi-object base for relative layouts', () => {
    const action = resolveInsertObjects(
      {
        nodes: [
          { type: 'slider', data: {}, position: { x: 0, y: 0 } },
          { type: 'p5', data: { code: 'function draw() {}' }, position: { x: 320, y: 0 } }
        ],
        edges: []
      },
      { viewportSummary }
    );

    expect(action.result).toEqual({
      kind: 'multi',
      nodes: [
        { type: 'slider', data: {}, position: { x: 0, y: 0 } },
        { type: 'p5', data: { code: 'function draw() {}' }, position: { x: 320, y: 0 } }
      ],
      edges: [],
      basePosition: { x: 1200, y: 900 }
    });
  });

  test('does not double-offset multi-object positions that already use viewport coordinates', () => {
    const action = resolveInsertObjects(
      {
        nodes: [
          { type: 'slider', data: {}, position: { x: 1000, y: 850 } },
          { type: 'p5', data: { code: 'function draw() {}' }, position: { x: 1320, y: 850 } }
        ],
        edges: []
      },
      { viewportSummary }
    );

    expect(action.result).toEqual({
      kind: 'multi',
      nodes: [
        { type: 'slider', data: {}, position: { x: 1000, y: 850 } },
        { type: 'p5', data: { code: 'function draw() {}' }, position: { x: 1320, y: 850 } }
      ],
      edges: [],
      basePosition: { x: 0, y: 0 }
    });
  });
});
