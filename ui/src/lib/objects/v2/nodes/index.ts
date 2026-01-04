/**
 * Import and register all text object classes here.
 */

import { LoadbangObject } from './LoadbangObject';
import { MetroObject } from './MetroObject';
import { MtofObject } from './MtofObject';

import { ObjectRegistry } from '$lib/registry/ObjectRegistry';

import type { TextObjectClass } from '../interfaces/text-objects';

const TEXT_OBJECTS = [LoadbangObject, MetroObject, MtofObject] as const satisfies TextObjectClass[];

/**
 * Register all V2 text objects with the ObjectRegistry.
 * This should be called during application initialization.
 */
export function registerTextObjects(): void {
	const registry = ObjectRegistry.getInstance();

	TEXT_OBJECTS.forEach((object) => registry.register(object));
}
