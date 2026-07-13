import { AudioRegistry } from '$lib/registry/AudioRegistry';
import { TEXT_OBJECTS } from '$lib/objects/v2/nodes';
import type { TextObjectClass } from '$lib/objects/v2/interfaces/text-objects';

import { ObjectShorthandRegistry } from '../registry/ObjectShorthandRegistry';

export const getObjectNameFromExpr = (expr: string): string =>
  expr.trim().toLowerCase().split(' ')?.[0];

/**
 * Get all object names for autocomplete.
 * Includes: shorthands, V2 audio objects (non-headless), V2 text objects.
 */
export function getObjectNames(): string[] {
  const shorthandNames = ObjectShorthandRegistry.getInstance().getShorthandNames();
  const v2AudioObjectNames = AudioRegistry.getInstance().getVisibleNodeTypes();
  const v2TextObjectNames = getTextObjectNames();

  return [...shorthandNames, ...v2AudioObjectNames, ...v2TextObjectNames];
}

/**
 * Get aliases for an object from ObjectRegistry or AudioRegistry.
 * @param objectName - The primary object name
 * @returns Array of aliases, or empty array if none
 */
export function getObjectAliases(objectName: string): string[] {
  const objectClass = getTextObjectClasses().find((object) => object.type === objectName);
  if (objectClass?.aliases) return [...objectClass.aliases];

  const audioClass = AudioRegistry.getInstance().get(objectName);
  if (audioClass?.aliases) return audioClass.aliases;

  return [];
}

export function getTextObjectNames(): string[] {
  return getTextObjectClasses().flatMap((object) => [object.type, ...(object.aliases ?? [])]);
}

export function isTextObjectName(objectName: string): boolean {
  return getTextObjectClasses().some(
    (object) => object.type === objectName || object.aliases?.includes(objectName)
  );
}

function getTextObjectClasses(): readonly TextObjectClass[] {
  return TEXT_OBJECTS;
}
