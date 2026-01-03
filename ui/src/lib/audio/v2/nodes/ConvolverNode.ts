import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

/**
 * Convolver node for reverb and acoustic modeling.
 *
 * Applies an impulse response to create reverb and spatial effects.
 */
export class ConvolverNodeV2 implements AudioNodeV2 {
	static name = 'convolver~';
	static group: AudioNodeGroup = 'processors';
	static description = 'ConvolverNode for reverb and acoustic modeling using impulse responses';

	static inlets: ObjectInlet[] = [
		{ name: 'in', type: 'signal' },
		{
			name: 'buffer',
			type: 'message',
			description: 'AudioBuffer for impulse response'
		},
		{
			name: 'normalize',
			type: 'bool',
			description: 'Whether to normalize the impulse response',
			defaultValue: true
		}
	];

	static outlets: ObjectOutlet[] = [{ name: 'out', type: 'signal' }];

	readonly nodeId: string;
	readonly audioNode: ConvolverNode;

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioNode = audioContext.createConvolver();
	}

	create(params: unknown[]): void {
		const [, , normalize] = params as [unknown, unknown, boolean];
		this.audioNode.normalize = normalize ?? true;
	}

	send(key: string, message: unknown): void {
		if (key === 'buffer' && message instanceof AudioBuffer) {
			this.audioNode.buffer = message;
		}

		if (key === 'normalize' && typeof message === 'boolean') {
			this.audioNode.normalize = message;
		}
	}
}
