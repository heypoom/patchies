import { describe, expect, it } from 'vitest';

import { getBorderChromeClass, getBorderResetDataForRun } from './border-chrome';

describe('border chrome helpers', () => {
  it('uses borderless chrome when selected border is hidden', () => {
    expect(
      getBorderChromeClass({
        selected: true,
        hideBorder: true,
        borderlessClass: 'borderless',
        idleClass: 'idle',
        selectedClass: 'selected',
        errorClass: 'error'
      })
    ).toBe('borderless');
  });

  it('uses borderless chrome when idle border is hidden', () => {
    expect(
      getBorderChromeClass({
        selected: false,
        hideBorder: true,
        borderlessClass: 'borderless',
        idleClass: 'idle',
        selectedClass: 'selected',
        errorClass: 'error'
      })
    ).toBe('borderless');
  });

  it('keeps error chrome visible when border is hidden', () => {
    expect(
      getBorderChromeClass({
        hasError: true,
        selected: true,
        hideBorder: true,
        borderlessClass: 'borderless',
        idleClass: 'idle',
        selectedClass: 'selected',
        errorClass: 'error'
      })
    ).toBe('error');
  });

  it('restores the border at run start when hideBorder is no longer called', () => {
    expect(getBorderResetDataForRun({ hideBorder: true })).toEqual({ hideBorder: false });
    expect(getBorderResetDataForRun({ hideBorder: false })).toEqual({});
    expect(getBorderResetDataForRun({})).toEqual({});
  });
});
