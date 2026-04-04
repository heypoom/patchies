import { AudioRegistry } from '$lib/registry/AudioRegistry';
import { ObjectRegistry } from '$lib/registry/ObjectRegistry';
import { nodeNames } from '$lib/nodes/node-types';
import { objectSchemas } from '$lib/objects/schemas';
import { BUILT_IN_PACKS, type ExtensionPack } from '../../../stores/extensions.store';

export interface ObjectItem {
  name: string;
  description: string;
  category: string;
  priority?: 'normal' | 'low';
}

export interface CategoryGroup {
  title: string;
  icon: string; // lucide icon name
  objects: ObjectItem[];
}

/**
 * Fallback descriptions for objects that don't have schemas
 */
const FALLBACK_DESCRIPTIONS: Record<string, string> = {
  bchrn: 'Butterchurn milkdrop visualizer with audio reactivity'
};

/**
 * Build a reverse lookup from object name to its pack
 */
function buildObjectToPackMap(): Map<string, ExtensionPack> {
  const map = new Map<string, ExtensionPack>();

  for (const pack of BUILT_IN_PACKS) {
    for (const obj of pack.objects) {
      map.set(obj, pack);
    }
  }

  return map;
}

const objectToPackMap = buildObjectToPackMap();

/**
 * Get the description for an object, using schemas as the primary source
 */
export function getObjectDescription(name: string): string {
  const schema = objectSchemas[name];

  if (schema?.description) {
    return schema.description;
  }

  if (FALLBACK_DESCRIPTIONS[name]) {
    return FALLBACK_DESCRIPTIONS[name];
  }

  return `${name} node`;
}

/**
 * Get all objects categorized by extension pack
 * Uses BUILT_IN_PACKS as the single source of truth for categorization
 *
 * @param includeAiFeatures - Whether to include AI-related objects (default: true)
 * @param enabledObjects - Optional set of enabled object names. If provided, only these objects are included.
 * @param patchObjectTypes - Optional set of object types in the current patch. Objects in the patch
 *                           but not enabled will be included with low priority.
 */
export function getCategorizedObjects(
  includeAiFeatures: boolean = true,
  enabledObjects?: Set<string>,
  patchObjectTypes?: Set<string>
): CategoryGroup[] {
  const seenNames = new Set<string>();
  const packObjects = new Map<string, ObjectItem[]>();

  // Initialize empty arrays for each pack
  for (const pack of BUILT_IN_PACKS) {
    packObjects.set(pack.id, []);
  }

  const audioRegistry = AudioRegistry.getInstance();
  const objectRegistry = ObjectRegistry.getInstance();

  // Collect all available object names
  const allObjectNames = new Set<string>();

  // From audio registry
  for (const nodeType of audioRegistry.getVisibleNodeTypes()) {
    allObjectNames.add(nodeType);
  }

  // From object registry
  for (const objectType of objectRegistry.getPrimaryObjectTypes()) {
    allObjectNames.add(objectType);
  }

  // From node names
  for (const nodeName of nodeNames) {
    if (nodeName !== 'object' && nodeName !== 'asm.value') {
      allObjectNames.add(nodeName);
    }
  }

  // Categorize each object by its pack
  for (const name of allObjectNames) {
    if (seenNames.has(name)) continue;
    seenNames.add(name);

    // Skip AI objects if disabled
    if (!includeAiFeatures && name.startsWith('ai.')) continue;

    const isEnabled = !enabledObjects || enabledObjects.has(name);
    const isInPatch = patchObjectTypes?.has(name) ?? false;

    // Skip if not enabled AND not in current patch
    if (!isEnabled && !isInPatch) continue;

    const pack = objectToPackMap.get(name);
    if (!pack) continue; // Object not in any pack

    const objects = packObjects.get(pack.id)!;
    objects.push({
      name,
      description: getObjectDescription(name),
      category: pack.name,
      priority: isEnabled ? 'normal' : 'low'
    });
  }

  // Sort objects within each pack: normal priority first, then alphabetically
  for (const objects of packObjects.values()) {
    objects.sort((a, b) => {
      // Low priority items come last
      if (a.priority !== b.priority) {
        return a.priority === 'normal' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  // Build result in pack order
  const result: CategoryGroup[] = [];

  for (const pack of BUILT_IN_PACKS) {
    const objects = packObjects.get(pack.id)!;
    if (objects.length > 0) {
      result.push({
        title: pack.name,
        icon: pack.icon,
        objects
      });
    }
  }

  return result;
}
