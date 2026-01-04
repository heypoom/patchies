import { ObjectContext } from './ObjectContext';
import { ObjectRegistry } from '$lib/registry/ObjectRegistry';
import { logger } from '$lib/utils/logger';
import { registerTextObjects } from './nodes';

import type { TextObjectV2, MessageMeta } from './interfaces/text-objects';

/**
 * ObjectService provides shared logic for the V2 text object system.
 * Manages object registry, instances, and message routing.
 *
 * Key architectural requirement: Object state is stored here, NOT in Svelte components.
 * This enables headless patcher usage and nested patches.
 */
export class ObjectService {
	private static instance: ObjectService | null = null;

	/** Reference to registry of text objects */
	registry = ObjectRegistry.getInstance();

	/** Mapping of active text object instances by nodeId */
	private objectsById: Map<string, TextObjectV2> = new Map();

	/**
	 * Create an object by type.
	 * @param nodeId - Unique identifier for the object
	 * @param objectType - The type of object to create
	 * @param params - Array of parameters for the object
	 * @returns The created object instance, or null if type not defined
	 */
	async createObject(
		nodeId: string,
		objectType: string,
		params: unknown[] = []
	): Promise<TextObjectV2 | null> {
		const ObjectClass = this.registry.get(objectType);

		if (!ObjectClass) {
			return null;
		}

		// Create ObjectContext with inlet definitions from the class
		const context = new ObjectContext(nodeId, ObjectClass.inlets);
		context.initParams(params);

		const object = new ObjectClass(nodeId, context);
		this.objectsById.set(nodeId, object);

		// Set up message routing from ObjectContext to the object
		context.queue.addCallback((data, meta) => {
			this.dispatchMessage(object, data, meta);
		});

		try {
			await object.create?.(params);
		} catch (error) {
			logger.error(`cannot create object ${objectType}`, error);
		}

		return object;
	}

	/**
	 * Get an object instance by nodeId.
	 * @param nodeId - The node ID to look up
	 * @returns The object instance or null if not found
	 */
	getObjectById(nodeId: string): TextObjectV2 | null {
		return this.objectsById.get(nodeId) ?? null;
	}

	/**
	 * Remove an object from the service.
	 * Called when the object is explicitly deleted from the patch.
	 * @param object - The object to remove
	 */
	removeObject(object: TextObjectV2): void {
		if (object.destroy) {
			object.destroy();
		}

		// Clean up ObjectContext
		object.context.destroy();

		this.objectsById.delete(object.nodeId);
	}

	/**
	 * Remove an object by nodeId.
	 * @param nodeId - The node ID to remove
	 */
	removeObjectById(nodeId: string): void {
		const object = this.objectsById.get(nodeId);
		if (object) {
			this.removeObject(object);
		}
	}

	/**
	 * Send a message to an object.
	 * @param nodeId - The ID of the object to send the message to
	 * @param data - The message data
	 * @param meta - Message metadata (inlet, source, etc.)
	 */
	send(nodeId: string, data: unknown, meta: MessageMeta): void {
		const object = this.objectsById.get(nodeId);
		if (!object) return;

		this.dispatchMessage(object, data, meta);
	}

	/**
	 * Get all registered V2 object names.
	 * @returns Array of object type identifiers
	 */
	getAllObjectNames(): string[] {
		return this.registry.getObjectTypes();
	}

	/**
	 * Check if an object type is defined in the V2 registry.
	 * @param objectType - The object type to check
	 * @returns True if defined
	 */
	isV2ObjectType(objectType: string): boolean {
		return this.registry.isDefined(objectType);
	}

	/**
	 * Dispatch a message to an object, enriching meta with resolved inlet name.
	 */
	private dispatchMessage(object: TextObjectV2, data: unknown, meta: MessageMeta): void {
		const inletName = object.context.getInletName(meta.inlet);

		object.onMessage?.(data, { ...meta, inletName });
	}

	/**
	 * Get the singleton instance.
	 */
	static getInstance(): ObjectService {
		if (ObjectService.instance === null) {
			ObjectService.instance = new ObjectService();
		}

		return ObjectService.instance;
	}
}

registerTextObjects();
