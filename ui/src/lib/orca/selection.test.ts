import { describe, expect, it } from 'vitest';

import { fillOrcaSelection, getOrcaSelectionBounds } from './selection';

describe('getOrcaSelectionBounds', () => {
  it('includes every cell from cursor to drag endpoint', () => {
    expect(getOrcaSelectionBounds({ x: 2, y: 1, w: 3, h: 2 })).toEqual({
      minX: 2,
      minY: 1,
      maxX: 5,
      maxY: 3,
      width: 4,
      height: 3
    });
  });

  it('normalizes selections dragged up and left', () => {
    expect(getOrcaSelectionBounds({ x: 5, y: 3, w: -3, h: -2 })).toEqual({
      minX: 2,
      minY: 1,
      maxX: 5,
      maxY: 3,
      width: 4,
      height: 3
    });
  });
});

describe('fillOrcaSelection', () => {
  it('writes the same glyph to every selected cell', () => {
    const writes: Array<[number, number, string]> = [];

    fillOrcaSelection(
      {
        x: 1,
        y: 1,
        w: 1,
        h: 1
      },
      'a',
      (x, y, glyph) => {
        writes.push([x, y, glyph]);
      }
    );

    expect(writes).toEqual([
      [1, 1, 'a'],
      [2, 1, 'a'],
      [1, 2, 'a'],
      [2, 2, 'a']
    ]);
  });

  it('writes selections dragged up and left in top-left to bottom-right order', () => {
    const writes: Array<[number, number, string]> = [];

    fillOrcaSelection({ x: 2, y: 2, w: -1, h: -1 }, 'b', (x, y, glyph) => {
      writes.push([x, y, glyph]);
    });

    expect(writes).toEqual([
      [1, 1, 'b'],
      [2, 1, 'b'],
      [1, 2, 'b'],
      [2, 2, 'b']
    ]);
  });
});
