import type { Edge } from '@xyflow/svelte';
import { match } from 'ts-pattern';
// @ts-expect-error -- no typedefs
import { getAudioContext } from 'superdough';
import type { V1PatchAudioNode } from './audio-node-types';
import { canAudioNodeConnect } from './audio-node-group';
import { objectDefinitionsV1 } from '$lib/objects/object-definitions';
import { TimeScheduler } from './TimeScheduler';
import { isScheduledMessage } from './time-scheduling-types';
import { ChuckManager } from './ChuckManager';
import { CsoundManager } from './nodes/CsoundManager';
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
	private v2 = AudioService.getInstance();

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
		this.v2.start();

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
				logger.warn(`cannot connect ${sourceId} to ${targetId}: invalid connection (v1)`);
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
				if (targetEntry.type === 'csound~') {
					// input to csound~ - connect to inputNode for audio input
					sourceEntry.node.connect(targetEntry.inputNode);
				} else {
					sourceEntry.node.connect(targetEntry.node);
				}
			}
		} catch (error) {
			logger.error(`cannot connect ${sourceId} to ${targetId}: v1`, error);
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
		const v2Node = this.v2.getNodeById(nodeId);

		if (v2Node) {
			return this.v2.getAudioParamByNode(v2Node, name);
		}

		return null;
	}

	getInletByHandle(nodeId: string, targetHandle: string | null): ObjectInlet | null {
		// Check if this is a v2 node (migrated to AudioService)
		if (this.v2.getNodeById(nodeId)) {
			return this.v2.getInletByHandle(nodeId, targetHandle);
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

		if (this.v2.registry.isDefined(objectType)) {
			this.v2.createNode(nodeId, objectType, params);
			return;
		}

		match(objectType)
			.with('csound~', () => this.createCsound(nodeId, params))
			.with('chuck', () => this.createChuck(nodeId));
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
		if (this.v2.getNodeById(nodeId)) {
			this.v2.send(nodeId, key, msg);
			return;
		}

		const state = this.nodesById.get(nodeId);
		if (!state) return;

		return match(state)
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
		const v2Node = this.v2.getNodeById(nodeId);

		if (v2Node) {
			this.v2.removeNode(v2Node);
			this.nodesById.delete(nodeId);
			return;
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
