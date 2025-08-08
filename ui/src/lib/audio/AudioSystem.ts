import { getAudioContext } from '@strudel/webaudio';
import type { Edge } from '@xyflow/svelte';
import Meyda from 'meyda';
import type { MeydaAnalyzer } from 'meyda/dist/esm/meyda-wa';
import { match, P } from 'ts-pattern';

export class AudioSystem {
	private static instance: AudioSystem | null = null;

	nodeById: Map<string, AudioNode> = new Map();
	nodeTypes: Map<string, string> = new Map(); // Track node types by ID

	outGain: GainNode | null = null;
	outAnalyzer: MeydaAnalyzer | null = null;

	start() {
		this.outGain = this.audioContext.createGain();
		this.outGain.gain.value = 0.5;
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
		const sourceNode = this.nodeById.get(sourceId);
		const targetNode = this.nodeById.get(targetId);

		if (!sourceNode || !targetNode) return;

		try {
			const isValidConnection = this.validateConnection(sourceId, targetId);

			if (!isValidConnection) {
				console.warn(`Cannot connect ${sourceId} to ${targetId}: invalid connection type`);
				return;
			}

			sourceNode.connect(targetNode);
		} catch (error) {
			console.error(`Failed to connect ${sourceId} to ${targetId}:`, error);
		}
	}

	validateConnection(sourceId: string, targetId: string): boolean {
		const sourceType = this.nodeTypes.get(sourceId);
		const targetType = this.nodeTypes.get(targetId);

		if (!sourceType || !targetType) {
			// Allow connections for unknown types (might be built-in nodes like mainGain)
			return true;
		}

		// Categorize node types
		const getNodeCategory = (nodeType: string) => {
			const categories = {
				sources: ['osc'], // Generate audio
				processors: ['gain', '+~'], // Process audio
				destinations: ['dac'] // Output audio
			};

			for (const [category, types] of Object.entries(categories)) {
				if (types.includes(nodeType)) return category;
			}
			return 'unknown';
		};

		const sourceCategory = getNodeCategory(sourceType);
		const targetCategory = getNodeCategory(targetType);

		const canConnect = match({ source: sourceCategory, target: targetCategory })
			.with({ source: 'sources', target: 'sources' }, () => false) // Sources can't connect to sources
			.with({ source: 'sources', target: 'processors' }, () => true) // Sources to processors
			.with({ source: 'sources', target: 'destinations' }, () => true) // Sources to destinations
			.with({ source: 'processors', target: 'sources' }, () => false) // Can't connect to sources
			.with({ source: 'processors', target: 'processors' }, () => true) // Processors can chain
			.with({ source: 'processors', target: 'destinations' }, () => true) // Processors to destinations
			.otherwise(() => true); // Allow unknown combinations by default

		return canConnect;
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
			.with('osc', () => this.createOsc(nodeId, params))
			.with('gain', () => this.createGain(nodeId, params))
			.with('dac', () => this.createDac(nodeId))
			.with('+~', () => this.createAdd(nodeId))
			.otherwise(() => {});
	}

	createOsc(nodeId: string, params: string[]) {
		const freq = params[0] ? parseFloat(params[0]) : 440;

		const osc = this.audioContext.createOscillator();
		osc.frequency.value = freq;
		osc.type = 'sine';
		osc.start(0);

		this.nodeById.set(nodeId, osc);
		this.nodeTypes.set(nodeId, 'osc');
	}

	createGain(nodeId: string, params: string[]) {
		const gainValue = params[0] ? parseFloat(params[0]) : 1.0;

		const gainNode = this.audioContext.createGain();
		gainNode.gain.value = gainValue;

		this.nodeById.set(nodeId, gainNode);
		this.nodeTypes.set(nodeId, 'gain');
	}

	createDac(nodeId: string) {
		if (this.outGain) {
			this.nodeById.set(nodeId, this.outGain);
			this.nodeTypes.set(nodeId, 'dac');
		}
	}

	createAdd(nodeId: string) {
		// For addition, we can use a GainNode with gain = 1
		// Web Audio API naturally sums multiple inputs to a node
		const addNode = this.audioContext.createGain();
		addNode.gain.value = 1.0;

		this.nodeById.set(nodeId, addNode);
		this.nodeTypes.set(nodeId, '+~');
	}

	// Set parameter on existing audio object
	setParameter(nodeId: string, key: string, value: unknown) {
		const node = this.nodeById.get(nodeId);
		if (!node) return;

		if (node instanceof OscillatorNode) {
			match([key, value])
				.with(['frequency', P.number], ([, freq]) => {
					node.frequency.value = freq;
				})
				.with(['type', P.string], ([, type]) => {
					node.type = type as OscillatorType;
				});
		}

		if (node instanceof GainNode && key === 'gain') {
			match([key, value]).with(['gain', P.number], ([, gain]) => {
				node.gain.value = gain;
			});
		}
	}

	// Remove audio object
	removeAudioObject(nodeId: string) {
		const node = this.nodeById.get(nodeId);
		const nodeType = this.nodeTypes.get(nodeId);

		if (node) {
			if (nodeType === 'osc') {
				try {
					(node as OscillatorNode).stop();
				} catch (error) {
					console.log(`osc ${nodeId} was already stopped:`, error);
				}
			}

			node.disconnect();
		}

		this.nodeById.delete(nodeId);
		this.nodeTypes.delete(nodeId);
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
			for (const node of this.nodeById.values()) {
				try {
					node.disconnect();
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
