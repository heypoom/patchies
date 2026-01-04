import { getAudioNodeGroup } from '$lib/audio/audio-node-group';
import type { V1PatchAudioType } from '$lib/audio/audio-node-types';
import { AudioRegistry } from '$lib/registry/AudioRegistry';
import type { Node } from '@xyflow/svelte';

type PsEdgeType = 'message' | 'video' | 'audio';
type MinimalNode = Pick<Node, 'id' | 'type' | 'data'>;

/** Visual audio nodes. */
const AUDIO_NODES = [
	'ai.music',
	'ai.tts',
	'sampler~',
	'soundfile~',
	'chuck~',
	'expr~',
	'dsp~',
	'tone~',
	'strudel',
	'video',
	'split~',
	'merge~',
	'meter~',
	'elem~',
	'csound~'
];

const isAudioObject = (node: MinimalNode): boolean => {
	if (!node.type) return false;

	if (node.type === 'object') {
		return !!getAudioNodeGroup(node.data.name as V1PatchAudioType);
	}

	return AUDIO_NODES.includes(node.type);
};

export const handleToPortIndex = (handle: string | null): number | null => {
	if (!handle) return null;

	const id = handle
		.replace('message-in-', '')
		.replace('audio-in-', '')
		.replace('message-out-', '')
		.replace('audio-out-', '');

	return parseInt(id, 10);
};

const isAudioHandle = (node: MinimalNode, handle: string | null, isInlet: boolean): boolean => {
	if (!handle) return false;

	if (handle.startsWith('audio')) return true;

	if (node.type === 'object') {
		const data = node.data as { name: string };
		const registry = AudioRegistry.getInstance();

		const metadata = registry.getNodeMetadataByType(data.name);
		if (!metadata) return false;

		if (isInlet) {
			const inletIndex = handleToPortIndex(handle);
			if (inletIndex === null || isNaN(inletIndex)) return false;

			const inlet = metadata.inlets?.[inletIndex];
			if (!inlet) return false;

			return inlet.type === 'signal' || (inlet.isAudioParam ?? false);
		} else {
			const outletIndex = handleToPortIndex(handle);
			if (outletIndex === null || isNaN(outletIndex)) return false;

			const outlet = metadata.outlets?.[outletIndex];
			if (!outlet) return false;

			return outlet.type === 'signal';
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
