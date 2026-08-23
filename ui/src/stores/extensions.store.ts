import { derived, get, writable } from 'svelte/store';
import { getObjectAliases } from '$lib/objects/object-definitions';
import { BUILT_IN_PACKS } from '$lib/extensions/object-packs';
import {
  BUILT_IN_PACK_COLLECTIONS,
  getCollectionObjectPackIds,
  type PackCollection,
  type PackCollectionId
} from '$lib/extensions/pack-collections';
import { isPresetPackAvailableForObjects } from '$lib/presets/preset-pack-availability';
import { getPresetPackPresetNames } from '$lib/presets/preset-pack-index';
import { BUILT_IN_PRESET_PACKS } from '$lib/presets/preset-packs';

export interface ExtensionPack {
  id: string;
  name: string;
  description: string;
  icon: string;
  objects: string[];
}

export interface PresetPack {
  id: string;
  name: string;
  description: string;
  icon: string;
  requiredObjects: string[];
  presets: string[];
  presetFolders?: Readonly<Record<string, readonly string[]>>;
}

export { BUILT_IN_PACKS } from '$lib/extensions/object-packs';
export { BUILT_IN_PACK_COLLECTIONS } from '$lib/extensions/pack-collections';
export type { PackCollection, PackCollectionId } from '$lib/extensions/pack-collections';
export { BUILT_IN_PRESET_PACKS } from '$lib/presets/preset-packs';

const STORAGE_KEY = 'patchies:enabled-packs';
const PRESET_STORAGE_KEY = 'patchies:enabled-preset-packs';
const COLLECTION_STORAGE_KEY = 'patchies:pack-library-preferences';
const DEFAULT_ENABLED_PACKS = ['starters'];
const DEFAULT_ENABLED_PRESET_PACKS = ['starters'];
const LOCKED_PACKS = ['starters'];
const LOCKED_PRESET_PACKS = ['starters'];
const BULK_ENABLE_EXCLUDED_PACKS = new Set(['experimental']);
const BULK_ENABLE_EXCLUDED_PRESET_PACKS = new Set(['greggman-bytebeat']);
const LEGACY_COLLECTION_ID_MIGRATIONS: Record<string, PackCollectionId> = {
  'input-and-output': 'connect'
};

export const BULK_ENABLE_PACK_IDS = BUILT_IN_PACKS.filter(
  (pack) => !BULK_ENABLE_EXCLUDED_PACKS.has(pack.id)
).map((pack) => pack.id);
export const BULK_ENABLE_PRESET_PACK_IDS = BUILT_IN_PRESET_PACKS.filter(
  (pack) => !BULK_ENABLE_EXCLUDED_PRESET_PACKS.has(pack.id)
).map((pack) => pack.id);

export interface PackLibraryPreferences {
  selectedCollectionIds: PackCollectionId[];
  objectPackOverrides: Record<string, boolean>;
  presetPackOverrides: Record<string, boolean>;
  hasCompletedCollectionOnboarding: boolean;
}

function readStoredIds(storageKey: string): string[] | null {
  if (typeof localStorage === 'undefined') return null;

  const stored = localStorage.getItem(storageKey);
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : null;
  } catch {
    return null;
  }
}

function migrateCollectionIds(ids: unknown[]): PackCollectionId[] {
  return Array.from(
    new Set(
      ids.flatMap((id) => {
        if (typeof id !== 'string') return [];

        const migratedId = LEGACY_COLLECTION_ID_MIGRATIONS[id] ?? id;
        return BUILT_IN_PACK_COLLECTIONS.some((collection) => collection.id === migratedId)
          ? [migratedId as PackCollectionId]
          : [];
      })
    )
  );
}

function getInitialPreferences(): PackLibraryPreferences {
  if (typeof localStorage === 'undefined') {
    return {
      selectedCollectionIds: [],
      objectPackOverrides: {},
      presetPackOverrides: {},
      hasCompletedCollectionOnboarding: false
    };
  }

  const stored = localStorage.getItem(COLLECTION_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<PackLibraryPreferences>;
      if (
        Array.isArray(parsed.selectedCollectionIds) &&
        parsed.objectPackOverrides &&
        parsed.presetPackOverrides &&
        typeof parsed.hasCompletedCollectionOnboarding === 'boolean'
      ) {
        return {
          selectedCollectionIds: migrateCollectionIds(parsed.selectedCollectionIds),
          objectPackOverrides: parsed.objectPackOverrides,
          presetPackOverrides: parsed.presetPackOverrides,
          hasCompletedCollectionOnboarding: parsed.hasCompletedCollectionOnboarding
        };
      }
    } catch {
      // Invalid preferences fall back to the legacy migration path.
    }
  }

  const legacyObjectPackIds = readStoredIds(STORAGE_KEY);
  const legacyPresetPackIds = readStoredIds(PRESET_STORAGE_KEY);

  if (legacyObjectPackIds || legacyPresetPackIds) {
    return {
      selectedCollectionIds: [],
      objectPackOverrides: Object.fromEntries(
        BUILT_IN_PACKS.filter((pack) => !LOCKED_PACKS.includes(pack.id)).map((pack) => [
          pack.id,
          legacyObjectPackIds?.includes(pack.id) ?? false
        ])
      ),
      presetPackOverrides: Object.fromEntries(
        BUILT_IN_PRESET_PACKS.filter((pack) => !LOCKED_PRESET_PACKS.includes(pack.id)).map(
          (pack) => [pack.id, legacyPresetPackIds?.includes(pack.id) ?? false]
        )
      ),
      hasCompletedCollectionOnboarding: true
    };
  }

  return {
    selectedCollectionIds: [],
    objectPackOverrides: {},
    presetPackOverrides: {},
    hasCompletedCollectionOnboarding: false
  };
}

