import { describe, expect, it } from 'vitest';
import { parsePreviewBackgroundColor } from '$lib/rendering/preview-background';

describe('preview background color', () => {
  it('accepts transparent and six-digit hex colors', () => {
    expect(parsePreviewBackgroundColor('transparent')).toBe('transparent');
    expect(parsePreviewBackgroundColor('#0a0b0c')).toBe('#0a0b0c');
  });

  it('falls back to transparent for invalid stored values', () => {
    expect(parsePreviewBackgroundColor('nope')).toBe('transparent');
  });
});
