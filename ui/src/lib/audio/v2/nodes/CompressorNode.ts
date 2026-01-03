import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

/**
 * Dynamic range compressor node.
 *
 * Reduces the dynamic range of audio signals.
 * Useful for controlling loud peaks and maintaining consistent levels.
 */
export class CompressorNode implements AudioNodeV2 {
	static type = 'compressor~';
	static group: AudioNodeGroup = 'processors';
	static description = 'Dynamic range compressor for audio signals';

	static inlets: ObjectInlet[] = [
		{
			name: 'in',
			type: 'signal',
			description: 'Signal to compress'
		},
		{
			name: 'threshold',
			type: 'float',
			description: 'The decibel value above which compression starts',
			defaultValue: -24,
			isAudioParam: true,
			minNumber: -200,
			maxNumber: 0,
			maxPrecision: 1
		},
		{
			name: 'knee',
			type: 'float',
			description: 'Decibel range above threshold for smooth transition',
			defaultValue: 30,
			isAudioParam: true,
			minNumber: 0,
			maxNumber: 40,
			maxPrecision: 1
		},
		{
			name: 'ratio',
			type: 'float',
			description: 'Amount of dB change in input for 1 dB change in output',
			defaultValue: 12,
			isAudioParam: true,
			minNumber: 0,
			maxNumber: 20,
			maxPrecision: 1
		},
		{
			name: 'attack',
			type: 'float',
			description: 'Time in seconds to reduce gain by 10dB',
			defaultValue: 0.003,
			isAudioParam: true,
			minNumber: 0,
			maxNumber: 1,
			maxPrecision: 4
		},
		{
			name: 'release',
			type: 'float',
			description: 'Time in seconds to increase gain by 10dB',
			defaultValue: 0.25,
			isAudioParam: true,
			minNumber: 0,
			maxNumber: 1,
			maxPrecision: 4
		}
	];

	static outlets: ObjectOutlet[] = [
		{
			name: 'out',
			type: 'signal',
			description: 'Compressed signal'
		}
	];

	readonly nodeId: string;
	readonly audioNode: DynamicsCompressorNode;

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioNode = audioContext.createDynamicsCompressor();
	}

	create(params: unknown[]): void {
		const [, threshold, knee, ratio, attack, release] = params as [
			unknown,
			number,
			number,
			number,
			number,
			number
		];

		this.audioNode.threshold.value = threshold ?? -24;
		this.audioNode.knee.value = knee ?? 30;
		this.audioNode.ratio.value = ratio ?? 12;
		this.audioNode.attack.value = attack ?? 0.003;
		this.audioNode.release.value = release ?? 0.25;
	}
}
