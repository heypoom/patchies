import type {
	ObjectDataType,
	ObjectInlet,
	ObjectOutlet,
	ObjectMetadata
} from '$lib/objects/v2/object-metadata';
import { AudioRegistry } from '$lib/registry/AudioRegistry';
import { ObjectRegistry } from '$lib/registry/ObjectRegistry';
import { getCompatMetadata } from './v2/query-metadata-compat';

/** Legacy type alias for backwards compatibility. */
export type ObjectDefinition = ObjectMetadata;

// Re-export v2 types for backwards compatibility
export type { ObjectDataType, ObjectInlet, ObjectOutlet };

/** Legacy object definitions. */
export const objectDefinitionsV1: Record<string, ObjectDefinition> = {
	fslider: {
		inlets: [{ name: 'min' }, { name: 'max' }, { name: 'value' }],
		outlets: []
	},

	// vertical slider
	vslider: {
		inlets: [{ name: 'min' }, { name: 'max' }, { name: 'value' }],
		outlets: []
	},

	// vertical float slider
	vfslider: {
		inlets: [{ name: 'min' }, { name: 'max' }, { name: 'value' }],
		outlets: []
	}
};

/**
 * Check if a node has any signal inlets or outlets (i.e., is an audio node).
 */
function hasSignalPorts(metadata: ObjectMetadata): boolean {
	const hasSignalInlet = metadata.inlets?.some((inlet) => inlet.type === 'signal');
	const hasSignalOutlet = metadata.outlets?.some((outlet) => outlet.type === 'signal');
	return !!(hasSignalInlet || hasSignalOutlet);
}

/**
 * Get all audio object names from both v1 and v2 systems.
 * Audio objects are automatically detected by having signal inlets or outlets.
 */
export function getAudioObjectNames(): string[] {
	const registryV2 = AudioRegistry.getInstance();

	// Get v1 audio objects - detect by signal inlets/outlets
	const audioObjectNamesV1 = Object.keys(objectDefinitionsV1).filter((key) =>
		hasSignalPorts(objectDefinitionsV1[key])
	);

	// Get v2 audio objects - detect by signal inlets/outlets
	const audioObjectNamesV2 = registryV2.getNodeTypes().filter((name) => {
		const metadata = registryV2.getNodeMetadataByType(name);

		return metadata && hasSignalPorts(metadata);
	});

	return [...audioObjectNamesV1, ...audioObjectNamesV2];
}

export const getObjectNameFromExpr = (expr: string): string =>
	expr.trim().toLowerCase().split(' ')?.[0];

/**
 * Get object definition for a given expression.
 */
export const getObjectDefinition = (expr: string): ObjectDefinition | undefined =>
	getCompatMetadata(getObjectNameFromExpr(expr)) as ObjectDefinition;

/**
 * Get all object names from both v1 and v2 systems.
 */
export function getObjectNames(): string[] {
	const v1Names = Object.keys(objectDefinitionsV1);
	const v2AudioObjectNames = AudioRegistry.getInstance().getNodeTypes();
	const v2TextObjectNames = ObjectRegistry.getInstance().getObjectTypes();

	return [...v1Names, ...v2AudioObjectNames, ...v2TextObjectNames];
}
