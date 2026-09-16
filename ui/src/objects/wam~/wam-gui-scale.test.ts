import { describe, expect, it } from 'vitest';
import { getWamGuiMinimumSize, getWamGuiScale } from './wam-gui-scale';

describe('getWamGuiMinimumSize', () => {
  it('does not let a WAM be resized below its native GUI dimensions', () => {
    expect(getWamGuiMinimumSize({ width: 399.2, height: 200.1 })).toEqual({
      width: 400,
      height: 201
    });
  });

  it('keeps the empty WAM node usable before a GUI is measured', () => {
    expect(getWamGuiMinimumSize({ width: 0, height: 0 })).toEqual({ width: 64, height: 128 });
  });
});

describe('getWamGuiScale', () => {
  it('fills the resized WAM viewport from its natural GUI dimensions', () => {
    expect(getWamGuiScale({ width: 400, height: 200 }, { width: 600, height: 300 })).toEqual({
      x: 1.5,
      y: 1.5
    });

    expect(getWamGuiScale({ width: 400, height: 200 }, { width: 200, height: 500 })).toEqual({
      x: 0.5,
      y: 0.5
    });
  });

  it('does not scale before both dimensions are measurable', () => {
    expect(getWamGuiScale({ width: 400, height: 200 }, { width: 0, height: 300 })).toEqual({
      x: 1,
      y: 1
    });
  });
});
