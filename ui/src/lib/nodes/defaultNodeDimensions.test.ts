import { describe, expect, test } from 'vitest';

import {
  DEFAULT_GROUP_HEIGHT,
  DEFAULT_GROUP_WIDTH,
  getDefaultNodeDimensions
} from './defaultNodeDimensions';

describe('getDefaultNodeDimensions', () => {
  test('creates group nodes with explicit top-level dimensions', () => {
    expect(getDefaultNodeDimensions('group')).toEqual({
      width: DEFAULT_GROUP_WIDTH,
      height: DEFAULT_GROUP_HEIGHT
    });
  });

  test('leaves regular node dimensions implicit', () => {
    expect(getDefaultNodeDimensions('js')).toEqual({});
  });
});
