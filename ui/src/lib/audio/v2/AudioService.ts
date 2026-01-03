import type { Edge } from '@xyflow/svelte';
// @ts-expect-error -- no typedefs
import { getAudioContext } from 'superdough';
import { canAudioNodeConnect } from '../audio-node-group';
import { objectDefinitions, type ObjectInlet } from '$lib/objects/object-definitions';
import { hasSomeAudioNode } from '../../../stores/canvas.store';
import { handleToPortIndex } from '$lib/utils/get-edge-types';
import type { PatchAudioNode } from './interfaces/PatchAudioNode';
import type { PatchAudioType } from '../audio-node-types';

/**
 * AudioService provides shared audio logic for the v2 audio system.
 * Manages node registry, connections, and edge updates.
 */
type NodeConstructor = new (nodeId: string, audioContext: AudioContext) => PatchAudioNode;

export class AudioService {
	private static instance: AudioService | null = null;

	/** Registry of active audio nodes */
	private nodesById: Map<string, PatchAudioNode> = new Map();

	/** Registry of node type constructors */
	private nodeConstructors: Map<PatchAudioType, NodeConstructor> = new Map();

	/** Output gain node for audio output */
	outGain: GainNode | null = null;

	private constructor() {
		// Private constructor for singleton pattern
	}

	/**
	 * Get the AudioContext instance.
	 */
	getAudioContext(): AudioContext {
		return getAudioContext();
	}

	/**
	 * Initialize the audio system.
	 * Creates the output gain node and connects it to the destination.
	 */
	start(): void {
		this.outGain = this.getAudioContext().createGain();
		this.outGain.gain.value = 0.8;
		this.outGain.connect(this.getAudioContext().destination);
	}

	/**
	 * Register a node in the registry.
	 */
	registerNode(node: PatchAudioNode): void {
		this.nodesById.set(node.nodeId, node);
		hasSomeAudioNode.set(true);
	}

	/**
	 * Unregister a node from the registry.
	 */
	unregisterNode(nodeId: string): void {
		this.nodesById.delete(nodeId);
	}

	/**
	 * Get a node by ID.
	 */
	getNode(nodeId: string): PatchAudioNode | null {
		return this.nodesById.get(nodeId) ?? null;
	}

	/**
	 * Connect two nodes together.
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
				console.warn(`Cannot connect ${sourceId} to ${targetId}: invalid connection type`);
				return;
			}

			if (paramName) {
				const audioParam = targetNode.getAudioParam(paramName);

				if (audioParam) {
					sourceNode.audioNode.connect(audioParam);
				} else {
					console.warn(`AudioParam ${paramName} not found on node ${targetId}`);
				}
			} else {
				// For now, handle basic node-to-node connections
				// Special cases (sampler~, tone~, etc.) will be handled by individual node classes
				sourceNode.connect(targetNode);
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

		// For regular node-to-node connections, use the existing validation
		return canAudioNodeConnect(sourceNode.type, targetNode.type);
	}

	/**
	 * Get an inlet definition by handle.
	 */
	getInletByHandle(nodeId: string, targetHandle: string | null): ObjectInlet | null {
		const audioNode = this.nodesById.get(nodeId);
		if (!audioNode || !targetHandle) {
			return null;
		}

		const objectDef = objectDefinitions[audioNode.type];
		if (!objectDef) {
			return null;
		}

		const inletIndex = handleToPortIndex(targetHandle);
		if (inletIndex === null || isNaN(inletIndex)) {
			return null;
		}

		return objectDef.inlets[inletIndex] ?? null;
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
	 * @param nodeType - The node type identifier
	 * @param constructor - The node class constructor
	 */
	define(nodeType: PatchAudioType, constructor: NodeConstructor): void {
		this.nodeConstructors.set(nodeType, constructor);
	}

	/**
	 * Check if a node type is defined in v2.
	 * @param nodeType - The node type identifier
	 * @returns True if the node type is defined
	 */
	isNodeTypeDefined(nodeType: PatchAudioType): boolean {
		return this.nodeConstructors.has(nodeType);
	}

	/**
	 * Create a node by type.
	 * @param nodeId - Unique identifier for the node
	 * @param nodeType - The type of node to create
	 * @param params - Array of parameters for the node
	 * @returns The created node instance, or null if type not defined
	 */
	createNode(
		nodeId: string,
		nodeType: PatchAudioType,
		params: unknown[] = []
	): PatchAudioNode | null {
		const Constructor = this.nodeConstructors.get(nodeType);
		if (!Constructor) {
			console.warn(`Node type ${nodeType} is not defined. Call AudioService.define() first.`);
			return null;
		}

		const audioContext = this.getAudioContext();
		const node = new Constructor(nodeId, audioContext);
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
