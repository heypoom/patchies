export const DEFAULT_ORCA_FULLSCREEN_FONT_SIZE = 2.7;

export type OrcaForegroundMode = 'dark' | 'light';

export type OrcaColors = {
  background: string;
  f_high: string;
  f_med: string;
  f_low: string;
  f_hint: string;
  f_on_bg: string;
  f_inv: string;
  b_high: string;
  b_med: string;
  b_low: string;
  b_inv: string;
  cursor: string;
};

type OrcaDisplayFontSizeOptions = {
  inlineFontSize: number;
  fullscreenFontSize: number;
  isDetached: boolean;
};

type OrcaDisplayForegroundModeOptions = {
  inlineMode: OrcaForegroundMode;
  fullscreenMode: OrcaForegroundMode;
  isDetached: boolean;
};

const ORCA_DARK_COLORS: OrcaColors = {
  background: '#000000',
  f_high: '#ffffff',
  f_med: '#777777',
  f_low: '#444444',
  f_hint: '#444444',
  f_on_bg: '#444444',
  f_inv: '#000000',
  b_high: '#eeeeee',
  b_med: '#72dec2',
  b_low: '#444444',
  b_inv: '#ffb545',
  cursor: '#ffb545'
};

const ORCA_LIGHT_COLORS: OrcaColors = {
  ...ORCA_DARK_COLORS,
  f_med: '#d4d4d8',
  f_low: '#a1a1aa',
  f_hint: '#ffffff',
  f_on_bg: '#444444',
  b_high: '#ffffff',
  b_low: '#d4d4d8'
};

export function getOrcaDisplayFontSize({
  inlineFontSize,
  fullscreenFontSize,
  isDetached
}: OrcaDisplayFontSizeOptions): number {
  return isDetached ? fullscreenFontSize : inlineFontSize;
}

export function getOrcaDisplayForegroundMode({
  inlineMode,
  fullscreenMode,
  isDetached
}: OrcaDisplayForegroundModeOptions): OrcaForegroundMode {
  return isDetached ? fullscreenMode : inlineMode;
}

export function getOrcaColors(mode: OrcaForegroundMode): OrcaColors {
  return mode === 'light' ? ORCA_LIGHT_COLORS : ORCA_DARK_COLORS;
}

export function getOrcaPortForeground(colors: OrcaColors, portType: number): string {
  if (portType === 1) return colors.b_med;
  if (portType === 2) return colors.b_high;

  return colors.f_hint;
}

export function getOrcaFullscreenOverlayBackground(transparency: number): string {
  return `rgba(0, 0, 0, ${transparency})`;
}
