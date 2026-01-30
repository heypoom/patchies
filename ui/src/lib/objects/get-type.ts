import type { AudioNodeV2 } from '$lib/audio/v2/interfaces/audio-nodes';
import type { TextObjectV2 } from './v2/interfaces/text-objects';

/**
 * Get the object type from a TextObjectV2 instance.
 * Extracts the static `type` property from the object's constructor.
 *
 * @param object - The object instance
 * @returns The object type identifier
 */
export const getObjectType = <T extends TextObjectV2 | AudioNodeV2>(object: T): string =>
  (object.constructor as unknown as { type: string }).type;
