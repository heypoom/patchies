import { AudioRegistry } from '$lib/registry/AudioRegistry';
import { ObjectRegistry } from '$lib/registry/ObjectRegistry';

import { objectDefinitionsV1 } from '../object-definitions';

/**
 * Get metadata with V1+V2 compatibility.
 *
 * Use this when you need to search in all registries to grab node metadata.
 * Checks in order: AudioRegistry (V2 audio) → ObjectRegistry (V2 text) → V1 definitions
 **/
export const getCompatMetadata = (name: string) => {
	// Check V2 audio registry first
	const audioMetadata = AudioRegistry.getInstance().getNodeMetadataByType(name);
	if (audioMetadata) return audioMetadata;

	// Check V2 text object registry
	const objectMetadata = ObjectRegistry.getInstance().getObjectMetadataByType(name);
	if (objectMetadata) return objectMetadata;

	// Fall back to V1 definitions
	if (objectDefinitionsV1[name]) {
		return objectDefinitionsV1[name];
	}

	return null;
};
