export const DEFAULT_ORCA_FULLSCREEN_FONT_SIZE = 2.7;

type OrcaDisplayFontSizeOptions = {
  inlineFontSize: number;
  fullscreenFontSize: number;
  isDetached: boolean;
};

export function getOrcaDisplayFontSize({
  inlineFontSize,
  fullscreenFontSize,
  isDetached
}: OrcaDisplayFontSizeOptions): number {
  return isDetached ? fullscreenFontSize : inlineFontSize;
}
