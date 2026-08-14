import { describe, expect, it } from 'vitest';

import { getBorderChromeClass, getBorderResetDataForRun } from './border-chrome';

describe('border chrome helpers', () => {
  it('uses borderless chrome when selected border is hidden', () => {
    expect(
      getBorderChromeClass({
        selected: true,
        noBorder: true,
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
        noBorder: true,
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
        noBorder: true,
        borderlessClass: 'borderless',
        idleClass: 'idle',
        selectedClass: 'selected',
        errorClass: 'error'
      })
    ).toBe('error');
  });

  it('suppresses error chrome while resize controls are visible', () => {
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
    ).toBe('borderless');
  });

  it('restores the border at run start when noBorder is no longer called', () => {
    expect(getBorderResetDataForRun({ noBorder: true })).toEqual({ noBorder: false });
    expect(getBorderResetDataForRun({ noBorder: false })).toEqual({});
    expect(getBorderResetDataForRun({})).toEqual({});
  });
});
