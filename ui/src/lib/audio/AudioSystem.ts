import type { Edge } from '@xyflow/svelte';
import { match, P } from 'ts-pattern';
// @ts-expect-error -- no typedefs
import { getAudioContext } from 'superdough';
import type { V1PatchAudioNode } from './audio-node-types';
import { canAudioNodeConnect } from './audio-node-group';
import { objectDefinitionsV1 } from '$lib/objects/object-definitions';
import { TimeScheduler } from './TimeScheduler';
import { isScheduledMessage } from './time-scheduling-types';
import { ChuckManager } from './ChuckManager';
import { ToneManager } from './ToneManager';
import { ElementaryAudioManager } from './ElementaryAudioManager';
import { CsoundManager } from './nodes/CsoundManager';

import workletUrl from './expression-processor.ts?worker&url';
import dspWorkletUrl from './dsp-processor.ts?worker&url';
import { hasSomeAudioNode } from '../../stores/canvas.store';
import { handleToPortIndex } from '$lib/utils/get-edge-types';
import { AudioService } from './v2/AudioService';
import { registerAudioNodes } from './v2/nodes';
import { logger } from '$lib/utils/logger';
import type { ObjectInlet } from '$lib/objects/v2/object-metadata';

export class AudioSystem {
	private static instance: AudioSystem | null = null;

	nodesById: Map<string, V1PatchAudioNode> = new Map();
	private timeScheduler: TimeScheduler;
	private workletInitialized = false;
	private dspWorkletInitialized = false;

	outGain: GainNode | null = null;

	constructor() {
		this.timeScheduler = new TimeScheduler(this.audioContext);
	}

	get audioContext(): AudioContext {
		return getAudioContext();
	}

	start() {
		// Register v2 audio nodes
		registerAudioNodes();

		// Initialize v2 AudioService
		const audioService = AudioService.getInstance();
		audioService.start();

		this.outGain = this.audioContext.createGain();
		this.outGain.gain.value = 0.8;
		this.outGain.connect(this.audioContext.destination);
	}

