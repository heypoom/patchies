import type { Edge } from '@xyflow/svelte';
import type { AudioNodeV2 } from './interfaces/audio-nodes';
import type { ObjectInlet } from '$lib/objects/v2/object-metadata';
import { canAudioNodeConnect } from '../audio-node-group';
import { handleToPortIndex } from '$lib/utils/get-edge-types';
import { validateGroupConnection } from './audio-helpers';
import { logger } from '$lib/utils/logger';
import { getAudioParamValue, setAudioParamValue } from './audio-param-helpers';
import { AudioRegistry } from '$lib/registry/AudioRegistry';
import { TimeScheduler } from '../TimeScheduler';
import { isScheduledMessage } from '../time-scheduling-types';
import { registerAudioNodes } from './nodes';
import { getObjectType } from '$lib/objects/get-type';
import { hasSomeAudioNode } from '../../../stores/canvas.store';

/**
 * AudioService provides shared audio logic for the v2 audio system.
 * Manages node registry, connections, and edge updates.
 */
export class AudioService {
	private static instance: AudioService | null = null;

	/** Reference to registry of audio nodes */
	registry = AudioRegistry.getInstance();

	/** Mapping of active audio nodes */
	private nodesById: Map<string, AudioNodeV2> = new Map();

	/** Output gain node for audio output */
	outGain: GainNode | null = null;

	/** Scheduler for time-based audio parameter messages */
	private timeScheduler: TimeScheduler | null = null;

	/** Our own AudioContext instance */
	private audioContext: AudioContext | null = null;

	getAudioContext(): AudioContext {
		if (!this.audioContext) {
			this.audioContext = new AudioContext({ latencyHint: 'interactive' });
		}

		return this.audioContext;
	}

	/** Create the output gain node and connect it to the destination. */
	start(): void {
		const audioContext = this.getAudioContext();
		this.outGain = audioContext.createGain();
		this.outGain.gain.value = 0.8;
		this.outGain.connect(audioContext.destination);
		this.timeScheduler = new TimeScheduler(audioContext);
	}

	/** Removes a node from the graph. */
	removeNode(node: AudioNodeV2): void {
		if (node.destroy) {
			node.destroy();
		} else {
			node.audioNode?.disconnect();
		}

		this.nodesById.delete(node.nodeId);
	}

	getNodeById(nodeId: string): AudioNodeV2 | null {
		return this.nodesById.get(nodeId) ?? null;
	}

	/**
	 * Get an AudioParam from a node, using the node's implementation or a default fallback.
	 * The default implementation looks for AudioParam properties on the audioNode
	 * that are marked as isAudioParam in the node's inlets definition.
	 *
	 * This is called by AudioSystem when processing scheduled messages for V2 nodes.
	 */
	getAudioParamByNode(node: AudioNodeV2, paramName: string): AudioParam | null {
		if (node.getAudioParam) {
			return node.getAudioParam(paramName);
		}

		// Get the audio param value by default
		const nodeType = getObjectType(node);
		const nodeClass = this.registry.get(nodeType);

		if (node.audioNode && nodeClass?.inlets) {
			return getAudioParamValue(paramName, node.audioNode, nodeClass.inlets);
		}

		return null;
	}

	/**
	 * Send a message to a node by ID, using the node's implementation or a default fallback.
	 * The default implementation routes numeric messages to AudioParam properties
	 * that are marked as isAudioParam in the node's inlets definition.
	 *
	 * Scheduled messages (set/trigger/release) are handled by the TimeScheduler for precise audio-rate timing.
	 *
	 * @param nodeId - The ID of the node to send the message to
	 * @param key - The parameter or message key
	 * @param message - The message value
	 */
	send(nodeId: string, key: string, message: unknown): void {
		const node = this.nodesById.get(nodeId);

		if (!node) {
			return;
		}

		// Handle scheduled messages via TimeScheduler for precise timing
		if (isScheduledMessage(message)) {
			const audioParam = this.getAudioParamByNode(node, key);
			if (audioParam && this.timeScheduler) {
				this.timeScheduler.processMessage(audioParam, message);
			}
			return;
		}

		if (node.send) {
			node.send(key, message);
			return;
		}

		const nodeClass = this.registry.get(getObjectType(node));

		// Set the audio parameter value by default
		if (node.audioNode && nodeClass?.inlets) {
			setAudioParamValue(key, message, node.audioNode, nodeClass.inlets);
		}
	}

	/**
	 * Get all registered v2 node names.
	 * @returns Array of node type identifiers
	 */
	getAllNodeNames(): string[] {
		return this.registry.getNodeTypes();
	}

	/**
	 * Get an inlet definition by handle.
	 */
	getInletByHandle(nodeId: string, targetHandle: string | null): ObjectInlet | null {
		const audioNode = this.nodesById.get(nodeId);
		if (!audioNode || !targetHandle) {
			return null;
		}

		const inletIndex = handleToPortIndex(targetHandle);

		if (inletIndex === null || isNaN(inletIndex)) {
			return null;
		}

		const nodeClass = this.registry.get(getObjectType(audioNode));
		if (!nodeClass?.inlets) {
			return null;
		}

		return nodeClass.inlets[inletIndex] ?? null;
	}

