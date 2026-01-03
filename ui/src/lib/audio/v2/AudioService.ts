import type { Edge } from '@xyflow/svelte';
import type { AudioNodeV2 } from './interfaces/audio-nodes';
import { getNodeType } from './interfaces/audio-nodes';
import type { ObjectInlet } from '$lib/objects/v2/object-metadata';
import { canAudioNodeConnect } from '../audio-node-group';
// @ts-expect-error -- no typedefs
import { getAudioContext } from 'superdough';
import { handleToPortIndex } from '$lib/utils/get-edge-types';
import { validateGroupConnection } from './audio-helpers';
import { logger } from '$lib/utils/logger';
import { getAudioParamValue, setAudioParamValue } from './audio-param-helpers';
import { AudioRegistry } from '$lib/registry/AudioRegistry';

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
		const nodeType = getNodeType(node);
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

		const metadata = this.registry.getNodeMetadataByType(getNodeType(audioNode));
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
	 *
	 * To prevent cross-system connection breakage, we do NOT disconnect V2 nodes
	 * that are involved in edges where the other endpoint is a V1 node.
	 * AudioSystem.updateEdges will restore those connections.
	 */
	updateEdges(edges: Edge[]): void {
		try {
			// Identify which V2 nodes are involved ONLY in V2-to-V2 edges
			// Nodes that are only involved in edges where the other end is V1 should NOT be disconnected
			const v2NodesInV2ToV2 = new Set<string>();
			const v2NodesInCrossSystem = new Set<string>();

			for (const edge of edges) {
				const sourceIsV2 = !!this.nodesById.get(edge.source);
				const targetIsV2 = !!this.nodesById.get(edge.target);

				if (sourceIsV2 && targetIsV2) {
					// V2-to-V2 edge
					v2NodesInV2ToV2.add(edge.source);
					v2NodesInV2ToV2.add(edge.target);
				} else if (sourceIsV2 || targetIsV2) {
					// Cross-system edge (V2→V1 or V1→V2)
					if (sourceIsV2) v2NodesInCrossSystem.add(edge.source);
					if (targetIsV2) v2NodesInCrossSystem.add(edge.target);
				}
			}

			// Only disconnect V2 nodes that are ONLY involved in V2-to-V2 edges
			// Do NOT disconnect V2 nodes that are involved in cross-system connections
			for (const nodeId of v2NodesInV2ToV2) {
				if (v2NodesInCrossSystem.has(nodeId)) continue; // Skip if involved in cross-system
				const node = this.nodesById.get(nodeId);
				if (!node) continue;

				try {
					node.audioNode?.disconnect();
				} catch (error) {
					logger.warn('cannot disconnect node:', error);
				}
			}

			// Reconnect the output gain to destination
			if (this.outGain) {
				this.outGain.connect(this.getAudioContext().destination);
			}

			// Connect destination nodes (i.e. dac~) to device outputs
			for (const node of this.nodesById.values()) {
				const group = this.registry.get(getNodeType(node))?.group;

				if (this.outGain && group === 'destinations') {
					try {
						node.audioNode?.connect(this.outGain);
					} catch (error) {
						logger.warn(`cannot connect to device's audio output`, error);
					}
				}
			}

			// Connect nodes by using its edges (V2-to-V2 edges only, due to connectByEdge logic)
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
		const node = new NodeClass(nodeId, audioContext);

		try {
			await node.create?.(params);
		} catch (error) {
			logger.error(`cannot create node ${nodeType}`, error);
		}

		this.nodesById.set(node.nodeId, node);

		return node;
	}

	/**
	 * Connect two nodes together via an edge.
	 * Handles validation, node's custom connect() methods, and multi-channel routing.
	 */
	private connectByEdge(edge: Edge): void {
		const sourceNode = this.nodesById.get(edge.source);
		const targetNode = this.nodesById.get(edge.target);

		// IMPORTANT: skip edges involving V1 nodes
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
	 * Get singleton instance.
	 */
	static getInstance(): AudioService {
		if (AudioService.instance === null) {
			AudioService.instance = new AudioService();
		}

		return AudioService.instance;
	}
}
