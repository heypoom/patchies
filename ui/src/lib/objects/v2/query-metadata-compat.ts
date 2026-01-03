import { AudioRegistry } from '$lib/registry/AudioRegistry';

import { objectDefinitionsV1 } from '../object-definitions';

/**
 * Get metadata with V1+V2 compatibility.
 *
 * Use this when you need to search in all registries to grab node metadata.
 **/
export const getCompatMetadata = (name: string) => {
	const metadata = AudioRegistry.getInstance().getNodeMetadataByType(name);
	if (metadata) return metadata;

	if (objectDefinitionsV1[name]) {
		return objectDefinitionsV1[name];
	}

	return null;
};
