import { match, P } from 'ts-pattern';
import type { PsAudioNodeGroup, PsAudioType } from './audio-node-types';

export const getAudioNodeGroup = (nodeType: PsAudioType): PsAudioNodeGroup | null =>
	match<PsAudioType, PsAudioNodeGroup | null>(nodeType)
		.with(P.union('osc', 'lyria', 'mic'), () => 'sources')
		.with(P.union('gain', 'fft', '+~', 'lpf', 'hpf', 'bpf'), () => 'processors')
		.with('dac', () => 'destinations')
		.otherwise(() => null);

export const canAudioNodeConnect = (sourceType: PsAudioType, targetType: PsAudioType): boolean => {
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
