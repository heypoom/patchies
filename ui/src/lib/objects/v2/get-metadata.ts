import { AudioRegistry } from '$lib/registry/AudioRegistry';
import { ObjectRegistry } from '$lib/registry/ObjectRegistry';

import type { ObjectMetadata } from './object-metadata';

/**
 * Get metadata with V2 compatibility.
 *
 * Use this when you need to search in all registries to grab node metadata.
 * Checks in order: AudioRegistry (V2 audio) → ObjectRegistry (V2 text)
 **/
export const getCombinedMetadata = (name: string): ObjectMetadata | undefined => {
	// Check V2 audio registry first
	const audioMetadata = AudioRegistry.getInstance().get(name);
	if (audioMetadata) return audioMetadata;

	// Check V2 text object registry
	const objectMetadata = ObjectRegistry.getInstance().getObjectMetadataByType(name);
	if (objectMetadata) return objectMetadata;
};
