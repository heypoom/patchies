import { describe, expect, it } from 'vitest';

import { getFloatTextureValidationErrorMessage } from './validation-error';

describe('getFloatTextureValidationErrorMessage', () => {
  it('uses Error messages directly', () => {
    expect(getFloatTextureValidationErrorMessage(new Error('Expected RGB data length 6'))).toBe(
      'Expected RGB data length 6'
    );
  });

  it('uses string errors directly', () => {
    expect(getFloatTextureValidationErrorMessage('Bad texture data')).toBe('Bad texture data');
  });

  it('falls back for unknown thrown values', () => {
    expect(getFloatTextureValidationErrorMessage({ nope: true })).toBe(
      'Failed to pack float texture data'
    );
  });
});
