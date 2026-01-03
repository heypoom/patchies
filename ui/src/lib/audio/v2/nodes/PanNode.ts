import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

/**
 * PanNodeV2 implements the pan~ audio node.
 * Controls stereo panning of an audio signal (-1 = left, 0 = center, 1 = right).
 */
export class PanNodeV2 implements AudioNodeV2 {
	static type = 'pan~';
	static group: AudioNodeGroup = 'processors';
	static description = 'Controls stereo panning (-1 left to 1 right)';

	static inlets: ObjectInlet[] = [
		{
			name: 'in',
			type: 'signal',
			description: 'Audio signal input'
		},
		{
			name: 'pan',
			type: 'float',
			description: 'Pan value (-1 = left, 0 = center, 1 = right)',
			defaultValue: 0.0,
			isAudioParam: true,
			maxPrecision: 3
		}
	];

	static outlets: ObjectOutlet[] = [
		{ name: 'out', type: 'signal', description: 'Panned audio output' }
	];

	readonly nodeId: string;
	readonly audioNode: StereoPannerNode;

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioNode = audioContext.createStereoPanner();
	}

	create(params: unknown[]): void {
		const [, panValue] = params as [unknown, number];

		this.audioNode.pan.value = panValue ?? 0.0;
	}
}
