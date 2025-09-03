import { getAudioNodeGroup } from '$lib/audio/audio-node-group';
import type { PsAudioNode, PsAudioType } from '$lib/audio/audio-node-types';
import type { Node } from '@xyflow/svelte';

type PsEdgeType = 'message' | 'video' | 'audio';
type MinimalNode = Pick<Node, 'id' | 'type' | 'data'>;

export function getEdgeTypes(
	source: MinimalNode,
	target: MinimalNode,
	sourceHandle: string | null,
	targetHandle: string | null
): PsEdgeType {
	const s = source.type?.split('-')[0];
	const t = target.type?.split('-')[0];
	const sh = sourceHandle?.split('-')[0];
	const th = targetHandle?.split('-')[0];

	if (s === 'object') {
		const sn = getAudioNodeGroup(source.data.name as PsAudioType);
		if (sn) return 'audio';
	}

	if (t === 'object') {
		const tn = getAudioNodeGroup(target.data.name as PsAudioType);
		if (tn) return 'audio';
	}

	if (sh === 'video' || th === 'video' || sh === 'glsl') {
		return 'video';
	}

	return 'message';
}
