import { describe, expect, it } from 'vitest';

import { getControlStep, snapControlValue } from './stepped-control';

describe('stepped control values', () => {
  it('defaults to integer and float steps by mode', () => {
    expect(getControlStep({ isFloat: false })).toBe(1);
    expect(getControlStep({ isFloat: true })).toBe(0.01);
  });

  it('falls back to mode default for invalid steps', () => {
    expect(getControlStep({ step: 0, isFloat: true })).toBe(0.01);
    expect(getControlStep({ step: -2, isFloat: false })).toBe(1);
  });

  it('snaps values to the nearest configured step from min', () => {
    expect(snapControlValue(0.26, { min: 0, max: 1, step: 0.1, isFloat: true })).toBe(0.3);
    expect(snapControlValue(22, { min: 20, max: 880, step: 5, isFloat: false })).toBe(20);
    expect(snapControlValue(23, { min: 20, max: 880, step: 5, isFloat: false })).toBe(25);
  });

  it('clamps after snapping', () => {
    expect(snapControlValue(1.2, { min: 0, max: 1, step: 0.1, isFloat: true })).toBe(1);
    expect(snapControlValue(-0.2, { min: 0, max: 1, step: 0.1, isFloat: true })).toBe(0);
  });
});
