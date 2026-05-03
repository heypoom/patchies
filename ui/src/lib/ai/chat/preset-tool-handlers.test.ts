import { describe, expect, test } from 'vitest';

import {
  getPresetContent,
  resolveInsertPreset,
  searchAvailablePresets,
  type AvailablePreset
} from './preset-tool-handlers';

const presets: AvailablePreset[] = [
  {
    path: ['built-in', 'Texture Generators', 'Noise'],
    libraryId: 'built-in',
    libraryName: 'Built-in',
    preset: {
      name: 'Noise',
      description: 'A procedural texture source',
      type: 'glsl',
      data: { code: 'noise();' }
    },
    pack: {
      id: 'texture-generators',
      name: 'Texture Generators'
    }
  },
  {
    path: ['user', 'Noise'],
    libraryId: 'user',
    libraryName: 'User',
    preset: {
      name: 'Noise',
      description: 'My custom noise',
      type: 'p5',
      data: { code: 'drawNoise();' }
    }
  },
  {
    path: ['built-in', 'Texture Filters', 'Blur'],
    libraryId: 'built-in',
    libraryName: 'Built-in',
    preset: {
      name: 'Blur',
      description: 'Blur incoming texture',
      type: 'glsl',
      data: { code: 'blur();' }
    },
    pack: {
      id: 'texture-filters',
      name: 'Texture Filters'
    }
  }
];

describe('chat preset tools', () => {
  test('searches presets by preset pack name', () => {
    expect(searchAvailablePresets({ query: 'texture filters' }, presets)).toMatchObject({
      total: 1,
      results: [{ name: 'Blur', pack: { id: 'texture-filters', name: 'Texture Filters' } }]
    });
  });

  test('limits preset search results to 10 by default and accepts limit', () => {
    const manyPresets = Array.from({ length: 12 }, (_, index) => ({
      path: ['built-in', 'Texture Generators', `Noise ${index}`],
      libraryId: 'built-in',
      libraryName: 'Built-in',
      preset: {
        name: `Noise ${index}`,
        type: 'glsl',
        data: {}
      },
      pack: {
        id: 'texture-generators',
        name: 'Texture Generators'
      }
    }));

    expect(searchAvailablePresets({ query: 'noise' }, manyPresets).results).toHaveLength(10);
    expect(searchAvailablePresets({ query: 'noise', limit: 3 }, manyPresets).results).toHaveLength(
      3
    );
  });

  test('gets preset content by exact name and prefers user libraries over built-in duplicates', () => {
    expect(getPresetContent({ presetName: 'Noise' }, presets)).toMatchObject({
      name: 'Noise',
      type: 'p5',
      data: { code: 'drawNoise();' },
      libraryName: 'User'
    });
  });

  test('inserts an exact preset name and prefers user libraries over built-in duplicates', () => {
    const action = resolveInsertPreset({ presetName: 'Noise' }, { presets });

    expect(action.result).toEqual({
      kind: 'single',
      type: 'p5',
      data: { code: 'drawNoise();' }
    });
  });
});
