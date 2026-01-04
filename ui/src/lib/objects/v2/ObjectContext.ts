import { MessageContext, type SendMessageOptions } from '$lib/messages/MessageContext';
import type { ObjectInlet } from './object-metadata';

type ParamsChangeCallback = (params: unknown[], index: number, value: unknown) => void;

/**
 * ObjectContext provides a clean API for text objects to interact with
 * the messaging system and manage their parameters.
 *
 * This replaces direct MessageContext usage and manual onParamsChange callbacks.
 */
export class ObjectContext {
	readonly nodeId: string;

	private messageContext: MessageContext;
	private params: unknown[] = [];
	private inlets: ObjectInlet[] = [];
	private paramsChangeCallbacks: ParamsChangeCallback[] = [];

	constructor(nodeId: string, inlets: ObjectInlet[] = []) {
		this.nodeId = nodeId;
		this.messageContext = new MessageContext(nodeId);
		this.inlets = inlets;

		// Initialize params with default values from inlets
		this.params = inlets.map((inlet) => inlet.defaultValue ?? null);
	}

	/**
	 * Send a message to connected objects.
	 */
	send(data: unknown, options?: SendMessageOptions): void {
		this.messageContext.send(data, options);
	}

	/**
	 * Get the MessageQueue for adding message callbacks.
	 */
	get queue() {
		return this.messageContext.queue;
	}

	/**
	 * Get a parameter value by index or name.
	 */
	getParam(indexOrName: number | string): unknown {
		const index = typeof indexOrName === 'string' ? this.getInletIndex(indexOrName) : indexOrName;

		if (index === -1 || index >= this.params.length) {
			return undefined;
		}

		return this.params[index];
	}

	/**
	 * Set a parameter value by index or name.
	 * Automatically notifies all subscribers.
	 */
	setParam(indexOrName: number | string, value: unknown): void {
		const index = typeof indexOrName === 'string' ? this.getInletIndex(indexOrName) : indexOrName;

		if (index === -1) return;

		// Expand params array if needed
		while (this.params.length <= index) {
			this.params.push(null);
		}

		this.params[index] = value;

		// Notify all subscribers
		for (const callback of this.paramsChangeCallbacks) {
			callback([...this.params], index, value);
		}
	}

	/**
	 * Get all parameters.
	 */
	getParams(): unknown[] {
		return [...this.params];
	}

	/**
	 * Set all parameters at once (used during initialization).
	 * Does not notify subscribers.
	 */
	initParams(params: unknown[]): void {
		this.params = [...params];
	}

	/**
	 * Get inlet name by index.
	 */
	getInletName(index: number): string | undefined {
		return this.inlets[index]?.name;
	}

	/**
	 * Get inlet index by name.
	 */
	getInletIndex(name: string): number {
		return this.inlets.findIndex((inlet) => inlet.name === name);
	}

	/**
	 * Subscribe to parameter changes.
	 * Returns an unsubscribe function.
	 */
	onParamsChange(callback: ParamsChangeCallback): () => void {
		this.paramsChangeCallbacks.push(callback);

		return () => {
			const index = this.paramsChangeCallbacks.indexOf(callback);
			if (index > -1) {
				this.paramsChangeCallbacks.splice(index, 1);
			}
		};
	}

	/**
	 * Clean up resources.
	 */
	destroy(): void {
		this.messageContext.destroy();
		this.paramsChangeCallbacks = [];
	}
}