export const packLibraryPreferences = writable<PackLibraryPreferences>(getInitialPreferences());

if (typeof localStorage !== 'undefined') {
  packLibraryPreferences.subscribe((preferences) => {
    localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(preferences));
  });
}

function getCollectionPackIds(
  selectedCollectionIds: PackCollectionId[],
  kind: 'object' | 'preset'
): Set<string> {
  const packIds = new Set(kind === 'object' ? DEFAULT_ENABLED_PACKS : DEFAULT_ENABLED_PRESET_PACKS);

  for (const collection of BUILT_IN_PACK_COLLECTIONS) {
    if (!selectedCollectionIds.includes(collection.id)) continue;

    for (const packId of kind === 'object'
      ? collection.primaryObjectPackIds
      : collection.primaryPresetPackIds) {
      packIds.add(packId);
    }
  }

  return packIds;
}

function getEffectivePackIds(
  preferences: PackLibraryPreferences,
  kind: 'object' | 'preset'
): string[] {
  const enabledIds = getCollectionPackIds(preferences.selectedCollectionIds, kind);
  const overrides =
    kind === 'object' ? preferences.objectPackOverrides : preferences.presetPackOverrides;
  const packs = kind === 'object' ? BUILT_IN_PACKS : BUILT_IN_PRESET_PACKS;
  const lockedPackIds = kind === 'object' ? LOCKED_PACKS : LOCKED_PRESET_PACKS;

  for (const pack of packs) {
    if (lockedPackIds.includes(pack.id)) continue;

    if (overrides[pack.id] === true) enabledIds.add(pack.id);
    if (overrides[pack.id] === false) enabledIds.delete(pack.id);
  }

  return packs.filter((pack) => enabledIds.has(pack.id)).map((pack) => pack.id);
}

export const enabledPackIds = derived(packLibraryPreferences, (preferences) =>
  getEffectivePackIds(preferences, 'object')
);
export const enabledPresetPackIds = derived(packLibraryPreferences, (preferences) =>
  getEffectivePackIds(preferences, 'preset')
);

export const enabledPrimaryObjects = derived(
  [enabledPackIds, packLibraryPreferences],
  ([$enabledPackIds, preferences]) => {
    const objects = new Set<string>();

    for (const packId of $enabledPackIds) {
      const pack = BUILT_IN_PACKS.find((candidate) => candidate.id === packId);
      if (!pack) continue;

      for (const object of pack.objects) objects.add(object);
    }

    for (const collection of BUILT_IN_PACK_COLLECTIONS) {
      if (!preferences.selectedCollectionIds.includes(collection.id)) continue;

      for (const object of collection.supportingObjectTypes) objects.add(object);
    }

    return objects;
  }
);

export const enabledObjects = derived(enabledPrimaryObjects, ($enabledPrimaryObjects) => {
  const objects = new Set($enabledPrimaryObjects);

  for (const object of $enabledPrimaryObjects) {
    for (const alias of getObjectAliases(object)) objects.add(alias);
  }

  return objects;
});

export const enabledPresets = derived(
  [enabledPresetPackIds, enabledObjects],
  ([$enabledPresetPackIds, $enabledObjects]) => {
    const presets = new Set<string>();

    for (const packId of $enabledPresetPackIds) {
      const pack = BUILT_IN_PRESET_PACKS.find((candidate) => candidate.id === packId);
      if (!pack || !isPresetPackAvailableForObjects(pack.requiredObjects, $enabledObjects))
        continue;

      for (const preset of getPresetPackPresetNames(pack)) presets.add(preset);
    }

    return presets;
  }
);

function updateOverride(kind: 'object' | 'preset', packId: string, enabled: boolean): void {
  const lockedPackIds = kind === 'object' ? LOCKED_PACKS : LOCKED_PRESET_PACKS;
  if (lockedPackIds.includes(packId)) return;

  packLibraryPreferences.update((preferences) => ({
    ...preferences,
    objectPackOverrides:
      kind === 'object'
        ? { ...preferences.objectPackOverrides, [packId]: enabled }
        : preferences.objectPackOverrides,
    presetPackOverrides:
      kind === 'preset'
        ? { ...preferences.presetPackOverrides, [packId]: enabled }
        : preferences.presetPackOverrides
  }));
}

export const isPackLocked = (packId: string): boolean => LOCKED_PACKS.includes(packId);
export const isPresetPackLocked = (packId: string): boolean => LOCKED_PRESET_PACKS.includes(packId);
export const isPackEnabled = (packId: string, enabledIds: string[]): boolean =>
  enabledIds.includes(packId);
