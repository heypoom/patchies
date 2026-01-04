import type { ObjectMetadata } from '$lib/objects/v2/object-metadata';
import { AudioRegistry } from '$lib/registry/AudioRegistry';
import { ObjectRegistry } from '$lib/registry/ObjectRegistry';
import { getCombinedMetadata } from './v2/get-metadata';
import { getShorthandNames } from './object-shorthands';

/**
 * Check if a node has any signal inlets or outlets (i.e., is an audio node).
 */
function hasSignalPorts(metadata: ObjectMetadata): boolean {
	const hasSignalInlet = metadata.inlets?.some((inlet) => inlet.type === 'signal');
	const hasSignalOutlet = metadata.outlets?.some((outlet) => outlet.type === 'signal');

	return !!(hasSignalInlet || hasSignalOutlet);
}

/**
 * Get all audio object names from the V2 audio registry.
 * Audio objects are automatically detected by having signal inlets or outlets.
 */
export function getAudioObjectNames(): string[] {
	const registry = AudioRegistry.getInstance();

	return registry.getNodeTypes().filter((name) => {
		const nodeClass = registry.get(name);

		return nodeClass && hasSignalPorts(nodeClass);
	});
}

export const getObjectNameFromExpr = (expr: string): string =>
	expr.trim().toLowerCase().split(' ')?.[0];

/**
 * Get all object names for autocomplete.
 * Includes: shorthands, V2 audio objects, V2 text objects.
 */
export function getObjectNames(): string[] {
	const shorthandNames = getShorthandNames();
	const v2AudioObjectNames = AudioRegistry.getInstance().getNodeTypes();
	const v2TextObjectNames = ObjectRegistry.getInstance().getObjectTypes();

	return [...shorthandNames, ...v2AudioObjectNames, ...v2TextObjectNames];
}
