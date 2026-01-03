import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { match, P } from 'ts-pattern';

/**
 * WaveShaper node for distortion and waveshaping effects.
 *
 * Applies a curve to the input signal for creative distortion effects.
 */
export class WaveShaperNodeV2 implements AudioNodeV2 {
	static name = 'waveshaper~';
	static group: AudioNodeGroup = 'processors';
	static description = 'WaveShaperNode for distortion and waveshaping effects';

	static inlets: ObjectInlet[] = [
		{
			name: 'in',
			type: 'signal',
			description: 'Audio signal to process'
		},
		{
			name: 'curve',
			type: 'float[]',
			description: 'Array of numbers or Float32Array to set as waveshaper curve',
			defaultValue: [0, 1],
			maxDisplayLength: 8
		},
		{
			name: 'oversample',
			type: 'string',
			description: 'Oversample setting: "none", "2x", or "4x"',
			defaultValue: 'none',
			options: ['none', '2x', '4x']
		}
	];

	static outlets: ObjectOutlet[] = [
		{
			name: 'out',
			type: 'signal',
			description: 'Waveshaped signal'
		}
	];

	readonly nodeId: string;
	readonly audioNode: WaveShaperNode;

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioNode = audioContext.createWaveShaper();
	}

	create(params: unknown[]): void {
		const [, curve, oversample] = params as [unknown, unknown, string];

		// Set curve if provided
		if (curve instanceof Float32Array) {
			this.audioNode.curve = curve as Float32Array<ArrayBuffer>;
		} else if (Array.isArray(curve)) {
			this.audioNode.curve = new Float32Array(Array.from(curve as number[]));
		}

		// Set oversample mode
		if (typeof oversample === 'string' && ['none', '2x', '4x'].includes(oversample)) {
			this.audioNode.oversample = oversample as OverSampleType;
		}
	}

	send(key: string, message: unknown): void {
		match([key, message])
			.with(['curve', P.constructor(Float32Array)], ([, m]) => {
				this.audioNode.curve = m as Float32Array<ArrayBuffer>;
			})
			.with(['curve', P.array(P.number)], ([, m]) => {
				this.audioNode.curve = new Float32Array(Array.from(m as number[]));
			})
			.with(
				[
					'oversample',
					P.when((m) => typeof m === 'string' && ['none', '2x', '4x'].includes(m as string))
				],
				([, m]) => {
					this.audioNode.oversample = m as OverSampleType;
				}
			);
	}
}
