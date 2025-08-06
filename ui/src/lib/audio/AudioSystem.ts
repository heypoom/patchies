import { getAudioContext } from '@strudel/webaudio';
import Meyda from 'meyda';
import type { MeydaAnalyzer } from 'meyda/dist/esm/meyda-wa';

export class AudioSystem {
	private static instance: AudioSystem | null = null;

	nodeById: Map<string, AudioNode> = new Map();

	outGain: GainNode | null = null;
	outAnalyzer: MeydaAnalyzer | null = null;

	get volume() {
		return this.outGain?.gain?.value ?? 0;
	}

	start() {
		this.outGain = this.audioContext.createGain();
		this.outGain.gain.value = 0.05;
		this.outGain.connect(this.audioContext.destination);
		this.nodeById.set('mainGain', this.outGain);

		const osc = this.createOscillator('m', 'sine', 440);
		osc.connect(this.outGain);

		this.outAnalyzer = Meyda.createMeydaAnalyzer({
			audioContext: this.audioContext,
			source: this.outGain,
			bufferSize: 512,
			featureExtractors: ['rms'],
			callback: (features) => {
				// features
			}
		});

		osc.start();
		this.outAnalyzer.start();
	}

	connect(sourceId: string, targetId: string) {
		const sourceNode = this.nodeById.get(sourceId);
		const targetNode = this.nodeById.get(targetId);

		if (!sourceNode || !targetNode) return;

		sourceNode.connect(targetNode);
	}

	createOscillator(nodeId: string, type: OscillatorType, frequency: number): OscillatorNode {
		const oscillator = this.audioContext.createOscillator();
		oscillator.type = type;
		oscillator.frequency.value = frequency;

		this.nodeById.set(nodeId, oscillator);

		return oscillator;
	}

	static getInstance(): AudioSystem {
		if (AudioSystem.instance === null) {
			AudioSystem.instance = new AudioSystem();
		}

		return AudioSystem.instance;
	}

	get audioContext(): AudioContext {
		return getAudioContext();
	}
}

// @ts-expect-error -- expose for debugging!
window.audioSystem = AudioSystem.getInstance();
