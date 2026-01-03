import { match } from 'ts-pattern';
import type { V1PatchAudioNodeGroup } from './audio-node-types';
import { AudioRegistry } from '$lib/registry/AudioRegistry';

export const getAudioNodeGroup = (nodeType: string): V1PatchAudioNodeGroup | null => {
	// V2: check in audio registry
	const nodeGroupV2 = AudioRegistry.getInstance().get(nodeType)?.group;
	if (nodeGroupV2) return nodeGroupV2;

	// TODO: remove hard-coded lyria node
	if (nodeType === 'lyria') {
		return 'sources';
	}

	return null;
};

export const canAudioNodeConnect = (sourceType: string, targetType: string): boolean => {
	const source = getAudioNodeGroup(sourceType);
	const target = getAudioNodeGroup(targetType);

	return match({ source, target })
		.with({ source: 'sources', target: 'sources' }, () => false)
		.with({ source: 'sources', target: 'processors' }, () => true)
		.with({ source: 'sources', target: 'destinations' }, () => true)
		.with({ source: 'processors', target: 'sources' }, () => false)
		.with({ source: 'processors', target: 'processors' }, () => true)
		.with({ source: 'processors', target: 'destinations' }, () => true)
		.otherwise(() => true);
};
