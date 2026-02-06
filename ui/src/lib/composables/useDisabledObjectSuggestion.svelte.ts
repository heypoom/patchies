import Fuse from 'fuse.js';
import { BUILT_IN_PACKS } from '../../stores/extensions.store';
import { VISUAL_NODE_DESCRIPTIONS } from '../components/object-browser/get-categorized-objects';

export interface DisabledObjectInfo {
  name: string;
  description: string;
  packId: string;
  packName: string;
  packIcon: string;
}

/**
 * Composable for searching disabled objects and suggesting packs to enable.
 * Used by both ObjectBrowserModal and ObjectNode autocomplete.
 */
export function useDisabledObjectSuggestion(
  getEnabledPackIds: () => string[],
  getIsAiFeaturesVisible: () => boolean
) {
  // Build disabled objects list reactively
  const disabledObjects = $derived.by((): DisabledObjectInfo[] => {
    const enabledPackIds = getEnabledPackIds();
    const isAiFeaturesVisible = getIsAiFeaturesVisible();
    const result: DisabledObjectInfo[] = [];

    for (const pack of BUILT_IN_PACKS) {
      // Skip enabled packs
      if (enabledPackIds.includes(pack.id)) continue;

      for (const objName of pack.objects) {
        // Skip AI objects if AI features are hidden
        if (!isAiFeaturesVisible && objName.startsWith('ai.')) continue;

        result.push({
          name: objName,
          description: VISUAL_NODE_DESCRIPTIONS[objName] || `${objName} node`,
          packId: pack.id,
          packName: pack.name,
          packIcon: pack.icon
        });
      }
    }

    return result;
  });

  // Fuse instance for searching disabled objects
  const fuse = $derived(
    new Fuse(disabledObjects, {
      keys: ['name', 'description'],
      threshold: 0.3,
      includeScore: true
    })
  );

  /**
   * Search for a disabled object matching the query.
   * Returns the best match or null if no match found.
   */
  function searchDisabledObject(query: string): DisabledObjectInfo | null {
    if (!query.trim()) return null;

    const results = fuse.search(query);
    if (results.length === 0) return null;

    return results[0].item;
  }

  return {
    disabledObjects,
    searchDisabledObject
  };
}
