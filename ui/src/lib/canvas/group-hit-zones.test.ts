import { describe, expect, test } from 'vitest';

import {
  DEFAULT_GROUP_COLOR,
  GROUP_COLOR_PRESETS,
  GROUP_BORDER_HIT_ZONES,
  getGroupColorPreset,
  getGroupTitleClasses,
  getGroupVisualFrameStyle,
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

  test('exposes predefined group colors with a default selected color', () => {
    expect(GROUP_COLOR_PRESETS.some((preset) => preset.value === DEFAULT_GROUP_COLOR)).toBe(true);
    expect(getGroupColorPreset(undefined).value).toBe(DEFAULT_GROUP_COLOR);
    expect(getGroupColorPreset(undefined).name).toBe('Gray');
    expect(GROUP_COLOR_PRESETS[0].name).toBe('Gray');
  });

  test('derives frame style from group color', () => {
    const style = getGroupVisualFrameStyle('#f43f5e', false);

    expect(style).toContain('border-color: rgba(244, 63, 94, 0.55);');
    expect(style).toContain('background-color: rgba(244, 63, 94, 0.08);');
  });
});
