import { objectDefinitionsV1 } from '$lib/objects/object-definitions';
import type { AudioNodeClass } from '../audio/v2/interfaces/audio-nodes';

/**
 * Registry for audio node types and their constructors.
 * Supports node lookup, metadata retrieval, and group classification.
 */
export class AudioRegistry {
	private static instance: AudioRegistry | null = null;
	private registry: Map<string, AudioNodeClass> = new Map();

	private constructor() {}

	/**
	 * Register a node type with its constructor.
	 * @param constructor - The node class with static `type` and `group` properties
	 */
	register(constructor: AudioNodeClass): void {
		this.registry.set(constructor.type, constructor);
	}

	/**
	 * Check if a node type is defined in the registry.
	 * @param nodeType - The node type identifier
	 * @returns True if the node type is defined
	 */
	isDefined(nodeType: string): boolean {
		return this.registry.has(nodeType);
	}

	/**
	 * Get a node constructor by type.
	 * @param nodeType - The type of node to retrieve
	 * @returns The node class or undefined if not found
	 */
	get(nodeType: string): AudioNodeClass | undefined {
		return this.registry.get(nodeType);
	}

	/**
	 * Get all registered node types.
	 * @returns Array of registered node type identifiers
	 */
	getNodeTypes(): string[] {
		return Array.from(this.registry.keys());
	}

	/**
	 * Get node metadata (inlets, outlets, etc.) by type.
	 * @param nodeType - The type of node
	 * @returns The node metadata or null if not found
	 */
	getNodeMetadataByType(nodeType: string) {
		const constructor = this.registry.get(nodeType);

		if (constructor) {
			return {
				type: constructor.type,
				group: constructor.group,
				description: constructor.description,
				inlets: constructor.inlets,
				outlets: constructor.outlets
			};
		}

		// Fall back to V1 objectDefinitions otherwise.
		if (objectDefinitionsV1[nodeType]) {
			return objectDefinitionsV1[nodeType];
		}
	}

	/**
	 * Get the singleton instance.
	 */
	static getInstance(): AudioRegistry {
		if (AudioRegistry.instance === null) {
			AudioRegistry.instance = new AudioRegistry();
		}

		return AudioRegistry.instance;
	}
}
