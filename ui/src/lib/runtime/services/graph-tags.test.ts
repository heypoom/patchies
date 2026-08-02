import { describe, expect, it } from 'vitest';

import { getUserTags } from './graph-tags';

describe('getUserTags', () => {
  it('removes reserved and empty tags before persistence', () => {
    expect(getUserTags(['shader/foo/function', 'core/video', '', '  ', 42] as unknown[])).toEqual([
      'shader/foo/function'
    ]);
  });
});
