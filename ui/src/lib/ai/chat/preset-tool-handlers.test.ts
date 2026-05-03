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
  },
  {
    path: ['built-in', 'Texture Filters', 'Edge Detect'],
    libraryId: 'built-in',
    libraryName: 'Built-in',
    preset: {
      name: 'Edge Detect',
      description: 'Finds strong texture edges',
      type: 'glsl',
      data: { code: 'edgeDetect();' }
    },
    pack: {
      id: 'texture-filters',
      name: 'Texture Filters'
    }
  },
  {
    path: ['built-in', 'Texture Filters', 'Hue Saturation'],
    libraryId: 'built-in',
    libraryName: 'Built-in',
    preset: {
      name: 'Hue Saturation',
      description: 'Adjust color intensity',
      type: 'glsl',
      data: { code: 'hueSaturation();' }
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
      total: 3,
      results: [
        { name: 'Blur', pack: { id: 'texture-filters', name: 'Texture Filters' } },
        { name: 'Edge Detect', pack: { id: 'texture-filters', name: 'Texture Filters' } },
        { name: 'Hue Saturation', pack: { id: 'texture-filters', name: 'Texture Filters' } }
      ]
    });
  });

  test('searches comma-separated preset candidates', () => {
    const result = searchAvailablePresets({ query: 'Noise, Edge Detect', limit: 10 }, presets);

    expect(result.total).toBe(3);
    expect(result.results.map((preset) => preset.name)).toEqual(
      expect.arrayContaining(['Noise', 'Edge Detect'])
    );
  });

  test('searches bundled space-separated preset candidates', () => {
    const result = searchAvailablePresets(
      { query: 'Noise Mirror Edge Detect Hue Saturation Feedback', limit: 10 },
      presets
    );

    expect(result.results.map((preset) => preset.name)).toEqual(
      expect.arrayContaining(['Noise', 'Edge Detect', 'Hue Saturation'])
    );
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

  test('does not add a position when insert_preset omits it', () => {
    const action = resolveInsertPreset({ presetName: 'Blur' }, { presets });

    expect(action.result).toEqual({
      kind: 'single',
      type: 'glsl',
      data: { code: 'blur();' }
    });
  });

  test('preserves optional position for insert_preset', () => {
    const action = resolveInsertPreset(
      { presetName: 'Blur', position: { x: 320, y: 160 } },
      { presets }
    );

    expect(action.result).toEqual({
      kind: 'single',
      type: 'glsl',
      data: { code: 'blur();' },
      position: { x: 320, y: 160 }
    });
  });
});
