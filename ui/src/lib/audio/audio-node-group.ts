import { match, P } from 'ts-pattern';
import type { V1PatchAudioNodeGroup, V1PatchAudioType } from './audio-node-types';

export const getAudioNodeGroup = (nodeType: V1PatchAudioType): V1PatchAudioNodeGroup | null =>
	match<V1PatchAudioType, V1PatchAudioNodeGroup | null>(nodeType)
		.with(P.union('osc~', 'lyria', 'mic~', 'sig~', 'soundfile~'), () => 'sources')
		.with(
			P.union(
				'gain~',
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
		.with('dac~', () => 'destinations')
		.otherwise(() => null);

export const canAudioNodeConnect = (
	sourceType: V1PatchAudioType,
	targetType: V1PatchAudioType
): boolean => {
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