export const isPresetPackEnabled = (packId: string, enabledIds: string[]): boolean =>
  enabledIds.includes(packId);

export function togglePack(packId: string): void {
  updateOverride(
    'object',
    packId,
    !isPackEnabled(packId, getEffectivePackIds(get(packLibraryPreferences), 'object'))
  );
}

export function togglePresetPack(packId: string): void {
  updateOverride(
    'preset',
    packId,
    !isPresetPackEnabled(packId, getEffectivePackIds(get(packLibraryPreferences), 'preset'))
  );
}

export function setObjectPacksEnabled(packIds: string[]): void {
  const enabledPackIds = new Set(packIds);

  packLibraryPreferences.update((preferences) => ({
    ...preferences,
    objectPackOverrides: Object.fromEntries(
      BUILT_IN_PACKS.filter((pack) => !LOCKED_PACKS.includes(pack.id)).map((pack) => [
        pack.id,
        enabledPackIds.has(pack.id)
      ])
    )
  }));
}

export function enableObjectPacks(packIds: string[]): void {
  packLibraryPreferences.update((preferences) => ({
    ...preferences,
    objectPackOverrides: {
      ...preferences.objectPackOverrides,
      ...Object.fromEntries(packIds.map((packId) => [packId, true]))
    }
  }));
}

export function enableAllPacks(): void {
  setObjectPacksEnabled(BULK_ENABLE_PACK_IDS);
}

export function disableAllPacks(): void {
  setObjectPacksEnabled(DEFAULT_ENABLED_PACKS);
}

export function setPresetPacksEnabled(packIds: string[]): void {
  const enabledPackIds = new Set(packIds);

  packLibraryPreferences.update((preferences) => ({
    ...preferences,
    presetPackOverrides: Object.fromEntries(
      BUILT_IN_PRESET_PACKS.filter((pack) => !LOCKED_PRESET_PACKS.includes(pack.id)).map((pack) => [
        pack.id,
        enabledPackIds.has(pack.id)
      ])
    )
  }));
}

export function enableAllPresetPacks(): void {
  setPresetPacksEnabled(BULK_ENABLE_PRESET_PACK_IDS);
}

export function disableAllPresetPacks(): void {
  setPresetPacksEnabled(DEFAULT_ENABLED_PRESET_PACKS);
}

export function enableAllExtensionPacks(): void {
  enableAllPacks();
  enableAllPresetPacks();
}

export function selectCollection(collectionId: PackCollectionId): void {
  const collection = BUILT_IN_PACK_COLLECTIONS.find((candidate) => candidate.id === collectionId);
  if (!collection) return;

  packLibraryPreferences.update((preferences) => {
    const selectedCollectionIds = preferences.selectedCollectionIds.includes(collectionId)
      ? preferences.selectedCollectionIds
      : [...preferences.selectedCollectionIds, collectionId];
    const objectPackOverrides = { ...preferences.objectPackOverrides };
    const presetPackOverrides = { ...preferences.presetPackOverrides };

    for (const packId of getCollectionObjectPackIds(collection)) delete objectPackOverrides[packId];
    for (const packId of collection.primaryPresetPackIds) delete presetPackOverrides[packId];

    return { ...preferences, selectedCollectionIds, objectPackOverrides, presetPackOverrides };
  });
}

export function deselectCollection(collectionId: PackCollectionId): void {
  const collection = BUILT_IN_PACK_COLLECTIONS.find((candidate) => candidate.id === collectionId);
  if (!collection) return;

  packLibraryPreferences.update((preferences) => ({
    ...preferences,
    selectedCollectionIds: preferences.selectedCollectionIds.filter((id) => id !== collectionId),
    objectPackOverrides: {
      ...preferences.objectPackOverrides,
      ...Object.fromEntries(collection.primaryObjectPackIds.map((packId) => [packId, false]))
    },
    presetPackOverrides: {
      ...preferences.presetPackOverrides,
      ...Object.fromEntries(collection.primaryPresetPackIds.map((packId) => [packId, false]))
    }
  }));
}

export function toggleCollection(collection: PackCollection, enabled: boolean): void {
  if (collection.id === 'essentials') return;

  if (enabled) selectCollection(collection.id);
  else deselectCollection(collection.id);
}

export function completeCollectionOnboarding(selectedCollectionIds: PackCollectionId[]): void {
  packLibraryPreferences.update((preferences) => ({
    ...preferences,
    selectedCollectionIds: Array.from(
      new Set<PackCollectionId>(['essentials', ...selectedCollectionIds])
    ),
    hasCompletedCollectionOnboarding: true
  }));
}

export const isPresetPackFullyAvailable = (
  pack: PresetPack,
  enabledObjectsSet: Set<string>
): boolean => pack.requiredObjects.every((object) => enabledObjectsSet.has(object));
export const isPresetPackPartiallyAvailable = (
  pack: PresetPack,
  enabledObjectsSet: Set<string>
): boolean => pack.requiredObjects.some((object) => enabledObjectsSet.has(object));
