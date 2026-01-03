import type { Edge } from '@xyflow/svelte';
import type { AudioNodeV2, AudioNodeClass, AudioNodeGroup } from './interfaces/audio-nodes';
import { getNodeType } from './interfaces/audio-nodes';
import type { ObjectMetadata, ObjectInlet } from '$lib/objects/v2/object-metadata';
import { canAudioNodeConnect } from '../audio-node-group';
// @ts-expect-error -- no typedefs
import { getAudioContext } from 'superdough';
import { handleToPortIndex } from '$lib/utils/get-edge-types';
import { validateGroupConnection } from './audio-helpers';
import { objectDefinitionsV1 } from '$lib/objects/object-definitions';
import { logger } from '$lib/utils/logger';
import { getAudioParamValue, setAudioParamValue } from './audio-param-helpers';

/**
 * AudioService provides shared audio logic for the v2 audio system.
 * Manages node registry, connections, and edge updates.
 */
export class AudioService {
	private static instance: AudioService | null = null;

	/** Registry of node classes */
	private registry: Map<string, AudioNodeClass> = new Map();

	/** Mapping of active audio nodes */
	private nodesById: Map<string, AudioNodeV2> = new Map();

	/** Output gain node for audio output */
	outGain: GainNode | null = null;

	getAudioContext(): AudioContext {
		return getAudioContext();
	}

	/** Create the output gain node and connect it to the destination. */
	start(): void {
		this.outGain = this.getAudioContext().createGain();
		this.outGain.gain.value = 0.8;
		this.outGain.connect(this.getAudioContext().destination);
	}

	/** Removes a node from the graph. */
	removeNode(node: AudioNodeV2): void {
		if (node.destroy) {
			node.destroy();
		} else {
			node.audioNode.disconnect();
		}

		this.nodesById.delete(node.nodeId);
	}

	getNode(nodeId: string): AudioNodeV2 | null {
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
		const nodeType = getNodeType(node);
		const nodeClass = this.registry.get(nodeType);

		if (nodeClass?.inlets) {
			return getAudioParamValue(paramName, node.audioNode, nodeClass.inlets);
		}

		return null;
	}

	/**
	 * Send a message to a node by ID, using the node's implementation or a default fallback.
	 * The default implementation routes numeric messages to AudioParam properties
	 * that are marked as isAudioParam in the node's inlets definition.
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

		if (node.send) {
			node.send(key, message);
			return;
		}

		const nodeClass = this.registry.get(getNodeType(node));

		// Set the audio parameter value by default
		if (nodeClass?.inlets) {
			setAudioParamValue(key, message, node.audioNode, nodeClass.inlets);
		}
	}

	/**
	 * Default implementation for connecting nodes.
	 * Used when a node doesn't implement its own connect method.
	 */
	private defaultConnect(source: AudioNodeV2, target: AudioNodeV2, paramName?: string): void {
		if (!paramName) {
			source.audioNode.connect(target.audioNode);
			return;
		}

		const audioParam = this.getAudioParamByNode(target, paramName);

		if (audioParam) {
			source.audioNode.connect(audioParam);
		}
	}

	/**
	 * Connect two nodes together.
	 *
	 * @param sourceId - Source node ID
	 * @param targetId - Target node ID
	 * @param paramName - Optional AudioParam name to connect to
	 */
	connect(sourceId: string, targetId: string, paramName?: string): void {
		const sourceNode = this.nodesById.get(sourceId);
		const targetNode = this.nodesById.get(targetId);

		if (!sourceNode || !targetNode) {
			return;
		}

		try {
			const isValidConnection = this.validateConnection(sourceId, targetId, paramName);

			if (!isValidConnection) {
				logger.warn(`cannot connect ${sourceId} to ${targetId}: invalid connection`);
				return;
			}

			if (sourceNode.connect) {
				sourceNode.connect(targetNode, paramName);
			} else {
				this.defaultConnect(sourceNode, targetNode, paramName);
			}
		} catch (error) {
			logger.error(`cannot connect ${sourceId} to ${targetId}:`, error);
		}
	}

