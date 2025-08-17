import { getAudioContext } from '@strudel/webaudio';
import type { Edge } from '@xyflow/svelte';
import { match, P } from 'ts-pattern';
import type { PsAudioNode, PsAudioType } from './audio-node-types';
import { canAudioNodeConnect } from './audio-node-group';
import { objectDefinitions, type ObjectInlet } from '$lib/objects/object-definitions';
import { TimeScheduler } from './TimeScheduler';
import { isScheduledMessage } from './time-scheduling-types';

export class AudioSystem {
	private static instance: AudioSystem | null = null;

	nodesById: Map<string, PsAudioNode> = new Map();
	private timeScheduler: TimeScheduler;

	outGain: GainNode | null = null;

	constructor() {
		this.timeScheduler = new TimeScheduler(this.audioContext);
	}

	start() {
		this.outGain = this.audioContext.createGain();
		this.outGain.gain.value = 0.8;
		this.outGain.connect(this.audioContext.destination);
	}

	connect(sourceId: string, targetId: string, paramName?: string) {
		const sourceEntry = this.nodesById.get(sourceId);
		const targetEntry = this.nodesById.get(targetId);

		if (!sourceEntry || !targetEntry) return;

		try {
			const isValidConnection = this.validateConnection(sourceId, targetId, paramName);

			if (!isValidConnection) {
				console.warn(`Cannot connect ${sourceId} to ${targetId}: invalid connection type`);
				return;
			}

			if (paramName) {
				const audioParam = this.getAudioParam(targetId, paramName);

				if (audioParam) {
					sourceEntry.node.connect(audioParam);
				} else {
					console.warn(`AudioParam ${paramName} not found on node ${targetId}`);
				}
			} else {
				sourceEntry.node.connect(targetEntry.node);
			}
		} catch (error) {
			console.error(`Failed to connect ${sourceId} to ${targetId}:`, error);
		}
	}

	validateConnection(sourceId: string, targetId: string, paramName?: string): boolean {
		// If connecting to an AudioParam, allow any source to connect to any target.
		// AudioParams can accept modulation from any audio node.
		if (paramName) return true;

		const sourceEntry = this.nodesById.get(sourceId);
		const targetEntry = this.nodesById.get(targetId);
		if (!sourceEntry || !targetEntry) return true;

		// For regular node-to-node connections, use the existing validation
		return canAudioNodeConnect(sourceEntry.type, targetEntry.type);
	}

	getAudioParam(nodeId: string, paramName: string): AudioParam | null {
		const entry = this.nodesById.get(nodeId);
		if (!entry) return null;

		return match(entry.type)
			.with('osc', () => {
				const node = entry.node as OscillatorNode;

				return match(paramName)
					.with('frequency', () => node.frequency)
					.with('detune', () => node.detune)
					.otherwise(() => null);
			})
			.with('gain', () => {
				const node = entry.node as GainNode;

				return match(paramName)
					.with('gain', () => node.gain)
					.otherwise(() => null);
			})
			.otherwise(() => null);
	}

	getInletByHandle(nodeId: string, targetHandle: string | null): ObjectInlet | null {
		const audioNode = this.nodesById.get(nodeId);
		if (!audioNode || !targetHandle) return null;

		const objectDef = objectDefinitions[audioNode.type];
		if (!objectDef) return null;

		const inletIndex = parseInt(targetHandle.replace('inlet-', ''), 10);

		return objectDef.inlets[inletIndex] ?? null;
	}

	createAnalyzer(nodeId: string, params: unknown[]) {
		const [, fftSize] = params as [unknown, number];

		const analyzer = this.audioContext.createAnalyser();
		analyzer.fftSize = fftSize;

		this.nodesById.set(nodeId, { type: 'fft', node: analyzer });

		return analyzer;
	}

	// Create audio objects for object nodes
	createAudioObject(nodeId: string, objectType: PsAudioType, params: unknown[] = []) {
		match(objectType)
			.with('osc', () => this.createOsc(nodeId, params))
			.with('gain', () => this.createGain(nodeId, params))
			.with('dac', () => this.createDac(nodeId))
			.with('fft', () => this.createAnalyzer(nodeId, params))
			.with('+~', () => this.createAdd(nodeId))
			.with('mic', () => this.createMic(nodeId));
	}

	createOsc(nodeId: string, params: unknown[]) {
		const [freq, type] = params as [number, OscillatorType];

		const osc = this.audioContext.createOscillator();
		osc.frequency.value = freq;
		osc.type = type;
		osc.start(0);

		this.nodesById.set(nodeId, { type: 'osc', node: osc });
	}

	createGain(nodeId: string, params: unknown[]) {
		const [, gainValue] = params as [unknown, number];

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
		const addNode = this.audioContext.createGain();
		addNode.gain.value = 1.0;

		this.nodesById.set(nodeId, { type: '+~', node: addNode });
	}

	async createMic(nodeId: string) {
		try {
			const gainNode = this.audioContext.createGain();

			const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mediaStreamSource = this.audioContext.createMediaStreamSource(mediaStream);

			mediaStreamSource.connect(gainNode);

			this.nodesById.set(nodeId, {
				type: 'mic',
				node: gainNode,
				mediaStream,
				mediaStreamSource
			});
		} catch (error) {
			console.error('Failed to create microphone node:', error);

			// Create a silent gain node as fallback
			const gainNode = this.audioContext.createGain();
			gainNode.gain.value = 0;
			this.nodesById.set(nodeId, { type: 'mic', node: gainNode });
		}
	}

	setParameter(nodeId: string, key: string, value: unknown) {
		// TimeScheduler handles scheduled messages.
		if (isScheduledMessage(value)) {
			const audioParam = this.getAudioParam(nodeId, key);
			if (!audioParam) return;

			this.timeScheduler.processMessage(audioParam, value);
			return;
		}

		const state = this.nodesById.get(nodeId);
		if (!state) return;

		match(state.type)
			.with('osc', () => {
				const node = state.node as OscillatorNode;

				match([key, value])
					.with(['frequency', P.number], ([, freq]) => {
						node.frequency.value = freq;
					})
					.with(['detune', P.number], ([, detune]) => {
						node.detune.value = detune;
					})
					.with(['type', P.string], ([, type]) => {
						node.type = type as OscillatorType;
					});
			})
			.with('gain', () => {
				const node = state.node as GainNode;

				match([key, value]).with(['gain', P.number], ([, gain]) => {
					node.gain.value = gain;
				});
			});
	}

	// Remove audio object
	removeAudioObject(nodeId: string) {
		const entry = this.nodesById.get(nodeId);

		if (entry) {
			match(entry)
				.with({ type: 'osc' }, (osc) => {
					try {
						osc.node.stop();
					} catch (error) {
						console.log(`osc ${nodeId} was already stopped:`, error);
					}
				})
				.with({ type: 'mic' }, (mic) => {
					if (mic.mediaStreamSource) {
						mic.mediaStreamSource.disconnect();
					}

					if (mic.mediaStream) {
						mic.mediaStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
					}
				})
				.otherwise(() => {});

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

			for (const edge of edges) {
				const inlet = this.getInletByHandle(edge.target, edge.targetHandle ?? null);

				const isAudioParam = !!this.getAudioParam(edge.target, inlet?.name ?? '');

				this.connect(edge.source, edge.target, isAudioParam ? inlet?.name : undefined);
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
