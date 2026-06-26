import { describe, expect, test } from 'vitest';

import {
  DEFAULT_GROUP_COLOR,
  GROUP_COLOR_PRESETS,
  GROUP_BORDER_HIT_ZONES,
  getGroupColorPreset,
  getGroupColorGridClasses,
  getGroupFrameStyle,
  getGroupSettingsPanelClasses,
  getGroupTitle,
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

  test('uses a custom group title with a default fallback', () => {
    expect(getGroupTitle(undefined)).toBe('group');
    expect(getGroupTitle('')).toBe('group');
    expect(getGroupTitle('  visuals  ')).toBe('visuals');
  });

  test('exposes predefined group colors with a default selected color', () => {
    expect(GROUP_COLOR_PRESETS).toHaveLength(10);
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

  test('uses explicit pixel dimensions for the group frame', () => {
    expect(getGroupFrameStyle(420, 260)).toBe('width: 420px; height: 260px;');
  });

  test('anchors the settings panel outside the group frame', () => {
    const classes = getGroupSettingsPanelClasses();

    expect(classes).toContain('left-[calc(100%+0.5rem)]');
    expect(classes).not.toContain('right-0');
  });

  test('lays out group colors as two rows of five swatches', () => {
    expect(getGroupColorGridClasses()).toContain('grid-cols-5');
  });
});
