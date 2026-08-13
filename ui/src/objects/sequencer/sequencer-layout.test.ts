import { describe, expect, it } from 'vitest';

import { getHeightForTrackCountChange } from './sequencer-layout';

describe('sequencer track layout', () => {
  it('grows and shrinks the node by one scaled track row', () => {
    const gridHeight = 24;

    expect(getHeightForTrackCountChange(126, 4, 5, gridHeight, 1)).toBe(154);
    expect(getHeightForTrackCountChange(126, 4, 3, gridHeight, 1)).toBe(98);
    expect(getHeightForTrackCountChange(189, 4, 5, gridHeight, 1.5)).toBe(231);
  });

  it('does not resize when tracks are edited without changing their count', () => {
    expect(getHeightForTrackCountChange(126, 4, 4, 24, 1)).toBe(126);
  });
});
