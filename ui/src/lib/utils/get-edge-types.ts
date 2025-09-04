import { getAudioNodeGroup } from '$lib/audio/audio-node-group';
import type { PsAudioType } from '$lib/audio/audio-node-types';
import { objectDefinitions } from '$lib/objects/object-definitions';
import type { Node } from '@xyflow/svelte';

type PsEdgeType = 'message' | 'video' | 'audio';
type MinimalNode = Pick<Node, 'id' | 'type' | 'data'>;

/** Visual audio nodes. */
const AUDIO_NODES = ['ai.music', 'ai.tts', 'sampler~', 'soundfile~', 'chuck', 'expr~', 'strudel'];

const isAudioObject = (node: MinimalNode): boolean => {
	if (!node.type) return false;

	if (node.type === 'object') {
		return !!getAudioNodeGroup(node.data.name as PsAudioType);
	}

	return AUDIO_NODES.includes(node.type);
};

const isAudioHandle = (node: MinimalNode, handle: string | null, isInlet: boolean): boolean => {
	if (!handle) return false;

	if (handle.startsWith('audio')) return true;

	if (node.type === 'object') {
		const data = node.data as { name: string };

		if (isInlet) {
			const inletIndex = parseInt(handle.replace('inlet-', ''), 10);

			return objectDefinitions[data.name].inlets?.[inletIndex]?.type === 'signal';
		} else {
			const outletIndex = parseInt(handle.replace('outlet-', ''), 10);

			return objectDefinitions[data.name].outlets?.[outletIndex]?.type === 'signal';
		}
	}

	return false;
};

export function getEdgeTypes(
	source: MinimalNode,
	target: MinimalNode,
	sourceHandle: string | null,
	targetHandle: string | null
): PsEdgeType {
	const sh = sourceHandle?.split('-')[0];
	const th = targetHandle?.split('-')[0];

	if (
		isAudioObject(source) &&
		isAudioObject(target) &&
		isAudioHandle(source, sourceHandle, false) &&
		isAudioHandle(target, targetHandle, true)
	) {
		return 'audio';
	}

	if (sh === 'video' || th === 'video' || sh === 'glsl') {
		return 'video';
	}

	return 'message';
}
