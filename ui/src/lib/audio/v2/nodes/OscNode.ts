import { match, P } from 'ts-pattern';
import type { PatchAudioNode } from '../interfaces/PatchAudioNode';
import type { PatchAudioType } from '../../audio-node-types';

const PeriodicWavePart = P.union(P.array(P.number), P.instanceOf(Float32Array));

/**
 * OscNode implements the osc~ (oscillator) audio node.
 */
export class OscNode implements PatchAudioNode {
	readonly nodeId: string;
	readonly audioNode: OscillatorNode;
	readonly type: PatchAudioType = 'osc~';

	private audioContext: AudioContext;

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioContext = audioContext;
		this.audioNode = audioContext.createOscillator();
	}

	create(params: unknown[]): void {
		const [freq, type] = params as [number, OscillatorType];

		this.audioNode.frequency.value = freq ?? 440;
		this.audioNode.type = type ?? 'sine';
		this.audioNode.start(0);
	}

	send(key: string, message: unknown): void {
		match([key, message])
			.with(['frequency', P.number], ([, freq]) => {
				this.audioNode.frequency.value = freq;
			})
			.with(['detune', P.number], ([, detune]) => {
				this.audioNode.detune.value = detune;
			})
			.with(['type', P.string], ([, type]) => {
				this.audioNode.type = type as OscillatorType;
			})
			.with(['type', [PeriodicWavePart, PeriodicWavePart]], ([, waveParts]) => {
				const [real, imag] = waveParts;

				// both real and imaginary part must be same length.
				if (real.length !== imag.length) return;

				// both real and imaginary part must be at least 2
				if (real.length < 2) return;
				if (imag.length < 2) return;

				const wave = new PeriodicWave(this.audioContext, {
					real,
					imag,
					disableNormalization: true
				});

				this.audioNode.setPeriodicWave(wave);
			})
			.otherwise(() => {
				// Unknown message, ignore
			});
	}

	destroy(): void {
		try {
			this.audioNode.stop();
		} catch (error) {
			console.log(`osc~ ${this.nodeId} was already stopped:`, error);
		}
		this.audioNode.disconnect();
	}

	getAudioParam(name: string): AudioParam | null {
		return match(name)
			.with('frequency', () => this.audioNode.frequency)
			.with('detune', () => this.audioNode.detune)
			.otherwise(() => null);
	}

	connect(target: PatchAudioNode, paramName?: string): void {
		if (paramName) {
			const audioParam = target.getAudioParam(paramName);
			if (audioParam) {
				this.audioNode.connect(audioParam);
			}
		} else {
			this.audioNode.connect(target.audioNode);
		}
	}
}
