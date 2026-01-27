/**
 * Import and register all text object classes here.
 */

import { AdsrObject } from './AdsrObject';
import { DelayObject } from './DelayObject';
import { FloatObject } from './FloatObject';
import { IntObject } from './IntObject';
import { LoadbangObject } from './LoadbangObject';
import { MetroObject } from './MetroObject';
import { MqttObject } from './MqttObject';
import { MtofObject } from './MtofObject';
import { SelectObject } from './SelectObject';
import { SpigotObject } from './SpigotObject';
import { TriggerObject } from './TriggerObject';
import { TtsObject } from './TtsObject';
import { WebMidiLinkObject } from './WebMidiLinkObject';

import { ObjectRegistry } from '$lib/registry/ObjectRegistry';

import type { TextObjectClass } from '../interfaces/text-objects';

const TEXT_OBJECTS = [
	AdsrObject,
	DelayObject,
	FloatObject,
	IntObject,
	LoadbangObject,
	MetroObject,
	MqttObject,
	MtofObject,
	SelectObject,
	SpigotObject,
	TriggerObject,
	TtsObject,
	WebMidiLinkObject
] as const satisfies TextObjectClass[];

/**
 * Register all V2 text objects with the ObjectRegistry.
 * This should be called during application initialization.
 */
export function registerTextObjects(): void {
	const registry = ObjectRegistry.getInstance();

	TEXT_OBJECTS.forEach((object) => registry.register(object));
}
