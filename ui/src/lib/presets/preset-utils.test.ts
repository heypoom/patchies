import { describe, expect, it } from 'vitest';
import {
  createPresetSearchRecords,
  searchPresetRecords,
  type PresetSearchRecord
} from './preset-utils';
import type { FlattenedPreset, PresetLibrary } from './types';

const builtInLibrary: PresetLibrary = {
  id: 'built-in',
  name: 'Built-in',
  readonly: true,
  presets: {}
};

const userLibrary: PresetLibrary = {
  id: 'user',
  name: 'User Library',
  readonly: false,
  presets: {}
};

function flatPreset(
  library: PresetLibrary,
  name: string,
  path: string[],
  description = ''
): FlattenedPreset {
  return {
    libraryId: library.id,
    libraryName: library.name,
    path: [library.id, ...path, name],
    preset: {
      name,
      description,
      type: 'glsl',
      data: {}
    }
  };
}

describe('preset search records', () => {
  it('precomputes searchable fields from flattened presets', () => {
    const [record] = createPresetSearchRecords(
      [flatPreset(builtInLibrary, 'Golden Kaleid', ['Hydra Demos'], 'Warm feedback pattern')],
      [builtInLibrary]
    );

    expect(record).toMatchObject({
      name: 'Golden Kaleid',
      nameLower: 'golden kaleid',
      descriptionLower: 'warm feedback pattern',
      libraryId: 'built-in',
      libraryName: 'Built-in',
      readonly: true,
      location: 'Hydra Demos',
      locationLower: 'hydra demos'
    } satisfies Partial<PresetSearchRecord>);
  });

  it('searches precomputed records with a result limit and user libraries first', () => {
    const records = createPresetSearchRecords(
      [
        flatPreset(builtInLibrary, 'Golden Kaleid', ['Hydra Demos']),
        flatPreset(userLibrary, 'User Kaleid', ['Visuals']),
        flatPreset(builtInLibrary, 'Kaleid Feedback', ['Hydra Demos'])
      ],
      [builtInLibrary, userLibrary]
    );

    const results = searchPresetRecords(records, 'kaleid', { limit: 2 });

    expect(results.map((result) => result.name)).toEqual(['User Kaleid', 'Golden Kaleid']);
  });
});
