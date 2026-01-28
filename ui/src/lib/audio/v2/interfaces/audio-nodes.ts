import type { ObjectMetadata } from '$lib/objects/v2/object-metadata';

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
export type AudioNodeConstructor = new (nodeId: string, audioContext: AudioContext) => AudioNodeV2;

/**
 * Audio node class type including required static properties and optional metadata.
 */
export type AudioNodeClass = {
	/** Type identifier of the audio node (e.g. `osc~` or `dac~`) */
	type: string;

	/** Group of the audio node (e.g. sources or processors) */
	group: AudioNodeGroup;

	/** If true, the node is hidden from object browser and autocomplete */
	headless?: boolean;
} & ObjectMetadata &
	AudioNodeConstructor;

/**
 * Interface for audio nodes in the v2 audio system.
 * All audio node classes must implement this interface.
 */
export interface AudioNodeV2 {
	/** Unique identifier for this node */
	readonly nodeId: string;

	/** The underlying Web Audio API node (can be reassigned for lazy-loaded nodes) */
	audioNode: AudioNode | null;

	/**
	 * Initialize the node with the given parameters.
	 *
	 * Optional: if not implemented, AudioService will use the default implementation.
	 * Can be async for nodes that need to load resources (e.g., AudioWorklets).
	 *
	 * @param params - Array of parameters specific to the node type
	 */
	create?(params: unknown[]): void | Promise<void>;

	/**
	 * Handle incoming messages to the node.
	 *
	 * Optional: if not implemented, AudioService will use the default implementation.
	 *
	 * @param key - The parameter or message key
	 * @param message - The message value
	 */
	send?(key: string, message: unknown): void | Promise<void>;

	/**
	 * Get an AudioParam for modulation.
	 *
	 * Optional: if not implemented, returns null.
	 *
	 * @param name - The name of the AudioParam
	 * @returns The AudioParam or null if not found
	 */
	getAudioParam?(name: string): AudioParam | null;

	/**
	 * Connect this node to another node.
	 *
	 * Optional: if not implemented, AudioService will use the default implementation.
	 *
	 * @param target - The target node to connect to
	 * @param paramName - Optional AudioParam name to connect to
	 * @param sourceHandle - Optional source handle for nodes with multiple outputs (e.g., split~)
	 * @param targetHandle - Optional target handle for nodes with multiple inputs (e.g., merge~)
	 */
	connect?(
		target: AudioNodeV2,
		paramName?: string,
		sourceHandle?: string,
		targetHandle?: string
	): void;

	/**
	 * Handle incoming connection from another node.
	 *
	 * Optional: used for nodes that have special input handling (e.g., sampler~ which records audio).
	 * Called instead of connect() when the target node has custom input logic.
	 *
	 * @param source - The source node connecting to this node
	 * @param paramName - Optional AudioParam name being connected to
	 * @param sourceHandle - Optional source handle for nodes with multiple outputs
	 * @param targetHandle - Optional target handle for nodes with multiple inputs
	 */
	connectFrom?(
		source: AudioNodeV2,
		paramName?: string,
		sourceHandle?: string,
		targetHandle?: string
	): void;

	/**
	 * Cleanup resources and disconnect the node.
	 *
	 * Optional: if not implemented, AudioService will use the default implementation.
	 */
	destroy?(): void;
}
