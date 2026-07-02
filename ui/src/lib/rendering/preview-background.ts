export type PreviewBackgroundColor = 'transparent' | `#${string}`;

export const DEFAULT_PREVIEW_BACKGROUND_COLOR = '#000000';

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function parsePreviewBackgroundColor(value: unknown): PreviewBackgroundColor {
  if (value === 'transparent') return 'transparent';
  if (typeof value === 'string' && HEX_COLOR_PATTERN.test(value)) {
    return value as PreviewBackgroundColor;
  }

  return DEFAULT_PREVIEW_BACKGROUND_COLOR;
}
