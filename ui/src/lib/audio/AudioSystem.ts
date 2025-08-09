import { getAudioContext } from '@strudel/webaudio';
import type { Edge } from '@xyflow/svelte';
import Meyda from 'meyda';
import type { MeydaAnalyzer } from 'meyda/dist/esm/meyda-wa';
import { match, P } from 'ts-pattern';
import type { PsAudioNode } from './audio-node-types';
import { canAudioNodeConnect } from './audio-node-group';

export class AudioSystem {
	private static instance: AudioSystem | null = null;

	nodesById: Map<string, PsAudioNode> = new Map();

	outGain: GainNode | null = null;
	outAnalyzer: MeydaAnalyzer | null = null;

	start() {
		this.outGain = this.audioContext.createGain();
		this.outGain.gain.value = 0.8;
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
	}

	connect(sourceId: string, targetId: string) {
		const sourceEntry = this.nodesById.get(sourceId);
		const targetEntry = this.nodesById.get(targetId);

		if (!sourceEntry || !targetEntry) return;

		try {
			const isValidConnection = this.validateConnection(sourceId, targetId);

			if (!isValidConnection) {
				console.warn(`Cannot connect ${sourceId} to ${targetId}: invalid connection type`);
				return;
			}

			sourceEntry.node.connect(targetEntry.node);
		} catch (error) {
			console.error(`Failed to connect ${sourceId} to ${targetId}:`, error);
		}
	}

	validateConnection(sourceId: string, targetId: string): boolean {
		const sourceEntry = this.nodesById.get(sourceId);
		const targetEntry = this.nodesById.get(targetId);
		if (!sourceEntry || !targetEntry) return true;

		return canAudioNodeConnect(sourceEntry.type, targetEntry.type);
	}

	createOscillator(nodeId: string, type: OscillatorType, frequency: number): OscillatorNode {
		const oscillator = this.audioContext.createOscillator();
		oscillator.type = type;
		oscillator.frequency.value = frequency;

		this.nodesById.set(nodeId, { type: 'osc', node: oscillator });

		return oscillator;
	}

	// Create audio objects for object nodes
	createAudioObject(nodeId: string, objectType: string, params: string[] = []) {
		match(objectType)
			.with('osc', () => this.createOsc(nodeId, params))
			.with('gain', () => this.createGain(nodeId, params))
			.with('dac', () => this.createDac(nodeId))
			.with('+~', () => this.createAdd(nodeId));
	}

	createOsc(nodeId: string, params: string[]) {
		const freq = params[0] ? parseFloat(params[0]) : 440;

		const osc = this.audioContext.createOscillator();
		osc.frequency.value = freq;
		osc.type = 'sine';
		osc.start(0);

		this.nodesById.set(nodeId, { type: 'osc', node: osc });
	}

	createGain(nodeId: string, params: string[]) {
		const gainValue = params[0] ? parseFloat(params[0]) : 1.0;

		const gainNode = this.audioContext.createGain();
		gainNode.gain.value = gainValue;

		this.nodesById.set(nodeId, { type: 'gain', node: gainNode });
	}

	createDac(nodeId: string) {
		if (this.outGain) {
			this.nodesById.set(nodeId, { type: 'dac', node: this.outGain });
		}
	}

	createAdd(nodeId: string) {
		// For addition, we can use a GainNode with gain = 1
		// Web Audio API naturally sums multiple inputs to a node
		const addNode = this.audioContext.createGain();
		addNode.gain.value = 1.0;

		this.nodesById.set(nodeId, { type: '+~', node: addNode });
	}

	// Set parameter on existing audio object
	setParameter(nodeId: string, key: string, value: unknown) {
		const entry = this.nodesById.get(nodeId);
		if (!entry) return;

		match(entry.type)
			.with('osc', () => {
				const node = entry.node as OscillatorNode;
				match([key, value])
					.with(['frequency', P.number], ([, freq]) => {
						node.frequency.value = freq;
					})
					.with(['type', P.string], ([, type]) => {
						node.type = type as OscillatorType;
					});
			})
			.with('gain', () => {
				const node = entry.node as GainNode;
				match([key, value]).with(['gain', P.number], ([, gain]) => {
					node.gain.value = gain;
				});
			});
	}

	// Remove audio object
	removeAudioObject(nodeId: string) {
		const entry = this.nodesById.get(nodeId);

		if (entry) {
			if (entry.type === 'osc') {
				try {
					(entry.node as OscillatorNode).stop();
				} catch (error) {
					console.log(`osc ${nodeId} was already stopped:`, error);
				}
			}

			entry.node.disconnect();
		}

		this.nodesById.delete(nodeId);
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
		try {
			// Disconnect all existing connections
			for (const entry of this.nodesById.values()) {
				try {
					entry.node.disconnect();
				} catch (error) {
					console.warn('Error disconnecting node:', error);
				}
			}

			// Reconnect the output gain to destination
			if (this.outGain) {
				this.outGain.connect(this.audioContext.destination);
			}

			// Recreate connections based on edges
			for (const edge of edges) {
				this.connect(edge.source, edge.target);
			}
		} catch (error) {
			console.error('Error updating audio edges:', error);
		}
	}

	get outVolume() {
		return this.outGain?.gain?.value ?? 0;
	}

	setOutVolume(value: number) {
		if (this.outGain) {
			this.outGain.gain.value = value ?? 0;
		}
	}
}

// @ts-expect-error -- expose for debugging!
window.audioSystem = AudioSystem.getInstance();
