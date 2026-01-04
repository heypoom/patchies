import type { TextObjectClass } from '$lib/objects/v2/interfaces/text-objects';

/**
 * Registry for text object types and their constructors.
 * Supports object lookup, metadata retrieval, and registration.
 */
export class ObjectRegistry {
	private static instance: ObjectRegistry | null = null;
	private registry: Map<string, TextObjectClass> = new Map();

	private constructor() {}

	/**
	 * Register an object type with its constructor.
	 * @param constructor - The object class with static `type` property
	 */
	register(constructor: TextObjectClass): void {
		this.registry.set(constructor.type, constructor);
	}

	/**
	 * Check if an object type is defined in the registry.
	 * @param objectType - The object type identifier
	 * @returns True if the object type is defined
	 */
	isDefined(objectType: string): boolean {
		return this.registry.has(objectType);
	}

	/**
	 * Get an object constructor by type.
	 * @param objectType - The type of object to retrieve
	 * @returns The object class or undefined if not found
	 */
	get(objectType: string): TextObjectClass | undefined {
		return this.registry.get(objectType);
	}

	/**
	 * Get all registered object types.
	 * @returns Array of registered object type identifiers
	 */
	getObjectTypes(): string[] {
		return Array.from(this.registry.keys());
	}

	/**
	 * Get the singleton instance.
	 */
	static getInstance(): ObjectRegistry {
		if (ObjectRegistry.instance === null) {
			ObjectRegistry.instance = new ObjectRegistry();
		}

		return ObjectRegistry.instance;
	}
}
