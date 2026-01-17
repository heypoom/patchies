import type { Message } from '$lib/messages/MessageSystem';
import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';

/**
 * Message metadata passed to onMessage handlers.
 */
export type MessageMeta = Omit<Message, 'data'>;

/**
 * Interface for text objects in the V2 object system.
 * All text object classes must implement this interface.
 */
export interface TextObjectV2 {
	/** Unique identifier for this object instance */
	readonly nodeId: string;

	/** Object context for messaging and params (injected by ObjectService) */
	readonly context: ObjectContext;

	/**
	 * Initialize the object with the given parameters.
	 * Called after construction when creating the object.
	 *
	 * @param params - Array of parameters specific to the object type
	 */
	create?(params: unknown[]): void | Promise<void>;

	/**
	 * Clean up resources when the object is destroyed.
	 * Called when the object is explicitly removed from the patch.
	 */
	destroy?(): void;

	/**
	 * Handle incoming messages from inlets.
	 *
	 * @param data - The message data
	 * @param meta - Message metadata (source, inlet, outlet, etc.)
	 */
	onMessage?(data: unknown, meta: MessageMeta): void;

	/**
	 * Get dynamic outlets for this instance.
	 * Use this when outlet count depends on runtime state or creation params.
	 * If not defined, static `outlets` from the class is used.
	 */
	getOutlets?(): ObjectOutlet[];
}

/**
 * Constructor signature for TextObject classes.
 * Receives nodeId and ObjectContext.
 */
export type TextObjectConstructor = new (nodeId: string, context: ObjectContext) => TextObjectV2;

/**
 * Text object class type including required static properties and optional metadata.
 */
export type TextObjectClass = {
	/** Type identifier of the text object (e.g. `mtof` or `metro`) */
	type: string;

	/** Aliases for the object type (e.g. 't' for 'trigger') */
	aliases?: string[];

	/** Description of the object */
	description?: string;

	/** Inlet definitions */
	inlets?: ObjectInlet[];

	/** Outlet definitions (used as default if instance doesn't implement getOutlets) */
	outlets?: ObjectOutlet[];
} & TextObjectConstructor;
