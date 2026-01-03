import { match, P } from 'ts-pattern';
import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

export class HighpassNode implements AudioNodeV2 {
	static name = 'highpass~';
	static group: AudioNodeGroup = 'processors';
	static description = 'High-pass filter allows frequencies above cutoff to pass through';

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
			name: 'Q',
			type: 'float',
			description: 'Quality factor (resonance)',
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
	readonly audioNode: BiquadFilterNode;

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioNode = audioContext.createBiquadFilter();
		this.audioNode.type = 'highpass';
	}

	create(params: unknown[]): void {
		const [, frequency, Q] = params as [unknown, number, number];

		this.audioNode.frequency.value = frequency ?? 1000;
		this.audioNode.Q.value = Q ?? 1;
	}

	getAudioParam(name: string): AudioParam | null {
		return match(name)
			.with('frequency', () => this.audioNode.frequency)
			.with('Q', () => this.audioNode.Q)
			.otherwise(() => null);
	}

	send(key: string, message: unknown): void {
		match([key, message])
			.with(['frequency', P.number], ([, frequency]) => {
				this.audioNode.frequency.value = frequency;
			})
			.with(['Q', P.number], ([, Q]) => {
				this.audioNode.Q.value = Q;
			});
	}
}
