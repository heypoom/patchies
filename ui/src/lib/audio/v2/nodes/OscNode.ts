import { match, P } from 'ts-pattern';

import type { PatchAudioNode, AudioNodeGroup } from '../interfaces/PatchAudioNode';

const PeriodicWavePart = P.union(P.array(P.number), P.instanceOf(Float32Array));

/**
 * OscNode implements the osc~ (oscillator) audio node.
 */
export class OscNode implements PatchAudioNode {
	static name = 'osc~';
	static group: AudioNodeGroup = 'sources';

	readonly nodeId: string;
	readonly audioNode: OscillatorNode;
	readonly type: string;

	private audioContext: AudioContext;

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioContext = audioContext;
		this.type = OscNode.name;
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
			});
	}

	destroy(): void {
		try {
			this.audioNode.stop();
		} catch {
			// ignore node stop errors
		}

		this.audioNode.disconnect();
	}

	getAudioParam(name: string): AudioParam | null {
		return match(name)
			.with('frequency', () => this.audioNode.frequency)
			.with('detune', () => this.audioNode.detune)
			.otherwise(() => null);
	}
}
