import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

/**
 * SigNode implements the sig~ (constant signal) audio node.
 * Outputs a constant signal value.
 */
export class SigNode implements AudioNodeV2 {
	static type = 'sig~';
	static group: AudioNodeGroup = 'sources';
	static description = 'Outputs a constant signal value';

	static inlets: ObjectInlet[] = [
		{
			name: 'offset',
			type: 'float',
			description: 'Constant signal value',
			defaultValue: 1.0,
			isAudioParam: true,
			maxPrecision: 3
		}
	];

	static outlets: ObjectOutlet[] = [
		{ name: 'out', type: 'signal', description: 'Constant signal output' }
	];

	readonly nodeId: string;
	readonly audioNode: ConstantSourceNode;

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioNode = audioContext.createConstantSource();
	}

	create(params: unknown[]): void {
		const [offsetValue] = params as [number];

		this.audioNode.offset.value = offsetValue ?? 1.0;
		this.audioNode.start(0);
	}

	destroy(): void {
		try {
			this.audioNode.stop();
		} catch {
			// ignore node stop errors
		}

		this.audioNode.disconnect();
	}
}
