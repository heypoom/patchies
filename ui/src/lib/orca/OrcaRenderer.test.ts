import { describe, expect, it, vi } from 'vitest';

import { library } from './library';
import { Orca } from './Orca';
import { OrcaRenderer } from './OrcaRenderer';
import { getOrcaColors } from './layout';

interface Fill {
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

describe('OrcaRenderer', () => {
  it('reduces background opacity of empty grid markers and status bar', () => {
    const fills: Fill[] = [];

    const context = {
      clearRect: vi.fn(),
      fillRect(x: number, y: number, width: number, height: number) {
        fills.push({ color: this.fillStyle, x, y, width, height });
      },
      fillStyle: '',
      fillText: vi.fn(),
      font: '',
      textAlign: 'center',
      textBaseline: 'bottom'
    };

    const canvas = {
      getContext: vi.fn(() => context),
      height: 0,
      style: {},
      width: 0
    } as unknown as HTMLCanvasElement;

    const orca = new Orca(library).load(9, 1, '.1.......', 0);
    const renderer = new OrcaRenderer(canvas, orca, getOrcaColors('light'), 1, 1);

    renderer.render(
      8,
      0,
      false,
      true,
      false,
      undefined,
      'transparent',
      'rgba(9, 9, 11, 0.7)',
      'rgba(9, 9, 11, 0.21)'
    );

    expect(fills).toContainEqual({
      color: 'rgba(9, 9, 11, 0.21)',
      x: 0,
      y: 0,
      width: 10,
      height: 15
    });

    expect(fills).toContainEqual({
      color: 'rgba(9, 9, 11, 0.7)',
      x: 10,
      y: 0,
      width: 10,
      height: 15
    });

    expect(fills).toContainEqual({
      color: 'rgba(9, 9, 11, 0.21)',
      x: 20,
      y: 30,
      width: 10,
      height: 15
    });
  });
});
