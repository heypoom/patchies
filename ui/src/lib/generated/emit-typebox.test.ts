import { Type } from '@sinclair/typebox';
import { describe, expect, it } from 'vitest';

import { emitTypeBox } from '../../../scripts/emit-typebox';

describe('emitTypeBox', () => {
  it('preserves array length constraints', () => {
    expect(emitTypeBox(Type.Array(Type.Number(), { minItems: 4, maxItems: 8 }))).toBe(
      'Type.Array(Type.Number(), { minItems: 4, maxItems: 8 })'
    );
  });
});
