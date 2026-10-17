import { describe, expect, test } from 'vitest';
import { get } from 'svelte/store';
import {
  flattenedPresets,
  loadEnabledPresetPacks,
  presetLibraryStore
} from './preset-library.store';

describe('optional built-in preset publication', () => {
  test('adds archive presets on demand while preserving user presets', async () => {
    const libraryId = presetLibraryStore.addLibrary('My presets');
    presetLibraryStore.addPreset(libraryId, [], {
      name: 'My logger',
      type: 'js',
      data: { code: 'console.log(123)' }
    });

    expect(
      get(flattenedPresets).find((entry) => entry.preset.type === 'bytebeat~')
    ).toBeUndefined();

    await loadEnabledPresetPacks(['greggman-bytebeat']);

    const entries = get(flattenedPresets);
    const archive = entries.find(
      (entry) => entry.preset.name === 'a-new-industrial-chiptune-by-ryg.beat'
    );

    expect(archive?.preset).toMatchObject({
      type: 'bytebeat~',
      data: { syntax: 'infix', sampleRate: 11000 }
    });

    expect(entries.find((entry) => entry.libraryId === libraryId)?.preset).toEqual({
      name: 'My logger',
      type: 'js',
      data: { code: 'console.log(123)' }
    });
  });
});