	private connect(sourceId: string, targetId: string, paramName?: string) {
		const sourceEntry = this.nodesById.get(sourceId);
		const targetEntry = this.nodesById.get(targetId);

		if (!sourceEntry || !targetEntry) return;

		try {
			const isValidConnection = this.validateConnection(sourceId, targetId, paramName);

			if (!isValidConnection) {
				logger.warn(`cannot connect ${sourceId} to ${targetId}`);
				return;
			}

			if (paramName) {
				const audioParam = this.getAudioParam(targetId, paramName);

				if (audioParam) {
					sourceEntry.node.connect(audioParam);
				} else {
					logger.warn(`audio parameter ${paramName} does not exist on ${targetId}`);
				}
			} else {
				if (targetEntry.type === 'sampler~') {
					// input to sampler~ - connect to destination for recording
					sourceEntry.node.connect(targetEntry.destinationNode);
				} else if (targetEntry.type === 'tone~') {
					// input to tone~ - connect to inputNode for audio input
					sourceEntry.node.connect(targetEntry.inputNode);
				} else if (targetEntry.type === 'elem~') {
					// input to elem~ - connect to inputNode for audio input
					sourceEntry.node.connect(targetEntry.inputNode);
				} else if (targetEntry.type === 'csound~') {
					// input to csound~ - connect to inputNode for audio input
					sourceEntry.node.connect(targetEntry.inputNode);
				} else {
					sourceEntry.node.connect(targetEntry.node);
				}
			}
		} catch (error) {
			logger.error(`cannot connect ${sourceId} to ${targetId}`, error);
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
		const audioService = AudioService.getInstance();
		const v2Node = audioService.getNode(nodeId);

		if (audioService.isNodeDefined(v2Node)) {
			return audioService.getAudioParamByNode(v2Node, name);
		}

		return null;
	}

	getInletByHandle(nodeId: string, targetHandle: string | null): ObjectInlet | null {
		// Check if this is a v2 node (migrated to AudioService)
		const audioService = AudioService.getInstance();
		const v2Node = audioService.getNode(nodeId);
		if (audioService.isNodeDefined(v2Node)) {
			return audioService.getInletByHandle(nodeId, targetHandle);
		}

		// Fallback to v1 logic
		const audioNode = this.nodesById.get(nodeId);
		if (!audioNode || !targetHandle) return null;

		const objectDef = objectDefinitionsV1[audioNode.type];
		if (!objectDef) return null;

		const inletIndex = handleToPortIndex(targetHandle);
		if (inletIndex === null || isNaN(inletIndex)) return null;

		return objectDef.inlets?.[inletIndex] ?? null;
	}

	// Create audio objects for object nodes
	createAudioObject(nodeId: string, objectType: string, params: unknown[] = []) {
		hasSomeAudioNode.set(true);

		// Check if this node type has been migrated to v2
		const audioService = AudioService.getInstance();
		if (audioService.isNodeTypeDefined(objectType)) {
			const node = audioService.createNode(nodeId, objectType, params);
			if (node) {
				// Store in v1 map for backwards compatibility
				// Type assertion is safe because node.audioNode matches the node type
				this.nodesById.set(nodeId, { type: objectType, node: node.audioNode } as V1PatchAudioNode);
			}
			return;
		}

		match(objectType)
			.with('expr~', () => this.createExpr(nodeId, params))
			.with('dsp~', () => this.createDsp(nodeId, params))
			.with('tone~', () => this.createTone(nodeId, params))
			.with('elem~', () => this.createElementary(nodeId, params))
			.with('csound~', () => this.createCsound(nodeId, params))
			.with('chuck', () => this.createChuck(nodeId));
	}

	async initExprWorklet() {
		if (this.workletInitialized) return;

		try {
			const processorUrl = new URL(workletUrl, import.meta.url);
			await this.audioContext.audioWorklet.addModule(processorUrl.href);
			this.workletInitialized = true;
		} catch (error) {
			logger.error('cannot setup expression processor worklet:', error);
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

	async initDspWorklet() {
		if (this.dspWorkletInitialized) return;

		try {
			const processorUrl = new URL(dspWorkletUrl, import.meta.url);
			await this.audioContext.audioWorklet.addModule(processorUrl.href);
			this.dspWorkletInitialized = true;
		} catch (error) {
			console.error('Failed to initialize DSP processor worklet:', error);
		}
	}

	async createDsp(nodeId: string, params: unknown[]) {
		await this.initDspWorklet();

		if (!this.dspWorkletInitialized) {
			console.error('DSP worklet not initialized');
			return;
		}

		const [, code] = params as [unknown, string];

		try {
			const workletNode = new AudioWorkletNode(this.audioContext, 'dsp-processor');

			if (code) workletNode.port.postMessage({ type: 'set-code', code: code });

			this.nodesById.set(nodeId, { type: 'dsp~', node: workletNode });
		} catch (error) {
			console.error('Failed to create DSP node:', error);
		}
	}

	async createTone(nodeId: string, params: unknown[]) {
		const [, code] = params as [unknown, string];

		try {
			const outputNode = new GainNode(this.audioContext);
			const inputNode = new GainNode(this.audioContext);
			const toneManager = new ToneManager(nodeId, this.audioContext, outputNode, inputNode);

			if (code) {
				await toneManager.handleMessage('code', code);
			}

			this.nodesById.set(nodeId, {
				type: 'tone~',
				node: outputNode,
				inputNode,
				toneManager
			});
		} catch (error) {
			console.error('Failed to create Tone node:', error);
		}
	}

	async createElementary(nodeId: string, params: unknown[]) {
		const [, code] = params as [unknown, string];

		try {
			const outputNode = new GainNode(this.audioContext);
			const inputNode = new GainNode(this.audioContext);

			const elementaryManager = new ElementaryAudioManager(
				nodeId,
				this.audioContext,
				outputNode,
				inputNode
			);

			if (code) {
				await elementaryManager.handleMessage('code', code);
			}

			this.nodesById.set(nodeId, {
				type: 'elem~',
				node: outputNode,
				inputNode,
				elementaryManager
			});
		} catch (error) {
			console.error('Failed to create Elementary node:', error);
		}
	}

	async createCsound(nodeId: string, params: unknown[]) {
		const [, code] = params as [unknown, string];

		try {
			const inputNode = new GainNode(this.audioContext);
			const outputNode = new GainNode(this.audioContext);
			const csoundManager = new CsoundManager(nodeId, this.audioContext, outputNode, inputNode);

			await csoundManager.initialize();

			if (code) {
				await csoundManager.handleMessage('code', code);
			}

			this.nodesById.set(nodeId, {
				type: 'csound~',
				node: outputNode,
				inputNode,
				csoundManager
			});
		} catch (error) {
			console.error('Failed to create Csound node:', error);
		}
	}

	async createChuck(nodeId: string) {
		const gainNode = new GainNode(this.audioContext);

		const chuckManager = new ChuckManager(nodeId, this.audioContext, gainNode);
		chuckManager.handleMessage('init', null);

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

		// Check if this is a v2 node (migrated to AudioService)
		const audioService = AudioService.getInstance();
		const v2Node = audioService.getNode(nodeId);

		if (audioService.isNodeDefined(v2Node)) {
			audioService.send(nodeId, key, msg);
			return;
		}

		const state = this.nodesById.get(nodeId);
		if (!state) return;

		return match(state)
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
			.with({ type: 'dsp~' }, ({ node }) => {
				match([key, msg])
					.with(['code', P.string], ([, code]) => {
						node.port.postMessage({ type: 'set-code', code: code });
					})
					.with(['inletValues', P.array(P.any)], ([, values]) => {
						node.port.postMessage({ type: 'set-inlet-values', values: Array.from(values) });
					})
					.with(['messageInlet', P.any], ([, messageData]) => {
						const data = messageData as { inletIndex: number; message: unknown; meta: unknown };

						node.port.postMessage({
							type: 'message-inlet',
							message: data.message,
							meta: data.meta
						});
					});
			})
			.with({ type: 'tone~' }, async (state) => {
				await state.toneManager?.handleMessage(key, msg);
			})
			.with({ type: 'elem~' }, async (state) => {
				await state.elementaryManager?.handleMessage(key, msg);
			})
			.with({ type: 'csound~' }, async (state) => {
				await state.csoundManager?.handleMessage(key, msg);
			})
			.with({ type: 'chuck' }, async (state) => {
				await state.chuckManager?.handleMessage(key, msg);
			})
			.otherwise(() => null);
	}

	// Remove audio object
	removeAudioObject(nodeId: string) {
		// Check if this is a v2 node (migrated to AudioService)
		const audioService = AudioService.getInstance();
		const v2Node = audioService.getNode(nodeId);

		if (audioService.isNodeDefined(v2Node)) {
			audioService.removeNode(v2Node);
			this.nodesById.delete(nodeId);
		}

		const entry = this.nodesById.get(nodeId);

		if (entry) {
			match(entry)
				.with({ type: 'chuck' }, (entry) => {
					entry.chuckManager?.destroy();
				})
				.with({ type: 'csound~' }, (entry) => {
					entry.csoundManager?.destroy();
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

if (typeof window !== 'undefined') {
	// @ts-expect-error -- expose for debugging!
	window.audioSystem = AudioSystem.getInstance();
}
