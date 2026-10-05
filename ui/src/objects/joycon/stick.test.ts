import { describe, expect, it } from 'vitest';

import { decodeStick, normalizeStick, parseStickCalibration, type StickCalibration } from './stick';

const calibration: StickCalibration = {
  center: [2000, 2100],
  below: [1000, 1100],
  above: [1500, 1400]
};

function packPairs(pairs: number[][]): DataView {
  const data = new DataView(new ArrayBuffer(pairs.length * 3));

  pairs.forEach(([x, y], index) => {
    data.setUint8(index * 3, x & 255);
    data.setUint8(index * 3 + 1, (x >> 8) | ((y & 15) << 4));
    data.setUint8(index * 3 + 2, y >> 4);
  });

  return data;
}

describe('Joy-Con stick', () => {
  it('decodes non-byte-aligned 12-bit coordinates', () => {
    expect(decodeStick(packPairs([[0xabc, 0xdef]]), 0)).toEqual([0xabc, 0xdef]);
  });

  it('reads the different left and right calibration layouts', () => {
    const { center, below, above } = calibration;

    expect(parseStickCalibration(packPairs([above, center, below]), 'left')).toEqual(calibration);
    expect(parseStickCalibration(packPairs([center, below, above]), 'right')).toEqual(calibration);
  });

  it('rejects erased, zero, truncated, and out-of-range calibration', () => {
    expect(
      parseStickCalibration(
        packPairs([
          [4095, 4095],
          [4095, 4095],
          [4095, 4095]
        ]),
        'left'
      )
    ).toBeNull();
    expect(
      parseStickCalibration(
        packPairs([
          [0, 0],
          [0, 0],
          [0, 0]
        ]),
        'right'
      )
    ).toBeNull();
    expect(parseStickCalibration(new DataView(new ArrayBuffer(8)), 'left')).toBeNull();
    expect(
      parseStickCalibration(
        packPairs([
          [2000, 2000],
          [3000, 3000],
          [1000, 1000]
        ]),
        'left'
      )
    ).toBeNull();
  });

  it('normalizes asymmetric endpoints and zeros the radial dead zone', () => {
    expect(normalizeStick([2000, 2100], calibration)).toEqual([0, 0]);
    expect(normalizeStick([2100, 2200], calibration)).toEqual([0, 0]);
    expect(normalizeStick([3500, 2100], calibration)).toEqual([1, 0]);
    expect(normalizeStick([1000, 2100], calibration)).toEqual([-1, 0]);
    expect(normalizeStick([2000, 3500], calibration)).toEqual([0, 1]);
    expect(normalizeStick([2000, 1000], calibration)).toEqual([0, -1]);
  });

  it('rescales travel continuously and clamps diagonal magnitude', () => {
    const [x, y] = normalizeStick([3500, 3500], calibration);

    expect(Math.hypot(x, y)).toBeCloseTo(1);
    expect(x).toBeCloseTo(y);
    expect(normalizeStick([3500, 2100], calibration)[0]).toBe(1);
    expect(normalizeStick([2862.5, 2100], calibration)[0]).toBeCloseTo(0.5);
  });
});
