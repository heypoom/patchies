import type { MessageCallbackFn } from '$lib/messages/MessageSystem';

/**
 * Shared message context for render-worker renderers.
 * Handles edge-based recv() and channel-based recv({from}) subscriptions.
 */
export class WorkerRendererMessageContext {
  private readonly nodeId: string;

  private onMessageCallbacks: MessageCallbackFn[] = [];
  private channelCallbacks = new Map<string, MessageCallbackFn>();

  constructor(nodeId: string) {
    this.nodeId = nodeId;
  }

  /** Returns the onMessage/recv function to inject into user code context. */
  createOnMessageFunction() {
    return (callback: MessageCallbackFn, options?: { from?: string }) => {
      if (options?.from) {
        this.channelCallbacks.set(options.from, callback);

        self.postMessage({ type: 'subscribeChannel', nodeId: this.nodeId, channel: options.from });
      } else {
        this.onMessageCallbacks.push(callback);
      }
    };
  }

  /** Clears all callbacks and unsubscribes from channels. Call before re-executing code. */
  reset() {
    this.onMessageCallbacks = [];

    for (const channel of this.channelCallbacks.keys()) {
      self.postMessage({ type: 'unsubscribeChannel', nodeId: this.nodeId, channel });
    }

    this.channelCallbacks.clear();
  }

  /** Dispatch an incoming edge message to all registered edge callbacks. */
  handleEdgeMessage(data: unknown, meta: unknown) {
    for (const callback of this.onMessageCallbacks) {
      callback(data, meta as Parameters<MessageCallbackFn>[1]);
    }
  }

  /** Dispatch an incoming channel message to the registered callback for that channel. */
  handleChannelMessage(channel: string, data: unknown, sourceNodeId: string) {
    const callback = this.channelCallbacks.get(channel);

    if (callback) {
      callback(data, { channel, source: sourceNodeId });
    }
  }
}
