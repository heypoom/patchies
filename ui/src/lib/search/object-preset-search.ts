import Fuse from 'fuse.js';

import type { FlattenedPreset } from '$lib/presets/types';
import { sortFuseResultsWithPrefixPriority } from '$lib/utils/sort-fuse-results';

export const DEFAULT_OBJECT_SUGGESTION_LIMIT = 100;

export type ObjectPresetSearchItem = {
  name: string;
  type: 'object' | 'preset';
  libraryName?: string;
  priority: 'normal' | 'low';
  description?: string;
};

export type ObjectSearchShorthand = {
  name: string;
  nodeType: string;
  description?: string;
};

export type ObjectPresetSearchIndex = {
  presetLookup: Map<string, FlattenedPreset>;
  allSearchableItems: ObjectPresetSearchItem[];
  getDefaultObjectSuggestions: (options?: SearchOptions) => ObjectPresetSearchItem[];
  searchObjectSuggestions: (query: string, options?: SearchOptions) => ObjectPresetSearchItem[];
  getPresetByName: (name: string) => FlattenedPreset | undefined;
};

export type SearchOptions = {
  limit?: number;
};

// Common objects that should appear first in autocomplete.
const PRIORITY_OBJECTS = [
  'button',
  'toggle',
  'slider',
  'textbox',
  'msg',
  'peek',
  'label',
  'js',
  'expr',
  'map',
  'filter',
  'tap',
  'worker',
  'keyboard',
  'markdown',
  'send',
  'recv',
  'delay',
  'metro',
  'counter',
  'p5',
  'hydra',
  'canvas',
  'glsl',
  'out~',
  'osc~',
  'gain~',
  'adc~'
];

const priorityObjectRanks = new Map(PRIORITY_OBJECTS.map((name, index) => [name, index]));

export function getObjectPriority(name: string): number {
  return priorityObjectRanks.get(name) ?? 1000;
}

function getLimit(options?: SearchOptions): number {
  return options?.limit ?? DEFAULT_OBJECT_SUGGESTION_LIMIT;
}

function sortSuggestions(items: ObjectPresetSearchItem[]): ObjectPresetSearchItem[] {
  return items.toSorted((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority === 'normal' ? -1 : 1;
    }

    const priorityDiff = getObjectPriority(a.name) - getObjectPriority(b.name);
    if (priorityDiff !== 0) return priorityDiff;

    return a.name.localeCompare(b.name);
  });
}

export function buildObjectPresetSearchIndex({
  presets,
  objectNames,
  shorthands,
  enabledObjectNames,
  enabledPresetNames,
  patchObjectTypeNames,
  aiFeaturesVisible
}: {
  presets: FlattenedPreset[];
  objectNames: Iterable<string>;
  shorthands: ObjectSearchShorthand[];
  enabledObjectNames: Set<string>;
  enabledPresetNames: Set<string>;
  patchObjectTypeNames: Set<string>;
  aiFeaturesVisible: boolean;
}): ObjectPresetSearchIndex {
  const presetLookup = new Map<string, FlattenedPreset>();

  for (const preset of presets) {
    // Later entries win so user presets can override built-in presets with the same name.
    presetLookup.set(preset.preset.name, preset);
  }

  const allSearchableItems: ObjectPresetSearchItem[] = [];
  const addedNames = new Set<string>();

  for (const name of objectNames) {
    if (!aiFeaturesVisible && name.startsWith('ai.')) {
      continue;
    }

    const isEnabled = enabledObjectNames.has(name);
    const isInPatch = patchObjectTypeNames.has(name);

    if (!isEnabled && !isInPatch) {
      continue;
    }

    allSearchableItems.push({
      name,
      type: 'object',
      priority: isEnabled ? 'normal' : 'low'
    });
    addedNames.add(name);
  }

  for (const shorthand of shorthands) {
    if (addedNames.has(shorthand.name)) continue;

    const isEnabled = enabledObjectNames.has(shorthand.nodeType);
    const isInPatch = patchObjectTypeNames.has(shorthand.nodeType);

    if (!isEnabled && !isInPatch) continue;

    allSearchableItems.push({
      name: shorthand.name,
      type: 'object',
      priority: isEnabled ? 'normal' : 'low',
      description: shorthand.description
    });
    addedNames.add(shorthand.name);
  }

  for (const flatPreset of presets) {
    if (!enabledObjectNames.has(flatPreset.preset.type)) {
      continue;
    }

    if (flatPreset.libraryName === 'Built-in' && !enabledPresetNames.has(flatPreset.preset.name)) {
      continue;
    }

    allSearchableItems.push({
      name: flatPreset.preset.name,
      type: 'preset',
      libraryName: flatPreset.libraryName,
      priority: 'normal'
    });
  }

  const fuse = new Fuse(allSearchableItems, {
    keys: ['name'],
    threshold: 0.2,
    includeScore: true,
    minMatchCharLength: 1
  });

  function getDefaultObjectSuggestions(options?: SearchOptions): ObjectPresetSearchItem[] {
    const objects = allSearchableItems.filter((item) => item.type === 'object');
    const presetsOnly = allSearchableItems.filter((item) => item.type === 'preset');

    return [...sortSuggestions(objects), ...sortSuggestions(presetsOnly)].slice(
      0,
      getLimit(options)
    );
  }

  function searchObjectSuggestions(
    query: string,
    options?: SearchOptions
  ): ObjectPresetSearchItem[] {
    const results = fuse.search(query, { limit: getLimit(options) });

    return sortFuseResultsWithPrefixPriority(
      results,
      query,
      (item) => item.name,
      (a, b) => {
        if (a.item.priority !== b.item.priority) {
          return a.item.priority === 'normal' ? -1 : 1;
        }

        if (a.item.type !== b.item.type) {
          return a.item.type === 'object' ? -1 : 1;
        }

        const scoreDiff = (a.score || 0) - (b.score || 0);
        if (Math.abs(scoreDiff) < 0.1 && a.item.type === 'object') {
          const priorityDiff = getObjectPriority(a.item.name) - getObjectPriority(b.item.name);
          if (priorityDiff !== 0) return priorityDiff;
        }

        return 0;
      }
    ).map((result) => result.item);
  }

  return {
    presetLookup,
    allSearchableItems,
    getDefaultObjectSuggestions,
    searchObjectSuggestions,
    getPresetByName: (name) => presetLookup.get(name)
  };
}
