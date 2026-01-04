import { AudioRegistry } from '$lib/registry/AudioRegistry';
import { ObjectRegistry } from '$lib/registry/ObjectRegistry';

import { ObjectShorthandRegistry } from '../registry/ObjectShorthandRegistry';

export const getObjectNameFromExpr = (expr: string): string =>
	expr.trim().toLowerCase().split(' ')?.[0];

/**
 * Get all object names for autocomplete.
 * Includes: shorthands, V2 audio objects, V2 text objects.
 */
export function getObjectNames(): string[] {
	const shorthandNames = ObjectShorthandRegistry.getInstance().getShorthandNames();
	const v2AudioObjectNames = AudioRegistry.getInstance().getNodeTypes();
	const v2TextObjectNames = ObjectRegistry.getInstance().getObjectTypes();

	return [...shorthandNames, ...v2AudioObjectNames, ...v2TextObjectNames];
}
