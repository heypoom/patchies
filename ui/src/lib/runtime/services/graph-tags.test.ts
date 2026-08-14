import { describe, expect, it } from 'vitest';

import { getUserTags, replaceUserTags } from './graph-tags';

describe('getUserTags', () => {
  it('removes reserved and empty tags before persistence', () => {
    expect(getUserTags(['shader/foo/function', 'core/video', '', '  ', 42] as unknown[])).toEqual([
      'shader/foo/function'
    ]);
  });

  it('replaces user tags without removing existing core tags', () => {
    expect(
      replaceUserTags(['core/video', 'shader/foo/old'], ['shader/foo/new', 'core/audio'])
    ).toEqual(['core/video', 'shader/foo/new']);
  });
});
