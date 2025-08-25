import { getAudioContext } from '@strudel/webaudio';
import type { Edge } from '@xyflow/svelte';
import { match, P } from 'ts-pattern';
import type { PsAudioNode, PsAudioType } from './audio-node-types';
import { canAudioNodeConnect } from './audio-node-group';
import { objectDefinitions, type ObjectInlet } from '$lib/objects/object-definitions';
import { TimeScheduler } from './TimeScheduler';
import { isScheduledMessage } from './time-scheduling-types';
import { ChuckManager } from './ChuckManager';

export class AudioSystem {
	private static instance: AudioSystem | null = null;

	nodesById: Map<string, PsAudioNode> = new Map();
	private timeScheduler: TimeScheduler;
	private workletInitialized = false;

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

	getAudioParam(nodeId: string, name: string): AudioParam | null {
		const entry = this.nodesById.get(nodeId);
		if (!entry) return null;

		return match(entry)
			.with({ type: 'osc' }, ({ node }) =>
				match(name)
					.with('frequency', () => node.frequency)
					.with('detune', () => node.detune)
					.otherwise(() => null)
			)
			.with({ type: 'gain' }, ({ node }) =>
				match(name)
					.with('gain', () => node.gain)
					.otherwise(() => null)
			)
			.with({ type: P.union('lpf', 'hpf', 'bpf') }, ({ node }) =>
				match(name)
					.with('frequency', () => node.frequency)
					.with('Q', () => node.Q)
					.otherwise(() => null)
			)
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
			.with('mic', () => this.createMic(nodeId))
			.with('lpf', () => this.createLpf(nodeId, params))
			.with('hpf', () => this.createHpf(nodeId, params))
			.with('bpf', () => this.createBpf(nodeId, params))
			.with('expr~', () => this.createExpr(nodeId, params))
			.with('chuck', () => this.createChuck(nodeId));
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
		const node = this.audioContext.createGain();
		this.nodesById.set(nodeId, { type: 'mic', node });

		this.restartMic(nodeId);
	}

	createLpf(nodeId: string, params: unknown[]) {
		const [, frequency, Q] = params as [unknown, number, number];

		const filter = this.audioContext.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.value = frequency;
		filter.Q.value = Q;

		this.nodesById.set(nodeId, { type: 'lpf', node: filter });
	}

	createHpf(nodeId: string, params: unknown[]) {
		const [, frequency, Q] = params as [unknown, number, number];

		const filter = this.audioContext.createBiquadFilter();
		filter.type = 'highpass';
		filter.frequency.value = frequency;
		filter.Q.value = Q;

		this.nodesById.set(nodeId, { type: 'hpf', node: filter });
	}

	createBpf(nodeId: string, params: unknown[]) {
		const [, frequency, Q] = params as [unknown, number, number];

		const filter = this.audioContext.createBiquadFilter();
		filter.type = 'bandpass';
		filter.frequency.value = frequency;
		filter.Q.value = Q;

		this.nodesById.set(nodeId, { type: 'bpf', node: filter });
	}

	async initExprWorklet() {
		if (this.workletInitialized) return;

		try {
			const processorUrl = new URL('/src/lib/audio/expression-processor.ts', import.meta.url);
			await this.audioContext.audioWorklet.addModule(processorUrl.href);
			this.workletInitialized = true;
		} catch (error) {
			console.error('Failed to initialize expression processor worklet:', error);
		}
	}

	async createExpr(nodeId: string, params: unknown[]) {
		await this.initExprWorklet();

		if (!this.workletInitialized) {
			console.error('Expression worklet not initialized');
			return;
		}

		const [, expression] = params as [unknown, string];

		try {
			const workletNode = new AudioWorkletNode(this.audioContext, 'expression-processor');

			if (expression) {
				workletNode.port.postMessage({
					type: 'set-expression',
					expression: expression
				});
			}

			this.nodesById.set(nodeId, { type: 'expr~', node: workletNode });
		} catch (error) {
			console.error('Failed to create expression node:', error);
		}
	}

	async createChuck(nodeId: string) {
		const gainNode = new GainNode(this.audioContext);
		const chuckManager = new ChuckManager(this.audioContext, gainNode);

		this.nodesById.set(nodeId, {
			type: 'chuck',
			node: gainNode,
			chuckManager
		});
	}

	send(nodeId: string, key: string, msg: unknown) {
		// TimeScheduler handles scheduled messages.
		if (isScheduledMessage(msg)) {
			const audioParam = this.getAudioParam(nodeId, key);
			if (!audioParam) return;

			this.timeScheduler.processMessage(audioParam, msg);
			return;
		}

		const state = this.nodesById.get(nodeId);
		if (!state) return;

		match(state)
			.with({ type: 'osc' }, ({ node }) => {
				match([key, msg])
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
			.with({ type: 'gain' }, ({ node }) => {
				match([key, msg]).with(['gain', P.number], ([, gain]) => {
					node.gain.value = gain;
				});
			})
			.with({ type: P.union('lpf', 'hpf', 'bpf') }, ({ node }) => {
				match([key, msg])
					.with(['frequency', P.number], ([, freq]) => {
						node.frequency.value = freq;
					})
					.with(['Q', P.number], ([, q]) => {
						node.Q.value = q;
					});
			})
			.with({ type: 'mic' }, () => {
				match(msg).with({ type: 'bang' }, () => {
					this.restartMic(nodeId);
				});
			})
			.with({ type: 'expr~' }, ({ node }) => {
				match([key, msg])
					.with(['expression', P.string], ([, expression]) => {
						node.port.postMessage({
							type: 'set-expression',
							expression: expression
						});
					})
					.with(['inletValues', P.array(P.number)], ([, values]) => {
						node.port.postMessage({
							type: 'set-inlet-values',
							values: Array.from(values)
						});
					});
			})
			.with({ type: 'chuck' }, async (state) => {
				await state.chuckManager?.handleMessage(key, msg);
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
				.with({ type: 'chuck' }, (entry) => {
					entry.chuckManager?.destroy();
				})
				.otherwise(() => {});

			entry.node.disconnect();
		}

		this.nodesById.delete(nodeId);
	}

	async restartMic(nodeId: string) {
		const mic = this.nodesById.get(nodeId);
		if (!mic || mic.type !== 'mic') return;

		// Clean up existing mic resources
		if (mic.mediaStreamSource) {
			mic.mediaStreamSource.disconnect();
		}

		if (mic.mediaStream) {
			mic.mediaStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const streamSource = this.audioContext.createMediaStreamSource(stream);

			streamSource.connect(mic.node);

			Object.assign(mic, {
				mediaStream: stream,
				mediaStreamSource: streamSource
			});

			this.nodesById.set(nodeId, mic);
		} catch (error) {
			console.error('Failed to restart microphone:', error);
		}
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
