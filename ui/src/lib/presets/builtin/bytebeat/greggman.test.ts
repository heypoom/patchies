import { describe, expect, test } from 'vitest';

import { getPresetPackPresetNames } from '$lib/extensions/preset-pack-index';
import { BUILT_IN_PRESET_PACKS } from '$lib/extensions/preset-packs';

import { GREGGMAN_BYTEBEAT_PRESET_KEYS, GREGGMAN_BYTEBEAT_PRESETS } from './greggman';

describe('Greggman HTML5 bytebeat archive presets', () => {
  test('exposes every song from the Greggman songs list as a bytebeat preset', () => {
    expect(GREGGMAN_BYTEBEAT_PRESET_KEYS).toHaveLength(504);
    expect(Object.keys(GREGGMAN_BYTEBEAT_PRESETS)).toHaveLength(504);

    const preset = GREGGMAN_BYTEBEAT_PRESETS['a-new-industrial-chiptune-by-ryg.beat'];

    expect(preset).toMatchObject({
      type: 'bytebeat~',
      description: 'a new industrial chiptune by ryg'
    });
    expect(preset.data).toMatchObject({
      type: 'bytebeat',
      syntax: 'infix',
      sampleRate: 11000
    });
    expect(preset.data.expr).toContain('// source: greggman.com');
    expect(preset.data.expr).toContain('// a new industrial chiptune');
    expect(preset.data.expr).toContain('// by ryg');
    expect(preset.data.expr).toContain('t*(1+');
  });

  test('keeps generated preset names short enough for browser UI', () => {
    const presetNames = Object.keys(GREGGMAN_BYTEBEAT_PRESETS);
    const longPresetNames = presetNames.filter((presetName) => presetName.length > 80);

    expect(longPresetNames).toEqual([]);
    expect(presetNames).toContain('boss-level-by-sthephanshi.beat');
    expect(presetNames).not.toContain(
      'game-levels-series-of-formulas-discovered-by-experimenting-with-running-man-t-3-1-5-t-10-5-3-t-14-3-t-8-allows-to-get-different-interesting-chiptune-sounds-boss-level-slow-down-t-2-rhythm-to-t-3-sounds-dangerous-by-sthephanshi.beat'
    );
  });

  test('registers the archive in size-based preset pack subfolders', () => {
    const pack = BUILT_IN_PRESET_PACKS.find((candidate) => candidate.id === 'greggman-bytebeat');

    expect(pack?.presets).toEqual([]);
    expect(Object.keys(pack?.presetFolders ?? {})).toEqual([
      'Tiny (<80 chars)',
      'Small (80-199 chars)',
      'Medium (200-999 chars)',
      'Long (1000+ chars)'
    ]);
    expect(Object.values(pack?.presetFolders ?? {}).every(Array.isArray)).toBe(true);
    expect(pack && getPresetPackPresetNames(pack)).toEqual(GREGGMAN_BYTEBEAT_PRESET_KEYS);
  });
});
