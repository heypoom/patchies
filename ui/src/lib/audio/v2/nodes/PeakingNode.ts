import { match, P } from 'ts-pattern';
import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

export class PeakingNode implements AudioNodeV2 {
	static name = 'peaking~';
	static group: AudioNodeGroup = 'processors';
	static description = 'Peaking filter allows peak EQ adjustments at a specific frequency';

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
			description: 'Quality factor (width of peak)',
			defaultValue: 1,
			isAudioParam: true,
			minNumber: 0.0001,
			maxNumber: 1000,
			maxPrecision: 2
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
		this.audioNode.type = 'peaking';
	}

	create(params: unknown[]): void {
		const [, frequency, Q, gain] = params as [unknown, number, number, number];

		this.audioNode.frequency.value = frequency ?? 1000;
		this.audioNode.Q.value = Q ?? 1;
		this.audioNode.gain.value = gain ?? 0;
	}

	getAudioParam(name: string): AudioParam | null {
		return match(name)
			.with('frequency', () => this.audioNode.frequency)
			.with('Q', () => this.audioNode.Q)
			.with('gain', () => this.audioNode.gain)
			.otherwise(() => null);
	}

	send(key: string, message: unknown): void {
		match([key, message])
			.with(['frequency', P.number], ([, frequency]) => {
				this.audioNode.frequency.value = frequency;
			})
			.with(['Q', P.number], ([, Q]) => {
				this.audioNode.Q.value = Q;
			})
			.with(['gain', P.number], ([, gain]) => {
				this.audioNode.gain.value = gain;
			});
	}
}
