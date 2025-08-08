import { match, P } from 'ts-pattern';
import type { PsAudioNodeGroup, PsAudioType } from './audio-node-types';

export const getNodeGroup = (nodeType: PsAudioType): PsAudioNodeGroup | null =>
	match<PsAudioType, PsAudioNodeGroup | null>(nodeType)
		.with(P.union('osc'), () => 'sources')
		.with(P.union('gain', '+~'), () => 'processors')
		.with('dac', () => 'destinations')
		.otherwise(() => null);
