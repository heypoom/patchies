import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type ShapesAddon = (p5: unknown, fn: unknown, lifecycles: unknown) => void;

const addonContext = { module: { exports: {} as ShapesAddon } };

runInNewContext(
  readFileSync(new URL('../../../static/lib/p5/compat/shapes.js', import.meta.url), 'utf8'),
  addonContext
);

const nativeBezierVertex = vi.fn();
const bezierOrder = vi.fn();

const sketch = {
  bezierVertex: nativeBezierVertex,
  bezierOrder,
  beginShape: vi.fn(),
  endShape: vi.fn(),
  _renderer: {}
};

// Apply the same addon entry point that p5.registerAddon calls.
addonContext.module.exports({}, sketch, {});

describe('p5 shape compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts the point calls used internally by the v2 bezier renderer', () => {
    sketch.beginShape();
    sketch.bezierVertex(8, -4);
    sketch.bezierVertex(6, -1);
    sketch.bezierVertex(6, 2);
    sketch.bezierVertex(8, 4);
    sketch.endShape();

    expect(nativeBezierVertex.mock.calls).toEqual([
      [8, -4],
      [6, -1],
      [6, 2],
      [8, 4]
    ]);

    expect(bezierOrder).not.toHaveBeenCalled();
  });

  it('forwards native 3D points without changing the active curve order', () => {
    sketch.bezierVertex(10, 20, 30);

    expect(nativeBezierVertex).toHaveBeenCalledWith(10, 20, 30);
    expect(bezierOrder).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: '2D',
      points: [-43, -7, -48, -27, -53, -25],
      expected: [
        [-43, -7],
        [-48, -27],
        [-53, -25]
      ]
    },
    {
      name: '3D',
      points: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      expected: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9]
      ]
    }
  ])('keeps v1 $name cubic segments working', ({ points, expected }) => {
    sketch.bezierVertex(...points);

    expect(nativeBezierVertex.mock.calls).toEqual(expected);
    expect(bezierOrder).toHaveBeenCalledWith(3);
  });

  it('still rejects unsupported argument counts', () => {
    expect(() => sketch.bezierVertex(1)).toThrow(/bezierVertex\(\).*called with 1/);

    expect(nativeBezierVertex).not.toHaveBeenCalled();
  });
});
