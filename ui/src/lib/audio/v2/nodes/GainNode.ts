import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

/**
 * GainNodeV2 implements the gain~ audio node.
 * Controls the volume/amplitude of an audio signal.
 */
export class GainNodeV2 implements AudioNodeV2 {
	static type = 'gain~';
	static group: AudioNodeGroup = 'processors';
	static description = 'Controls audio volume/amplitude';

	static inlets: ObjectInlet[] = [
		{
			name: 'in',
			type: 'signal',
			description: 'Audio signal input'
		},
		{
			name: 'gain',
			type: 'float',
			description: 'Gain value (0-1 for attenuation, >1 for amplification)',
			defaultValue: 1.0,
			isAudioParam: true,
			maxPrecision: 3
		}
	];

	static outlets: ObjectOutlet[] = [
		{ name: 'out', type: 'signal', description: 'Processed audio output' }
	];

	readonly nodeId: string;
	audioNode: GainNode;

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioNode = audioContext.createGain();
	}

	create(params: unknown[]): void {
		const [, gainValue] = params as [unknown, number];

		this.audioNode.gain.value = gainValue ?? 1.0;
	}
}
