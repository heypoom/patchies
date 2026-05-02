export type PreviewBackgroundColor = 'transparent' | `#${string}`;

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function parsePreviewBackgroundColor(value: unknown): PreviewBackgroundColor {
  if (value === 'transparent') return 'transparent';
  if (typeof value === 'string' && HEX_COLOR_PATTERN.test(value)) {
    return value as PreviewBackgroundColor;
  }

  return 'transparent';
}
