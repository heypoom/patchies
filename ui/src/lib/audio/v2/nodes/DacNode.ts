import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

/**
 * DacNode implements the dac~ (digital-to-analog converter) audio node.
 * Routes audio signals to the computer's audio output (speakers/headphones).
 *
 * Each dac~ creates its own gain node that automatically connects to the shared
 * outGain, allowing multiple dac~ nodes to exist in a patch.
 */
export class DacNode implements AudioNodeV2 {
	static name = 'dac~';
	static group: AudioNodeGroup = 'destinations';
	static description = 'Send sounds to speakers';

	static inlets: ObjectInlet[] = [
		{ name: 'in', type: 'signal', description: 'Audio signal to output' }
	];

	static outlets: ObjectOutlet[] = [];

	readonly nodeId: string;
	readonly audioNode: GainNode;

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioNode = audioContext.createGain();
		this.audioNode.gain.value = 1.0;
	}

	create(): void {}
	send(): void {}

	getAudioParam(): AudioParam | null {
		return null;
	}
}
