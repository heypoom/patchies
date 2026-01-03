/**
 * Node group type for v2 audio nodes.
 *
 * * sources: generates audio (e.g. oscillator, microphone)
 * * processors: processes audio (e.g. gain, filter)
 * * destinations: outputs audio (e.g. speaker)
 */
export type AudioNodeGroup = 'sources' | 'processors' | 'destinations';

/**
 * Interface for audio nodes in the v2 audio system.
 * All audio node classes must implement this interface.
 */
export interface PatchAudioNode {
	/** Node type identifier */
	readonly type: string;

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
