import { describe, expect, it } from 'vitest';
import { BUILT_IN_PACKS } from './object-packs';
import { BUILT_IN_PACK_COLLECTIONS, getCollectionObjectPackIds } from './pack-collections';
import { BUILT_IN_PRESET_PACKS } from '$lib/presets/preset-packs';

describe('pack collections', () => {
  it('gives every built-in pack one collection home', () => {
    for (const pack of BUILT_IN_PACKS) {
      const owners = BUILT_IN_PACK_COLLECTIONS.filter((collection) =>
        collection.primaryObjectPackIds.includes(pack.id)
      );

      expect(owners, pack.id).toHaveLength(1);
    }

    for (const pack of BUILT_IN_PRESET_PACKS) {
      const owners = BUILT_IN_PACK_COLLECTIONS.filter((collection) =>
        [...collection.primaryPresetPackIds, ...collection.optionalPresetPackIds].includes(pack.id)
      );

      expect(owners, pack.id).toHaveLength(1);
    }
  });

  it('makes each preset pack available from its collection or Essentials', () => {
    const essentials = BUILT_IN_PACK_COLLECTIONS.find(
      (collection) => collection.id === 'essentials'
    )!;
    const essentialObjects = new Set(
      getCollectionObjectPackIds(essentials).flatMap(
        (packId) => BUILT_IN_PACKS.find((pack) => pack.id === packId)?.objects ?? []
      )
    );

    for (const collection of BUILT_IN_PACK_COLLECTIONS) {
      const collectionObjects = new Set([
        ...essentialObjects,
        ...collection.supportingObjectTypes,
        ...getCollectionObjectPackIds(collection).flatMap(
          (packId) => BUILT_IN_PACKS.find((pack) => pack.id === packId)?.objects ?? []
        )
      ]);

      for (const presetPackId of [
        ...collection.primaryPresetPackIds,
        ...collection.optionalPresetPackIds
      ]) {
        const presetPack = BUILT_IN_PRESET_PACKS.find((pack) => pack.id === presetPackId)!;

        expect(
          presetPack.requiredObjects.length === 0 ||
            presetPack.requiredObjects.some((object) => collectionObjects.has(object)),
          `${collection.name} must make ${presetPack.name} available`
        ).toBe(true);
      }
    }
  });
});
