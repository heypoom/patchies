import { writable, derived } from 'svelte/store';

// Types
export interface ExtensionPack {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  objects: string[];
}

export interface PresetPack {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  requiredObjects: string[]; // Object types needed (filters pack visibility)
  presets: string[]; // Preset names to enable
}

// Re-export pack definitions from extracted files
export { BUILT_IN_PACKS } from '$lib/extensions/object-packs';
export { BUILT_IN_PRESET_PACKS } from '$lib/extensions/preset-packs';

// Import for internal use
import { BUILT_IN_PACKS } from '$lib/extensions/object-packs';
import { BUILT_IN_PRESET_PACKS } from '$lib/extensions/preset-packs';

// ============================================================================
// Object Packs Store
// ============================================================================

const STORAGE_KEY = 'patchies:enabled-packs';
const DEFAULT_ENABLED_PACKS = ['essentials'];

function getInitialEnabledPacks(): string[] {
  if (typeof localStorage === 'undefined') return DEFAULT_ENABLED_PACKS;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return DEFAULT_ENABLED_PACKS;

  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Invalid JSON, use defaults
  }
  return DEFAULT_ENABLED_PACKS;
}

/**
 * Store of enabled object pack IDs
 */
export const enabledPackIds = writable<string[]>(getInitialEnabledPacks());

// Persist to localStorage
if (typeof localStorage !== 'undefined') {
  enabledPackIds.subscribe((ids) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  });
}

/**
 * Derived set of all enabled object names
 */
export const enabledObjects = derived(enabledPackIds, ($enabledPackIds) => {
  const objects = new Set<string>();

  for (const packId of $enabledPackIds) {
    const pack = BUILT_IN_PACKS.find((p) => p.id === packId);
    if (pack) {
      for (const obj of pack.objects) {
        objects.add(obj);
      }
    }
  }

  return objects;
});

/**
 * Toggle a pack on/off
 */
export function togglePack(packId: string): void {
  enabledPackIds.update((ids) => {
    if (ids.includes(packId)) {
      return ids.filter((id) => id !== packId);
    } else {
      return [...ids, packId];
    }
  });
}

/**
 * Enable all object packs
 */
export function enableAllPacks(): void {
  enabledPackIds.set(BUILT_IN_PACKS.map((p) => p.id));
}

/**
 * Disable all object packs (except essentials for safety)
 */
export function disableAllPacks(): void {
  enabledPackIds.set(['essentials']);
}

/**
 * Check if a pack is enabled
 */
export function isPackEnabled(packId: string, enabledIds: string[]): boolean {
  return enabledIds.includes(packId);
}

// ============================================================================
// Preset Packs Store
// ============================================================================

const PRESET_STORAGE_KEY = 'patchies:enabled-preset-packs';
const DEFAULT_ENABLED_PRESET_PACKS = ['starter'];

function getInitialEnabledPresetPacks(): string[] {
  if (typeof localStorage === 'undefined') return DEFAULT_ENABLED_PRESET_PACKS;

  const stored = localStorage.getItem(PRESET_STORAGE_KEY);
  if (!stored) return DEFAULT_ENABLED_PRESET_PACKS;

  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Invalid JSON, use defaults
  }
  return DEFAULT_ENABLED_PRESET_PACKS;
}

/**
 * Store of enabled preset pack IDs
 */
export const enabledPresetPackIds = writable<string[]>(getInitialEnabledPresetPacks());

// Persist to localStorage
if (typeof localStorage !== 'undefined') {
  enabledPresetPackIds.subscribe((ids) => {
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(ids));
  });
}

/**
 * Derived set of all enabled preset names
 * Filters by both enabled preset packs AND enabled objects (dependencies)
 */
export const enabledPresets = derived(
  [enabledPresetPackIds, enabledObjects],
  ([$enabledPresetPackIds, $enabledObjects]) => {
    const presets = new Set<string>();

    for (const packId of $enabledPresetPackIds) {
      const pack = BUILT_IN_PRESET_PACKS.find((p) => p.id === packId);
      if (!pack) continue;

      // Only include presets if at least one required object is enabled
      // (partial availability - we filter unavailable, don't block entirely)
      const hasAnyRequiredObject = pack.requiredObjects.some((obj) => $enabledObjects.has(obj));
      if (!hasAnyRequiredObject) continue;

      for (const preset of pack.presets) {
        presets.add(preset);
      }
    }

    return presets;
  }
);

/**
 * Toggle a preset pack on/off
 */
export function togglePresetPack(packId: string): void {
  enabledPresetPackIds.update((ids) => {
    if (ids.includes(packId)) {
      return ids.filter((id) => id !== packId);
    } else {
      return [...ids, packId];
    }
  });
}

/**
 * Enable all preset packs
 */
export function enableAllPresetPacks(): void {
  enabledPresetPackIds.set(BUILT_IN_PRESET_PACKS.map((p) => p.id));
}

/**
 * Disable all preset packs (except starter for safety)
 */
export function disableAllPresetPacks(): void {
  enabledPresetPackIds.set(['starter']);
}

/**
 * Check if a preset pack is enabled
 */
export function isPresetPackEnabled(packId: string, enabledIds: string[]): boolean {
  return enabledIds.includes(packId);
}

/**
 * Check if a preset pack has all its required objects enabled
 */
export function isPresetPackFullyAvailable(
  pack: PresetPack,
  enabledObjectsSet: Set<string>
): boolean {
  return pack.requiredObjects.every((obj) => enabledObjectsSet.has(obj));
}

/**
 * Check if a preset pack has at least some of its required objects enabled
 */
export function isPresetPackPartiallyAvailable(
  pack: PresetPack,
  enabledObjectsSet: Set<string>
): boolean {
  return pack.requiredObjects.some((obj) => enabledObjectsSet.has(obj));
}