	/**
	 * Validate if a connection is allowed between two node types.
	 */
	validateConnection(sourceId: string, targetId: string, paramName?: string): boolean {
		// If connecting to an AudioParam, allow any source to connect to any target.
		if (paramName) {
			return true;
		}

		const sourceNode = this.nodesById.get(sourceId);
		const targetNode = this.nodesById.get(targetId);

		if (!sourceNode || !targetNode) {
			return true;
		}

		const sourceType = getNodeType(sourceNode);
		const targetType = getNodeType(targetNode);

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
	 * Get node metadata (inlets, outlets, description, tags).
	 * Checks v2 registry first, then falls back to v1 objectDefinitions.
	 * @param nodeType - The node type identifier
	 * @returns NodeMetadata or null if not found
	 */
	getNodeMetadata(nodeType: string): ObjectMetadata | null {
		const nodeClass = this.registry.get(nodeType);

		// Use V2 registry if available
		if (nodeClass) {
			return {
				inlets: nodeClass.inlets,
				outlets: nodeClass.outlets,
				description: nodeClass.description,
				tags: nodeClass.tags
			};
		}

		// Fall back to V1 objectDefinitions otherwise.
		if (objectDefinitionsV1[nodeType]) {
			return objectDefinitionsV1[nodeType];
		}

		return null;
	}

	/**
	 * Get all registered v2 node names.
	 * @returns Array of node type identifiers
	 */
	getAllNodeNames(): string[] {
		return Array.from(this.registry.keys());
	}

	/**
	 * Get an inlet definition by handle.
	 */
	getInletByHandle(nodeId: string, targetHandle: string | null): ObjectInlet | null {
		const audioNode = this.nodesById.get(nodeId);
		if (!audioNode || !targetHandle) {
			return null;
		}

		const nodeType = getNodeType(audioNode);
		const inletIndex = handleToPortIndex(targetHandle);
		if (inletIndex === null || isNaN(inletIndex)) {
			return null;
		}

		const metadata = this.getNodeMetadata(nodeType);
		if (!metadata?.inlets) {
			return null;
		}

		return metadata.inlets[inletIndex] ?? null;
	}

	/**
	 * Update audio connections based on XY Flow edges.
	 *
	 * IMPORTANT: This ONLY handles connections between V2 nodes.
	 * V1-to-V2 and V1-to-V1 connections are handled by AudioSystem.updateEdges.
	 * We skip edges where either node isn't in the V2 registry to avoid
	 * interfering with V1 node management.
	 */
	updateEdges(edges: Edge[]): void {
		try {
			// Disconnect all existing connections
			for (const node of this.nodesById.values()) {
				try {
					node.audioNode.disconnect();
				} catch (error) {
					logger.warn('cannot disconnect node:', error);
				}
			}

			// Reconnect the output gain to destination
			if (this.outGain) {
				this.outGain.connect(this.getAudioContext().destination);
			}

			// Destinations are auto-connected to device outputs.
			for (const node of this.nodesById.values()) {
				const group = this.getNodeGroup(getNodeType(node));

				if (this.outGain && group === 'destinations') {
					try {
						node.audioNode.connect(this.outGain);
					} catch (error) {
						logger.warn(`cannot connect to device's audio output`, error);
					}
				}
			}

			// Only process edges where BOTH source and target are V2 nodes.
			// This prevents interference with V1 node management by AudioSystem.
			for (const edge of edges) {
				const sourceNode = this.nodesById.get(edge.source);
				const targetNode = this.nodesById.get(edge.target);

				// Skip edges involving V1-only nodes
				if (!sourceNode || !targetNode) {
					continue;
				}

				const inlet = this.getInletByHandle(edge.target, edge.targetHandle ?? null);
				const isAudioParam = !!this.getAudioParamByNode(targetNode, inlet?.name ?? '');

				this.connect(edge.source, edge.target, isAudioParam ? inlet?.name : undefined);
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
	 * Register a node type with its constructor.
	 * The constructor class must have static `type` and `group` properties.
	 * @param constructor - The node class constructor with static type and group properties
	 */
	define(constructor: AudioNodeClass): void {
		this.registry.set(constructor.type, constructor);
	}

	/**
	 * Check if a node type is defined in v2.
	 * @param nodeType - The node type identifier
	 * @returns True if the node type is defined
	 */
	isNodeTypeDefined(nodeType: string): boolean {
		return this.registry.has(nodeType);
	}

	/**
	 * Get the group of a node type from the registry.
	 * @param nodeType - The type of node to check
	 * @returns The node group or null if not defined
	 */
	getNodeGroup(nodeType: string): AudioNodeGroup | null {
		return this.registry.get(nodeType)?.group ?? null;
	}

	/**
	 * Check if a node is a v2 node (non-null and has a defined type in the registry).
	 * @param node - The node instance (can be null)
	 * @returns True if the node exists and is a v2 node
	 */
	isNodeDefined(node: AudioNodeV2 | null): node is AudioNodeV2 {
		if (!node) return false;

		return this.registry.has(getNodeType(node));
	}

	/**
	 * Create a node by type.
	 * @param nodeId - Unique identifier for the node
	 * @param nodeType - The type of node to create
	 * @param params - Array of parameters for the node
	 * @returns The created node instance, or null if type not defined
	 */
	createNode(nodeId: string, nodeType: string, params: unknown[] = []): AudioNodeV2 | null {
		const NodeClass = this.registry.get(nodeType);

		if (!NodeClass) {
			logger.warn(`audio node "${nodeType}" is not defined`);
			return null;
		}

		const audioContext = this.getAudioContext();

		const node = new NodeClass(nodeId, audioContext);
		node.create?.(params);

		this.nodesById.set(node.nodeId, node);

		return node;
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
