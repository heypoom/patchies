import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/objects/object-definitions', () => ({
  getObjectAliases: () => []
}));

import {
  BUILT_IN_PACK_COLLECTIONS,
  BUILT_IN_PRESET_PACKS,
  BULK_ENABLE_PACK_IDS,
  disableAllPacks,
  disableAllPresetPacks,
  enabledPackIds,
  enabledPresetPackIds,
  enableAllPresetPacks,
  enableAllExtensionPacks,
  enabledPrimaryObjects,
  packLibraryPreferences,
  deselectCollection,
  selectCollection,
  togglePack,
  togglePresetPack
} from './extensions.store';

const defaultPreferences = {
  selectedCollectionIds: [],
  objectPackOverrides: {},
  presetPackOverrides: {},
  hasCompletedCollectionOnboarding: false
};

describe('extensions store', () => {
  afterEach(() => packLibraryPreferences.set(defaultPreferences));

  it('leaves the Greggman bytebeat archive disabled when enabling all preset packs', () => {
    disableAllPresetPacks();

    enableAllPresetPacks();

    expect(get(enabledPresetPackIds)).toEqual(
      BUILT_IN_PRESET_PACKS.filter((pack) => pack.id !== 'greggman-bytebeat').map((pack) => pack.id)
    );
  });

  it('leaves experimental objects and heavyweight presets disabled for workshop setup', () => {
    disableAllPacks();
    disableAllPresetPacks();

    enableAllExtensionPacks();

    expect(get(enabledPackIds)).toEqual(BULK_ENABLE_PACK_IDS);
    expect(get(enabledPackIds)).not.toContain('experimental');
    expect(get(enabledPresetPackIds)).toEqual(
      BUILT_IN_PRESET_PACKS.filter((pack) => pack.id !== 'greggman-bytebeat').map((pack) => pack.id)
    );
  });

  it('enables only the required supporting objects with a selected collection', () => {
    selectCollection('sound-design');

    expect(get(enabledPackIds)).toEqual(
      expect.arrayContaining(['audio-routing', 'signal-processors'])
    );
    expect(get(enabledPrimaryObjects).has('p5')).toBe(true);
    expect(get(enabledPrimaryObjects).has('mic~')).toBe(true);
    expect(get(enabledPrimaryObjects).has('soundfile~')).toBe(true);
    expect(get(enabledPrimaryObjects).has('gain~')).toBe(true);
    expect(get(enabledPrimaryObjects).has('out~')).toBe(true);
    expect(get(enabledPrimaryObjects).has('canvas.dom')).toBe(true);
    expect(get(enabledPrimaryObjects).has('hydra')).toBe(true);
    expect(get(enabledPrimaryObjects).has('glsl')).toBe(true);
    expect(get(enabledPresetPackIds)).toContain('fft-demos');
    expect(get(enabledPresetPackIds)).not.toContain('greggman-bytebeat');
  });

  it('keeps a collection partial after an individual pack is disabled', () => {
    selectCollection('visuals');
    togglePack('2d');

    expect(get(enabledPackIds)).not.toContain('2d');
    expect(get(enabledPackIds)).toContain('video-synthesis');
  });

  it('keeps optional preset packs disabled until enabled individually', () => {
    selectCollection('sound-design');

    expect(get(enabledPresetPackIds)).not.toContain('greggman-bytebeat');

    togglePresetPack('greggman-bytebeat');

    expect(get(enabledPresetPackIds)).toContain('greggman-bytebeat');
  });

  it('disables a collection’s manually enabled packs when deselected', () => {
    const collection = BUILT_IN_PACK_COLLECTIONS.find(({ id }) => id === 'visuals')!;

    packLibraryPreferences.set({
      ...defaultPreferences,
      selectedCollectionIds: ['visuals'],
      objectPackOverrides: Object.fromEntries(
        collection.primaryObjectPackIds.map((packId) => [packId, true])
      ),
      presetPackOverrides: Object.fromEntries(
        collection.primaryPresetPackIds.map((packId) => [packId, true])
      )
    });

    deselectCollection('visuals');

    for (const packId of collection.primaryObjectPackIds) {
      expect(get(enabledPackIds)).not.toContain(packId);
    }

    for (const packId of collection.primaryPresetPackIds) {
      expect(get(enabledPresetPackIds)).not.toContain(packId);
    }
  });

  it('keeps peer-owned packs off while enabling only Sound Design requirements', () => {
    selectCollection('visuals');
    selectCollection('sound-design');
    deselectCollection('visuals');

    expect(get(enabledPackIds)).not.toContain('2d');
    expect(get(enabledPackIds)).not.toContain('video-synthesis');
    expect(get(enabledPrimaryObjects).has('p5')).toBe(true);
    expect(get(enabledPrimaryObjects).has('canvas.dom')).toBe(true);
    expect(get(enabledPrimaryObjects).has('hydra')).toBe(true);
    expect(get(enabledPrimaryObjects).has('glsl')).toBe(true);
  });
});