	/**
	 * Update audio connections based on object graph's edges.
	 */
	updateEdges(edges: Edge[]): void {
		try {
			// Disconnect all existing connections
			for (const node of this.nodesById.values()) {
				try {
					node.audioNode?.disconnect();
				} catch (error) {
					logger.warn(`cannot disconnect audio node ${node.nodeId}:`, error);
				}
			}

			// Reconnect the output gain to destination
			if (this.outGain) {
				this.outGain.connect(this.getAudioContext().destination);
			}

			// Connect destination nodes (i.e. dac~) to device outputs
			for (const node of this.nodesById.values()) {
				const group = this.registry.get(getObjectType(node))?.group;

				if (this.outGain && group === 'destinations') {
					try {
						node.audioNode?.connect(this.outGain);
					} catch (error) {
						logger.warn(`cannot connect to device's audio output`, error);
					}
				}
			}

			for (const edge of edges) {
				this.connectByEdge(edge);
			}
		} catch (error) {
			logger.error('cannot update audio edges:', error);
		}
	}

	/**
	 * Get output volume.
	 */
	get outVolume(): number {
		return this.outGain?.gain?.value ?? 0;
	}

	/**
	 * Set output volume.
	 */
	setOutVolume(value: number): void {
		if (this.outGain) {
			this.outGain.gain.value = value ?? 0;
		}
	}

	/**
	 * Create a node by type.
	 * @param nodeId - Unique identifier for the node
	 * @param nodeType - The type of node to create
	 * @param params - Array of parameters for the node
	 * @returns The created node instance, or null if type not defined
	 */
	async createNode(
		nodeId: string,
		nodeType: string,
		params: unknown[] = []
	): Promise<AudioNodeV2 | null> {
		const NodeClass = this.registry.get(nodeType);

		if (!NodeClass) {
			logger.warn(`audio node "${nodeType}" is not defined`);
			return null;
		}

		const audioContext = this.getAudioContext();
		hasSomeAudioNode.set(true);

		const node = new NodeClass(nodeId, audioContext);
		this.nodesById.set(node.nodeId, node);

		try {
			await node.create?.(params);
		} catch (error) {
			logger.error(`cannot create node ${nodeType}`, error);
		}

		return node;
	}

	/**
	 * Connect two nodes together via an edge.
	 * Handles validation, node's custom connect() methods, and multi-channel routing.
	 */
	private connectByEdge(edge: Edge): void {
		const sourceNode = this.nodesById.get(edge.source);
		const targetNode = this.nodesById.get(edge.target);

		// skip edges if source or target is not in nodesById
		if (!sourceNode || !targetNode) {
			return;
		}

		const inlet = this.getInletByHandle(edge.target, edge.targetHandle ?? null);
		const isAudioParam = !!this.getAudioParamByNode(targetNode, inlet?.name ?? '');

		const paramName = isAudioParam ? inlet?.name : undefined;

		// Validate whether the connection is allowed.
		// If the connection is to an audio param, we always let the connection through.
		if (!paramName && !this.canConnect(edge.source, edge.target)) {
			logger.warn(`cannot connect ${edge.source} to ${edge.target}: invalid connection (v2)`);
			return;
		}

		// For nodes with custom connect logic:
		// - Source nodes (e.g., split~) may have custom logic for how to output to targets
		// - Target nodes (e.g., sampler~) may have custom logic for how to receive input
		// Pass both handles so they can route to specific channels
		if (sourceNode.connect) {
			sourceNode.connect(
				targetNode,
				paramName,
				edge.sourceHandle ?? undefined,
				edge.targetHandle ?? undefined
			);
		} else if (targetNode.connectFrom) {
			// If target has special input handling, call it with the source
			targetNode.connectFrom(
				sourceNode,
				paramName,
				edge.sourceHandle ?? undefined,
				edge.targetHandle ?? undefined
			);
		} else {
			this.defaultConnect(sourceNode, targetNode, paramName);
		}
	}

	/**
	 * Default implementation for connecting nodes.
	 * Used when a node doesn't implement its own connect method.
	 */
	private defaultConnect(source: AudioNodeV2, target: AudioNodeV2, paramName?: string): void {
		if (!paramName) {
			if (target.audioNode) {
				source.audioNode?.connect(target.audioNode);
			}

			return;
		}

		const audioParam = this.getAudioParamByNode(target, paramName);

		if (audioParam) {
			source.audioNode?.connect(audioParam);
		}
	}

	/** Validate if a connection is allowed between the two nodes. */
	private canConnect(sourceNodeId: string, targetNodeId: string): boolean {
		const sourceNode = this.nodesById.get(sourceNodeId);
		const targetNode = this.nodesById.get(targetNodeId);

		if (!sourceNode || !targetNode) {
			return true;
		}

		const sourceType = getObjectType(sourceNode);
		const targetType = getObjectType(targetNode);

		const sourceClass = this.registry.get(sourceType);
		const targetClass = this.registry.get(targetType);

		// V1 validation fallback.
		if (!sourceClass || !targetClass) {
			return canAudioNodeConnect(sourceType, targetType);
		}

		// V2 validation
		return validateGroupConnection(sourceClass.group, targetClass.group);
	}

	/**
	 * Get singleton instance.
	 */
	static getInstance(): AudioService {
		if (AudioService.instance === null) {
			AudioService.instance = new AudioService();
		}

		return AudioService.instance;
	}
}

registerAudioNodes();
