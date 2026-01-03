import type { Edge } from '@xyflow/svelte';
import type { PatchAudioNode, NodeClass } from './interfaces/PatchAudioNode';
import { getNodeType } from './interfaces/PatchAudioNode';
import type { NodeMetadata, ObjectInlet } from './interfaces/NodeMetadata';
import type { V1PatchAudioType } from '../audio-node-types';
import { canAudioNodeConnect } from '../audio-node-group';
// @ts-expect-error -- no typedefs
import { getAudioContext } from 'superdough';
import { handleToPortIndex } from '$lib/utils/get-edge-types';
import { validateGroupConnection } from './audio-helpers';
import { objectDefinitionsV1 } from '$lib/objects/object-definitions';

/**
 * AudioService provides shared audio logic for the v2 audio system.
 * Manages node registry, connections, and edge updates.
 */
export class AudioService {
	private static instance: AudioService | null = null;

	/** Registry of node classes */
	private registry: Map<string, NodeClass> = new Map();

	/** Mapping of active audio nodes */
	private nodesById: Map<string, PatchAudioNode> = new Map();

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

	/** Register a node to the registry. */
	registerNode(node: PatchAudioNode): void {
		this.nodesById.set(node.nodeId, node);
	}

	/** Unregister a node from the registry. */
	unregisterNode(nodeId: string): void {
		this.nodesById.delete(nodeId);
	}

	/** Removes a node from the graph. */
	removeNode(node: PatchAudioNode): void {
		if (node.destroy) {
			node.destroy();
			return;
		}

		node.audioNode.disconnect();
	}

	getNode(nodeId: string): PatchAudioNode | null {
		return this.nodesById.get(nodeId) ?? null;
	}

	/**
	 * Default implementation for connecting nodes.
	 * Used when a node doesn't implement its own connect method.
	 */
	private defaultConnect(source: PatchAudioNode, target: PatchAudioNode, paramName?: string): void {
		if (!paramName) {
			source.audioNode.connect(target.audioNode);
			return;
		}

		const audioParam = target.getAudioParam(paramName);

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
				console.warn(`cannot connect ${sourceId} to ${targetId}: invalid connection`);
				return;
			}

			if (sourceNode.connect) {
				sourceNode.connect(targetNode, paramName);
			} else {
				this.defaultConnect(sourceNode, targetNode, paramName);
			}
		} catch (error) {
			console.error(`Failed to connect ${sourceId} to ${targetId}:`, error);
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

		// Fallback to V1 validation.
		if (!sourceClass || !targetClass) {
			return canAudioNodeConnect(sourceType as V1PatchAudioType, targetType as V1PatchAudioType);
		}

		return validateGroupConnection(sourceClass.group, targetClass.group);
	}

	/**
	 * Get node metadata (inlets, outlets, description, tags).
	 * Checks v2 registry first, then falls back to v1 objectDefinitions.
	 * @param nodeType - The node type identifier
	 * @returns NodeMetadata or null if not found
	 */
	getNodeMetadata(nodeType: string): NodeMetadata | null {
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
	 * Get all registered v2 node names that have a specific tag.
	 *
	 * @param tag - The tag to filter by (e.g., 'audio')
	 * @returns Array of node type identifiers
	 */
	getNodeNamesByTag(tag: string): string[] {
		return Array.from(this.registry.entries())
			.filter(([, nodeClass]) => nodeClass.tags?.includes(tag))
			.map(([name]) => name);
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
	 */
	updateEdges(edges: Edge[]): void {
		try {
			// Disconnect all existing connections
			for (const node of this.nodesById.values()) {
				try {
					node.audioNode.disconnect();
				} catch (error) {
					console.warn('Error disconnecting node:', error);
				}
			}

			// Reconnect the output gain to destination
			if (this.outGain) {
				this.outGain.connect(this.getAudioContext().destination);
			}

			for (const edge of edges) {
				const inlet = this.getInletByHandle(edge.target, edge.targetHandle ?? null);

				const targetNode = this.nodesById.get(edge.target);
				const isAudioParam = targetNode ? !!targetNode.getAudioParam(inlet?.name ?? '') : false;

				this.connect(edge.source, edge.target, isAudioParam ? inlet?.name : undefined);
			}
		} catch (error) {
			console.error('Error updating audio edges:', error);
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
	 * The constructor class must have static `name` and `group` properties.
	 * @param constructor - The node class constructor with static name and group properties
	 */
	define(constructor: NodeClass): void {
		this.registry.set(constructor.name, constructor);
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
	 * Check if a node is a v2 node (non-null and has a defined type in the registry).
	 * @param node - The node instance (can be null)
	 * @returns True if the node exists and is a v2 node
	 */
	isNodeDefined(node: PatchAudioNode | null): node is PatchAudioNode {
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
	createNode(nodeId: string, nodeType: string, params: unknown[] = []): PatchAudioNode | null {
		const NodeConstructor = this.registry.get(nodeType);

		if (!NodeConstructor) {
			console.warn(`audio node "${nodeType}" is not defined`);
			return null;
		}

		const audioContext = this.getAudioContext();
		const node = new NodeConstructor(nodeId, audioContext);
		node.create(params);
		this.registerNode(node);

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
