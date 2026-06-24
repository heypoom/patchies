import { describe, expect, it } from 'vitest';
import { isSameMouseData, type MouseData } from './mouseData';

describe('isSameMouseData', () => {
  it('matches identical mouse payloads', () => {
    expect(isSameMouseData([0, 0, -1, -1], [0, 0, -1, -1])).toBe(true);
  });

  it('detects changed mouse coordinates and buttons', () => {
    const previous: MouseData = [0, 0, -1, -1, 0];

    expect(isSameMouseData(previous, [1, 0, -1, -1, 0])).toBe(false);
    expect(isSameMouseData(previous, [0, 0, -1, -1, 1])).toBe(false);
  });
});
