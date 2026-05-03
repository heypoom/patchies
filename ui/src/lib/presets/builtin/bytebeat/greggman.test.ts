import { describe, expect, test } from 'vitest';

import { getPresetPackPresetNames } from '$lib/extensions/preset-pack-index';
import { BUILT_IN_PRESET_PACKS } from '$lib/extensions/preset-packs';

import { GREGGMAN_BYTEBEAT_PRESET_KEYS, GREGGMAN_BYTEBEAT_PRESETS } from './greggman';

describe('Greggman HTML5 bytebeat archive presets', () => {
  test('exposes every song from the Greggman songs list as a bytebeat preset', () => {
    expect(GREGGMAN_BYTEBEAT_PRESET_KEYS).toHaveLength(504);
    expect(Object.keys(GREGGMAN_BYTEBEAT_PRESETS)).toHaveLength(504);

    const preset = GREGGMAN_BYTEBEAT_PRESETS['a-new-industrial-chiptune-by-ryg.greggman.beat'];

    expect(preset).toMatchObject({
      type: 'bytebeat~',
      description: 'a new industrial chiptune by ryg by greggman'
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

  test('registers the archive in size-based preset pack subfolders', () => {
    const pack = BUILT_IN_PRESET_PACKS.find((candidate) => candidate.id === 'greggman-bytebeat');

    expect(pack?.presets).toEqual([]);
    expect(pack?.presetFolders).toMatchObject({
      'Tiny (<80 chars)': expect.any(Array),
      'Small (80-199 chars)': expect.any(Array),
      'Medium (200-999 chars)': expect.any(Array),
      'Long (1000+ chars)': expect.any(Array)
    });
    expect(pack && getPresetPackPresetNames(pack)).toEqual(GREGGMAN_BYTEBEAT_PRESET_KEYS);
  });
});
