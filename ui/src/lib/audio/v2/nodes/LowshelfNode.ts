import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

export class LowshelfNode implements AudioNodeV2 {
	static name = 'lowshelf~';
	static group: AudioNodeGroup = 'processors';
	static description = 'Low shelf filter boosts or cuts frequencies below the cutoff frequency';

	static inlets: ObjectInlet[] = [
		{
			name: 'in',
			type: 'signal',
			description: 'Signal to filter'
		},
		{
			name: 'frequency',
			type: 'float',
			description: 'Cutoff frequency in Hz',
			defaultValue: 1000,
			isAudioParam: true,
			minNumber: 0,
			maxNumber: 22050,
			maxPrecision: 1
		},
		{
			name: 'gain',
			type: 'float',
			description: 'Gain in dB',
			defaultValue: 0,
			isAudioParam: true,
			minNumber: -40,
			maxNumber: 40,
			maxPrecision: 1
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
	readonly audioNode: BiquadFilterNode;

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioNode = audioContext.createBiquadFilter();
		this.audioNode.type = 'lowshelf';
	}

	create(params: unknown[]): void {
		const [, frequency, gain] = params as [unknown, number, number];

		this.audioNode.frequency.value = frequency ?? 1000;
		this.audioNode.gain.value = gain ?? 0;
	}
}
