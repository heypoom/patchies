import { match, P } from 'ts-pattern';
import type { V1PatchAudioNodeGroup } from './audio-node-types';
import { AudioService } from './v2/AudioService';

export const getAudioNodeGroup = (nodeType: string): V1PatchAudioNodeGroup | null => {
	// V2: check in audio node registry
	const v2NodeGroup = AudioService.getInstance().getNodeGroup(nodeType);
	if (v2NodeGroup) return v2NodeGroup;

	// V1: hard-coded names :-(
	return match<string, V1PatchAudioNodeGroup | null>(nodeType)
		.with(P.union('lyria', 'mic~', 'sig~', 'soundfile~'), () => 'sources')
		.with(
			P.union(
				'fft~',
				'+~',
				'lowpass~',
				'highpass~',
				'bandpass~',
				'allpass~',
				'notch~',
				'lowshelf~',
				'highshelf~',
				'peaking~',
				'compressor~',
				'pan~',
				'delay~',
				'waveshaper~',
				'convolver~',
				'split~',
				'merge~'
			),
			() => 'processors'
		)
		.otherwise(() => null);
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
