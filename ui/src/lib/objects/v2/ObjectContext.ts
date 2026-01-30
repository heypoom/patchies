import { MessageContext, type SendMessageOptions } from '$lib/messages/MessageContext';
import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
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
  private messageCallbacks: MessageCallbackFn[] = [];

  constructor(nodeId: string, messageContext: MessageContext, inlets: ObjectInlet[] = []) {
    this.nodeId = nodeId;
    this.messageContext = messageContext;
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
   * Add a message callback that will be automatically cleaned up on destroy.
   */
  addMessageCallback(callback: MessageCallbackFn): void {
    this.messageCallbacks.push(callback);
    this.messageContext.queue.addCallback(callback);
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
   * Merges with default values - explicit values override defaults.
   * Does not notify subscribers.
   */
  initParams(params: unknown[]): void {
    // Merge incoming params with defaults
    // Explicit values (even if falsy like 0 or "") override defaults
    // Only preserve defaults for indices not provided in params array
    for (let i = 0; i < params.length; i++) {
      this.params[i] = params[i];
    }
  }

  /**
   * Get inlet name by index.
   */
  getInletName(index: number | undefined): string | undefined {
    // meta.inlet is optional and is usually passed to getInletName
    if (index === undefined) return undefined;

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
    // Remove all message callbacks from the queue
    for (const callback of this.messageCallbacks) {
      this.messageContext.queue.removeCallback(callback);
    }

    this.messageCallbacks = [];
    this.paramsChangeCallbacks = [];
  }
}
