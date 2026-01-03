import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { ANALYSIS_KEY } from '../constants/fft';

/**
 * FFT (Fast Fourier Transform) analysis node.
 *
 * Analyzes audio signals in the frequency domain.
 * Outputs real-time frequency and amplitude data.
 */
export class FFTNode implements AudioNodeV2 {
	static type = 'fft~';
	static group: AudioNodeGroup = 'processors';
	static description = 'Analyzes audio signals and provides frequency and amplitude data';

	static inlets: ObjectInlet[] = [
		{
			name: 'in',
			type: 'signal',
			description: 'Audio signal to analyze'
		},
		{
			name: 'fftSize',
			type: 'int',
			description: 'Size of the FFT bin. Must be a power of 2, from 32 to 32768.',
			defaultValue: 256,
			options: [32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768]
		}
	];

	static outlets: ObjectOutlet[] = [
		{
			name: ANALYSIS_KEY,
			type: ANALYSIS_KEY,
			description: 'Marker to indicate where to get the FFT data from.'
		}
	];

	readonly nodeId: string;
	readonly audioNode: AnalyserNode;

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioNode = audioContext.createAnalyser();
	}

	create(params: unknown[]): void {
		const [, fftSize] = params as [unknown, number];
		this.audioNode.fftSize = fftSize ?? 256;
	}

	send(key: string, message: unknown): void {
		if (key === 'fftSize' && typeof message === 'number') {
			this.audioNode.fftSize = message;
		}
	}
}
