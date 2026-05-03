import { derived } from 'svelte/store';

import { nodeNames } from '$lib/nodes/node-types';
import { getObjectNames } from '$lib/objects/object-definitions';
import { ObjectShorthandRegistry } from '$lib/registry/ObjectShorthandRegistry';
import {
  buildObjectPresetSearchIndex,
  DEFAULT_OBJECT_SUGGESTION_LIMIT,
  getObjectPriority,
  type ObjectPresetSearchIndex,
  type ObjectPresetSearchItem,
  type ObjectSearchShorthand,
  type SearchOptions
} from '$lib/search/object-preset-search';

import { enabledObjects, enabledPresets } from './extensions.store';
import { flattenedPresets } from './preset-library.store';
import { isAiFeaturesVisible, patchObjectTypes } from './ui.store';

export {
  buildObjectPresetSearchIndex,
  DEFAULT_OBJECT_SUGGESTION_LIMIT,
  getObjectPriority,
  type ObjectPresetSearchIndex,
  type ObjectPresetSearchItem,
  type ObjectSearchShorthand,
  type SearchOptions
};

export const objectPresetSearchIndex = derived(
  [flattenedPresets, enabledObjects, enabledPresets, patchObjectTypes, isAiFeaturesVisible],
  ([
    $flattenedPresets,
    $enabledObjects,
    $enabledPresets,
    $patchObjectTypes,
    $isAiFeaturesVisible
  ]) => {
    const objectDefNames = getObjectNames();
    const visualNodeList = nodeNames.filter((name) => name !== 'object' && name !== 'asm.value');
    const shorthandRegistry = ObjectShorthandRegistry.getInstance();

    return buildObjectPresetSearchIndex({
      presets: $flattenedPresets,
      objectNames: new Set([...visualNodeList, ...objectDefNames]),
      shorthands: shorthandRegistry.getShorthandsWithMetadata(),
      enabledObjectNames: $enabledObjects,
      enabledPresetNames: $enabledPresets,
      patchObjectTypeNames: $patchObjectTypes,
      aiFeaturesVisible: $isAiFeaturesVisible
    });
  }
);
