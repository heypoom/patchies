import { describe, expect, test } from 'vitest';

import {
  GROUP_BORDER_HIT_ZONES,
  getGroupTitleClasses,
  getGroupVisualFrameClasses
} from './group-hit-zones';

describe('group hit zones', () => {
  test('keeps the visual frame transparent to pointer events', () => {
    expect(getGroupVisualFrameClasses(false).join(' ')).toContain('pointer-events-none');
  });

  test('keeps title and border strips available for selecting and dragging the group', () => {
    expect(getGroupTitleClasses()).toContain('pointer-events-auto');
    expect(GROUP_BORDER_HIT_ZONES).toHaveLength(4);
    expect(
      GROUP_BORDER_HIT_ZONES.every((zone) => zone.className.includes('pointer-events-auto'))
    ).toBe(true);
  });
});
