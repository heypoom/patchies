import { getAudioContext } from '@strudel/webaudio';
import type { Edge } from '@xyflow/svelte';
import Meyda from 'meyda';
import type { MeydaAnalyzer } from 'meyda/dist/esm/meyda-wa';
import { match } from 'ts-pattern';

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

		this.outAnalyzer = Meyda.createMeydaAnalyzer({
			audioContext: this.audioContext,
			source: this.outGain,
			bufferSize: 512,
			featureExtractors: ['rms'],
			callback: () => {
				// Handle analysis features here if needed
			}
		});

		// this.outAnalyzer.start();
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

	// Create audio objects for object nodes
	createAudioObject(nodeId: string, objectType: string, params: string[] = []) {
		match(objectType)
			.with('osc', () => this.createOscillatorObject(nodeId, params))
			.with('gain', () => this.createGainObject(nodeId, params))
			.with('dac', () => this.createDacObject(nodeId, params))
			.otherwise(() => {});
	}

	createOscillatorObject(nodeId: string, params: string[]) {
		const freq = params[0] ? parseFloat(params[0]) : 440;

		const osc = this.audioContext.createOscillator();
		osc.frequency.value = freq;
		osc.type = 'sine';
		osc.start(0);

		this.nodeById.set(nodeId, osc);
	}

	createGainObject(nodeId: string, params: string[]) {
		const gainValue = params[0] ? parseFloat(params[0]) : 1.0;

		const gainNode = this.audioContext.createGain();
		gainNode.gain.value = gainValue;

		this.nodeById.set(nodeId, gainNode);
	}

	createDacObject(nodeId: string, _params: string[]) {
		// DAC connects to the main output gain, which connects to destination
		if (this.outGain) {
			this.nodeById.set(nodeId, this.outGain);
		}
	}

	// Set parameter on existing audio object
	setParameter(nodeId: string, paramName: string, value: number) {
		const node = this.nodeById.get(nodeId);
		if (!node) return;

		if (node instanceof OscillatorNode && paramName === 'frequency') {
			node.frequency.value = value;
		} else if (node instanceof GainNode && paramName === 'gain') {
			node.gain.value = value;
		}
	}

	// Remove audio object
	removeAudioObject(nodeId: string) {
		const node = this.nodeById.get(nodeId);

		if (node) {
			if (node instanceof OscillatorNode) {
				try {
					node.stop();
				} catch (error) {
					console.log(`Oscillator ${nodeId} was already stopped:`, error);
				}
			}

			node.disconnect();
		}

		this.nodeById.delete(nodeId);
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

	// Update audio connections based on edges
	updateEdges(edges: Edge[]) {
		// Disconnect all existing connections
		for (const node of this.nodeById.values()) {
			node.disconnect();
		}

		// Reconnect the output gain to destination
		if (this.outGain) {
			this.outGain.connect(this.audioContext.destination);
		}

		// Recreate connections based on edges
		for (const edge of edges) {
			this.connect(edge.source, edge.target);
		}
	}
}

// @ts-expect-error -- expose for debugging!
window.audioSystem = AudioSystem.getInstance();
