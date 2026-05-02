import { describe, expect, test } from 'vitest';

import { BUILT_IN_PACKS } from './object-packs';
import { isPresetPackAvailableForObjects } from './preset-pack-availability';
import { BUILT_IN_PRESET_PACKS } from './preset-packs';

const companionPresetNames = ['glsl>', 'hydra>', 'regl>', 'swgl>', 'three>'];

describe('built-in preset packs', () => {
  test('keeps object companion presets in the locked starter pack', () => {
    const starterPack = BUILT_IN_PRESET_PACKS.find((pack) => pack.id === 'starters');

    expect(starterPack?.presets).toEqual(expect.arrayContaining(companionPresetNames));
  });

  test('does not require objects for the starter preset pack', () => {
    const starterPack = BUILT_IN_PRESET_PACKS.find((pack) => pack.id === 'starters');

    expect(starterPack?.requiredObjects).toEqual([]);
  });

  test('treats preset packs without required objects as enabled', () => {
    const isAvailable = isPresetPackAvailableForObjects([], new Set());

    expect(isAvailable).toBe(true);
  });

  test('does not list preset names as required objects', () => {
    const knownObjects = new Set(BUILT_IN_PACKS.flatMap((pack) => pack.objects));
    const unknownRequiredObjects = BUILT_IN_PRESET_PACKS.flatMap((pack) =>
      pack.requiredObjects
        .filter((objectName) => !knownObjects.has(objectName))
        .map((objectName) => ({ packId: pack.id, objectName }))
    );

    expect(unknownRequiredObjects).toEqual([]);
  });

  test('assigns each companion preset to exactly one pack', () => {
    const assignments = companionPresetNames.map((presetName) => ({
      presetName,
      packIds: BUILT_IN_PRESET_PACKS.filter((pack) => pack.presets.includes(presetName)).map(
        (pack) => pack.id
      )
    }));

    expect(assignments).toEqual(
      companionPresetNames.map((presetName) => ({ presetName, packIds: ['starters'] }))
    );
  });

  test('does not include empty preset packs', () => {
    const emptyPackIds = BUILT_IN_PRESET_PACKS.filter((pack) => pack.presets.length === 0).map(
      (pack) => pack.id
    );

    expect(emptyPackIds).toEqual([]);
  });
});
