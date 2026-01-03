import { match, P } from 'ts-pattern';

import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

/**
 * DelayNodeV2 implements the delay~ audio node.
 * Creates a time-based delay effect on an audio signal.
 */
export class DelayNodeV2 implements AudioNodeV2 {
	static name = 'delay~';
	static group: AudioNodeGroup = 'processors';
	static description = 'Creates a time-based delay effect on audio';

	static inlets: ObjectInlet[] = [
		{
			name: 'in',
			type: 'signal',
			description: 'Audio signal input'
		},
		{
			name: 'time',
			type: 'float',
			description: 'Delay time in milliseconds',
			defaultValue: 0.0,
			isAudioParam: true,
			maxPrecision: 1
		}
	];

	static outlets: ObjectOutlet[] = [
		{ name: 'out', type: 'signal', description: 'Delayed audio output' }
	];

	readonly nodeId: string;
	readonly audioNode: DelayNode;

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioNode = audioContext.createDelay();
	}

	create(params: unknown[]): void {
		const [, delayTime] = params as [unknown, number];

		// Convert milliseconds to seconds
		this.audioNode.delayTime.value = Math.max(0, delayTime ?? 0) / 1000;
	}

	getAudioParam(name: string): AudioParam | null {
		return match(name)
			.with('time', () => this.audioNode.delayTime)
			.otherwise(() => null);
	}

	send(key: string, message: unknown): void {
		match([key, message]).with(['time', P.number], ([, time]) => {
			// Convert milliseconds to seconds
			this.audioNode.delayTime.value = Math.max(0, time) / 1000;
		});
	}
}
