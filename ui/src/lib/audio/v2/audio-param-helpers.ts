import type { ObjectInlet } from '$lib/objects/v2/object-metadata';

/** Given an audio node, grab the audio param by name */
export function getAudioParamValue(
	name: string,
	audioNode: AudioNode,
	inlets: ObjectInlet[]
): AudioParam | null {
	const audioParamNames = inlets.filter((inlet) => inlet.isAudioParam).map((inlet) => inlet.name);

	if (!audioParamNames.includes(name)) {
		return null;
	}

	const param = getAudioParamByKey(audioNode, name);

	if (param instanceof AudioParam) {
		return param;
	}

	return null;
}

/** Given an audio node and an audio param name, set its value */
export function setAudioParamValue(
	name: string,
	value: unknown,
	audioNode: AudioNode,
	inlets: ObjectInlet[]
): void {
	if (typeof name === 'string' && typeof value === 'number') {
		const param = getAudioParamByKey(audioNode, name);

		if (!(param instanceof AudioParam)) {
			return;
		}

		if (getAudioParamNames(inlets).includes(name)) {
			param.value = value;
		}
	}
}

/**
 * Extracts audio parameter names from inlets marked as isAudioParam.
 * Useful for building match patterns or validation.
 */
export const getAudioParamNames = (inlets: ObjectInlet[]): string[] =>
	inlets
		.filter((inlet) => inlet.isAudioParam)
		.map((inlet) => inlet.name ?? '')
		.filter((name) => name);

export const getAudioParamByKey = (node: AudioNode, key: string): AudioParam =>
	(node as unknown as Record<string, AudioParam>)[key];
