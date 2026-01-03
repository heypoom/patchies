import type { NodeMetadata } from './NodeMetadata';

/**
 * Node group type for v2 audio nodes.
 *
 * * sources: generates audio (e.g. oscillator, microphone)
 * * processors: processes audio (e.g. gain, filter)
 * * destinations: outputs audio (e.g. speaker)
 */
export type AudioNodeGroup = 'sources' | 'processors' | 'destinations';

/**
 * Constructor signature for PatchAudioNode classes.
 */
export type NodeConstructor = new (nodeId: string, audioContext: AudioContext) => PatchAudioNode;

/**
 * Full node class type including required static properties and optional metadata.
 * All v2 node classes must conform to this type.
 */
export type NodeClass = {
	name: string;
	group: AudioNodeGroup;
} & NodeMetadata &
	NodeConstructor;

/**
 * Interface for audio nodes in the v2 audio system.
 * All audio node classes must implement this interface.
 */
export interface PatchAudioNode {
	/** Unique identifier for this node */
	readonly nodeId: string;

	/** The underlying Web Audio API node */
	readonly audioNode: AudioNode;

	/**
	 * Initialize the node with the given parameters.
	 * @param params - Array of parameters specific to the node type
	 */
	create(params: unknown[]): void;

	/**
	 * Handle incoming messages to the node.
	 * @param key - The parameter or message key
	 * @param message - The message value
	 */
	send(key: string, message: unknown): void;

	/**
	 * Get an AudioParam for modulation.
	 * @param name - The name of the AudioParam
	 * @returns The AudioParam or null if not found
	 */
	getAudioParam(name: string): AudioParam | null;

	/**
	 * Connect this node to another node.
	 *
	 * Optional: if not implemented, AudioService will use the default implementation.
	 *
	 * @param target - The target node to connect to
	 * @param paramName - Optional AudioParam name to connect to
	 */
	connect?(target: PatchAudioNode, paramName?: string): void;

	/**
	 * Cleanup resources and disconnect the node.
	 *
	 * Optional: if not implemented, AudioService will use the default implementation.
	 */
	destroy?(): void;
}

/**
 * Get the node type from a PatchAudioNode instance.
 * Extracts the static name property from the node's constructor.
 *
 * @param node - The node instance
 * @returns The node type identifier
 */
export const getNodeType = (node: PatchAudioNode): string =>
	(node.constructor as { name: string }).name;
