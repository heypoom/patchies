import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ORCA_FULLSCREEN_FONT_SIZE,
  getOrcaDisplayFontSize,
  getOrcaFullscreenOverlayBackground
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
