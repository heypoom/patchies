/**
 * MessageChannelRegistry - Manages named message channel subscriptions for send/recv objects
 *
 * Handles direct broadcast of messages to all receivers on a channel.
 */

export type MessageChannelCallback = (message: unknown, sourceNodeId: string) => void;

interface MessageChannelData {
  receivers: Map<string, MessageChannelCallback>; // nodeId -> callback
}

export class MessageChannelRegistry {
  private static instance: MessageChannelRegistry | null = null;

  private channels = new Map<string, MessageChannelData>();

  /**
   * Subscribe a recv node to a message channel
   */
  subscribe(channel: string, nodeId: string, callback: MessageChannelCallback): void {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, { receivers: new Map() });
    }

    this.channels.get(channel)!.receivers.set(nodeId, callback);
  }

  /**
   * Unsubscribe a recv node from a message channel
   */
  unsubscribe(channel: string, nodeId: string): void {
    const channelData = this.channels.get(channel);
    if (!channelData) return;

    channelData.receivers.delete(nodeId);

    // Clean up empty channels
    if (channelData.receivers.size === 0) {
      this.channels.delete(channel);
    }
  }

  /**
   * Broadcast a message to all receivers on a channel
   * Called by send nodes and JS send() with channel option
   */
  broadcast(channel: string, message: unknown, sourceNodeId: string): void {
    const channelData = this.channels.get(channel);
    if (!channelData) return;

    for (const [, callback] of channelData.receivers) {
      try {
        callback(message, sourceNodeId);
      } catch (error) {
        console.error(`MessageChannelRegistry: Error broadcasting to channel "${channel}":`, error);
      }
    }
  }

  /**
   * Get the number of receivers on a channel (useful for debugging/UI)
   */
  getReceiverCount(channel: string): number {
    return this.channels.get(channel)?.receivers.size ?? 0;
  }

  /**
   * Check if a channel has any receivers
   */
  hasReceivers(channel: string): boolean {
    return (this.channels.get(channel)?.receivers.size ?? 0) > 0;
  }

  static getInstance(): MessageChannelRegistry {
    if (!MessageChannelRegistry.instance) {
      MessageChannelRegistry.instance = new MessageChannelRegistry();
    }

    return MessageChannelRegistry.instance;
  }
}
