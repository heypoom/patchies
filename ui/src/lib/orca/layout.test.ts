import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ORCA_FULLSCREEN_FONT_SIZE,
  getOrcaColors,
  getOrcaDisplayFontSize,
  getOrcaDisplayForegroundMode,
  getOrcaFullscreenOverlayBackground,
  getOrcaPortForeground
} from './layout';

describe('getOrcaDisplayFontSize', () => {
  it('keeps the inline font size outside fullscreen mode', () => {
    expect(
      getOrcaDisplayFontSize({ inlineFontSize: 1.4, fullscreenFontSize: 3, isDetached: false })
    ).toBe(1.4);
  });

  it('uses the fullscreen font size while detached', () => {
    expect(
      getOrcaDisplayFontSize({
        inlineFontSize: 1.4,
        fullscreenFontSize: DEFAULT_ORCA_FULLSCREEN_FONT_SIZE,
        isDetached: true
      })
    ).toBe(DEFAULT_ORCA_FULLSCREEN_FONT_SIZE);
  });
});

describe('getOrcaFullscreenOverlayBackground', () => {
  it('uses black with the shared overlay transparency value', () => {
    expect(getOrcaFullscreenOverlayBackground(0.45)).toBe('rgba(0, 0, 0, 0.45)');
  });
});

describe('getOrcaDisplayForegroundMode', () => {
  it('keeps the inline foreground mode outside fullscreen mode', () => {
    expect(
      getOrcaDisplayForegroundMode({
        inlineMode: 'dark',
        fullscreenMode: 'light',
        isDetached: false
      })
    ).toBe('dark');
  });

  it('uses the fullscreen foreground mode while detached', () => {
    expect(
      getOrcaDisplayForegroundMode({
        inlineMode: 'dark',
        fullscreenMode: 'light',
        isDetached: true
      })
    ).toBe('light');
  });
});

describe('getOrcaColors', () => {
  it('keeps the original dark foreground palette', () => {
    expect(getOrcaColors('dark')).toMatchObject({
      f_med: '#777777',
      f_low: '#444444',
      f_hint: '#444444',
      b_high: '#eeeeee'
    });
  });

  it('uses brighter neutral foregrounds in light mode', () => {
    expect(getOrcaColors('light')).toMatchObject({
      f_med: '#d4d4d8',
      f_low: '#a1a1aa',
      f_hint: '#ffffff',
      f_on_bg: '#444444',
      b_high: '#ffffff'
    });
  });
});

describe('getOrcaPortForeground', () => {
  it('preserves cyan and white hint colors in light mode', () => {
    const colors = getOrcaColors('light');

    expect(getOrcaPortForeground(colors, 1)).toBe('#72dec2');
    expect(getOrcaPortForeground(colors, 2)).toBe('#ffffff');
  });
});
