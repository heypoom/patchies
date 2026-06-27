import { describe, expect, test } from 'vitest';

import { getDefaultNodeData } from './defaultNodeData';

describe('getDefaultNodeData', () => {
  test('keeps group color optional by default', () => {
    expect(getDefaultNodeData('group')).toEqual({});
  });
});
