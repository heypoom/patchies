import { describe, expect, test } from 'vitest';

import {
  DEFAULT_OBJECT_SUGGESTION_LIMIT,
  buildObjectPresetSearchIndex
} from '$lib/search/object-preset-search';
import type { FlattenedPreset, Preset } from '$lib/presets/types';

function createFlatPreset({
  name,
  type = 'glsl',
  libraryId = 'user',
  libraryName = 'User'
}: {
  name: string;
  type?: string;
  libraryId?: string;
  libraryName?: string;
}): FlattenedPreset {
  const preset: Preset = {
    name,
    type,
    description: `${name} description`,
    data: {}
  };

  return {
    path: [libraryId, name],
    preset,
    libraryId,
    libraryName
  };
}

describe('object preset search index', () => {
  test('caps default and fuzzy object suggestions at 100 results', () => {
    const presets = Array.from({ length: DEFAULT_OBJECT_SUGGESTION_LIMIT + 30 }, (_, index) =>
      createFlatPreset({ name: `target-${index.toString().padStart(3, '0')}` })
    );
    const index = buildObjectPresetSearchIndex({
      presets,
      objectNames: ['glsl'],
      shorthands: [],
      enabledObjectNames: new Set(['glsl']),
      enabledPresetNames: new Set(),
      patchObjectTypeNames: new Set(),
      aiFeaturesVisible: true
    });

    expect(index.getDefaultObjectSuggestions()).toHaveLength(DEFAULT_OBJECT_SUGGESTION_LIMIT);
    expect(index.searchObjectSuggestions('target')).toHaveLength(DEFAULT_OBJECT_SUGGESTION_LIMIT);
  });

  test('keeps built-in preset visibility tied to enabled preset packs', () => {
    const builtinPreset = createFlatPreset({
      name: 'Built In Texture',
      libraryId: 'built-in',
      libraryName: 'Built-in'
    });
    const hiddenIndex = buildObjectPresetSearchIndex({
      presets: [builtinPreset],
      objectNames: ['glsl'],
      shorthands: [],
      enabledObjectNames: new Set(['glsl']),
      enabledPresetNames: new Set(),
      patchObjectTypeNames: new Set(),
      aiFeaturesVisible: true
    });
    const visibleIndex = buildObjectPresetSearchIndex({
      presets: [builtinPreset],
      objectNames: ['glsl'],
      shorthands: [],
      enabledObjectNames: new Set(['glsl']),
      enabledPresetNames: new Set(['Built In Texture']),
      patchObjectTypeNames: new Set(),
      aiFeaturesVisible: true
    });

    expect(hiddenIndex.searchObjectSuggestions('Built In Texture')).toEqual([]);
    expect(visibleIndex.searchObjectSuggestions('Built In Texture')).toMatchObject([
      { name: 'Built In Texture', type: 'preset' }
    ]);
  });

  test('keeps user presets visible and lets later duplicate names win lookup', () => {
    const builtinPreset = createFlatPreset({
      name: 'Duplicate Texture',
      libraryId: 'built-in',
      libraryName: 'Built-in'
    });
    const userPreset = createFlatPreset({
      name: 'Duplicate Texture',
      libraryId: 'user',
      libraryName: 'User'
    });
    const index = buildObjectPresetSearchIndex({
      presets: [builtinPreset, userPreset],
      objectNames: ['glsl'],
      shorthands: [],
      enabledObjectNames: new Set(['glsl']),
      enabledPresetNames: new Set(),
      patchObjectTypeNames: new Set(),
      aiFeaturesVisible: true
    });

    expect(index.getPresetByName('Duplicate Texture')).toBe(userPreset);
    expect(index.searchObjectSuggestions('Duplicate Texture')).toMatchObject([
      { name: 'Duplicate Texture', type: 'preset', libraryName: 'User' }
    ]);
  });
});
