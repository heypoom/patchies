import { describe, expect, test } from 'vitest';

import { BUILT_IN_PACKS } from './object-packs';
import { isPresetPackAvailableForObjects } from './preset-pack-availability';
import { buildBuiltInPresetPackFolders } from './preset-pack-index';
import { BUILT_IN_PRESET_PACKS, OBJECT_PIPE_PRESETS } from './preset-packs';
import { BUILTIN_PRESETS } from '$lib/presets/builtin';
import { isPreset } from '$lib/presets/preset-utils';

function getSamplerUniformNames(code: string): string[] {
  return Array.from(code.matchAll(/uniform\s+sampler2D\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/g)).map(
    (match) => match[1]
  );
}

describe('built-in preset packs', () => {
  test('keeps object companion presets in the locked starter pack', () => {
    const starterPack = BUILT_IN_PRESET_PACKS.find((pack) => pack.id === 'starters');

    expect(starterPack?.presets).toEqual(expect.arrayContaining(OBJECT_PIPE_PRESETS));
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
    const assignments = OBJECT_PIPE_PRESETS.map((presetName) => ({
      presetName,
      packIds: BUILT_IN_PRESET_PACKS.filter((pack) => pack.presets.includes(presetName)).map(
        (pack) => pack.id
      )
    }));

    expect(assignments).toEqual(
      OBJECT_PIPE_PRESETS.map((presetName) => ({ presetName, packIds: ['starters'] }))
    );
  });

  test('does not include empty preset packs', () => {
    const emptyPackIds = BUILT_IN_PRESET_PACKS.filter((pack) => pack.presets.length === 0).map(
      (pack) => pack.id
    );

    expect(emptyPackIds).toEqual([]);
  });

  test('assigns every built-in preset to exactly one preset pack', () => {
    const assignmentCounts = new Map<string, number>();

    for (const pack of BUILT_IN_PRESET_PACKS) {
      for (const presetName of pack.presets) {
        assignmentCounts.set(presetName, (assignmentCounts.get(presetName) ?? 0) + 1);
      }
    }

    const unassignedPresetNames = Object.keys(BUILTIN_PRESETS).filter(
      (presetName) => !assignmentCounts.has(presetName)
    );
    const duplicatePresetNames = Array.from(assignmentCounts.entries())
      .filter(([, count]) => count !== 1)
      .map(([presetName]) => presetName);
    const missingPresetNames = Array.from(assignmentCounts.keys()).filter(
      (presetName) => !(presetName in BUILTIN_PRESETS)
    );

    expect(unassignedPresetNames).toEqual([]);
    expect(duplicatePresetNames).toEqual([]);
    expect(missingPresetNames).toEqual([]);
  });

  test('groups built-in preset folders by preset pack name', () => {
    const folders = buildBuiltInPresetPackFolders(BUILTIN_PRESETS);
    const textureGenerators = folders['Texture Generators'];

    expect(textureGenerators).toBeDefined();
    if (!textureGenerators || isPreset(textureGenerators)) {
      throw new Error('Expected Texture Generators to be a preset folder');
    }

    expect(isPreset(textureGenerators['Circle'])).toBe(true);
    expect(isPreset(textureGenerators['Radial Ramp'])).toBe(true);
    expect(folders.glsl).toBeUndefined();
  });

  test('registers Chromatic Aberration as a GLSL texture filter preset', () => {
    const preset = BUILTIN_PRESETS['Chromatic Aberration'];
    const textureFilters = BUILT_IN_PRESET_PACKS.find((pack) => pack.id === 'texture-filters');
    const presetData = preset?.data as { code?: string } | undefined;

    expect(preset?.type).toBe('glsl');
    expect(presetData?.code).toContain('@title Chromatic Aberration');
    expect(textureFilters?.presets).toContain('Chromatic Aberration');
  });

  test('keeps Over and Under inlet order consistent', () => {
    const overData = BUILTIN_PRESETS.Over?.data as { code?: string } | undefined;
    const underData = BUILTIN_PRESETS.Under?.data as { code?: string } | undefined;

    expect(getSamplerUniformNames(overData?.code ?? '')).toEqual(['background', 'foreground']);
    expect(getSamplerUniformNames(underData?.code ?? '')).toEqual(['background', 'foreground']);
  });
});
