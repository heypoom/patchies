/**
 * Import and register all text object classes here.
 */

import { AdsrObject } from './AdsrObject';
import { DelayObject } from './DelayObject';
import { LoadbangObject } from './LoadbangObject';
import { MetroObject } from './MetroObject';
import { MtofObject } from './MtofObject';
import { SpigotObject } from './SpigotObject';

import { ObjectRegistry } from '$lib/registry/ObjectRegistry';

import type { TextObjectClass } from '../interfaces/text-objects';

const TEXT_OBJECTS = [
	AdsrObject,
	DelayObject,
	LoadbangObject,
	MetroObject,
	MtofObject,
	SpigotObject
] as const satisfies TextObjectClass[];

/**
 * Register all V2 text objects with the ObjectRegistry.
 * This should be called during application initialization.
 */
export function registerTextObjects(): void {
	const registry = ObjectRegistry.getInstance();

	TEXT_OBJECTS.forEach((object) => registry.register(object));
}
