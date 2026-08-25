import { describe, expect, it } from 'vitest';

import { getCappedPreviewSize, getUncappedPreviewSize } from './use-capped-preview-size.svelte';

describe('canvas preview size', () => {
  const outputSize = { width: 1280, height: 720 };

  it('caps fixed-size previews', () => {
    expect(getCappedPreviewSize(outputSize)).toEqual([252, 141]);
  });

  it('preserves the uncapped size for fluid previews', () => {
    expect(getUncappedPreviewSize(outputSize)).toEqual([320, 180]);
  });
});
