/**
 * Orca Node Presets
 *
 * Pre-configured Orca patterns and demos
 */

import { DEFAULT_ORCA_WIDTH, DEFAULT_ORCA_HEIGHT } from '$lib/orca/constants';

// Helper to create a grid string from a visual pattern
function createGrid(width: number, height: number, pattern: string): string {
  const grid = new Array(width * height).fill('.');
  const lines = pattern.trim().split('\n');
  for (let y = 0; y < Math.min(lines.length, height); y++) {
    const line = lines[y];
    for (let x = 0; x < Math.min(line.length, width); x++) {
      grid[y * width + x] = line[x];
    }
  }
  return grid.join('');
}

export const ORCA_PRESETS = {
  'orca.hello': {
    type: 'orca',
    data: {
      grid: createGrid(
        DEFAULT_ORCA_WIDTH,
        DEFAULT_ORCA_HEIGHT,
        `....
....
....
....
...1D8....
..........
..........
...5A4.....`
      ),
      width: DEFAULT_ORCA_WIDTH,
      height: DEFAULT_ORCA_HEIGHT,
      bpm: 120,
      frame: 0
    }
  }
};
