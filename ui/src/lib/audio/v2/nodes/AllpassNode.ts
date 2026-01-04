import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

export class AllpassNode implements AudioNodeV2 {
	static type = 'allpass~';
	static group: AudioNodeGroup = 'processors';
	static description = 'All-pass filter passes all frequencies but shifts their phase';

	static inlets: ObjectInlet[] = [
		{
			name: 'in',
			type: 'signal',
			description: 'Signal to filter'
		},
		{
			name: 'frequency',
			type: 'float',
			description: 'Center frequency in Hz',
			defaultValue: 1000,
			isAudioParam: true,
			minNumber: 0,
			maxNumber: 22050,
			maxPrecision: 1
		},
		{
			name: 'Q',
			type: 'float',
			description: 'Quality factor',
			defaultValue: 1,
			isAudioParam: true,
			minNumber: 0.0001,
			maxNumber: 1000,
			maxPrecision: 2
		}
	];

	static outlets: ObjectOutlet[] = [
		{
			name: 'out',
			type: 'signal',
			description: 'Filtered signal'
		}
	];

	readonly nodeId: string;
	audioNode: BiquadFilterNode;

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioNode = audioContext.createBiquadFilter();
		this.audioNode.type = 'allpass';
	}

	create(params: unknown[]): void {
		const [, frequency, Q] = params as [unknown, number, number];

		this.audioNode.frequency.value = frequency ?? 1000;
		this.audioNode.Q.value = Q ?? 1;
	}
}
