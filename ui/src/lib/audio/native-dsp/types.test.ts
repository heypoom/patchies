import { describe, expect, test } from 'vitest';

import { extractAudioParamDescriptors } from './types';

describe('extractAudioParamDescriptors', () => {
  test('uses finite float32 bounds when an inlet has no numeric range', () => {
    const [descriptor] = extractAudioParamDescriptors([
      { name: 'limit', type: 'float', isAudioParam: true, defaultValue: 1 }
    ]);

    expect(Number.isFinite(descriptor.minValue)).toBe(true);
    expect(Number.isFinite(descriptor.maxValue)).toBe(true);
    expect(Number.isFinite(new Float32Array([descriptor.minValue!])[0])).toBe(true);
    expect(Number.isFinite(new Float32Array([descriptor.maxValue!])[0])).toBe(true);
  });
});
