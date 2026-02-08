/**
 * ChannelRegistry - Manages named channel subscriptions for send/recv objects
 *
 * Phase 1: Message channels with direct broadcast
 * Phase 2: Will add audio channels with virtual edges
 * Phase 3: Will add video channels with virtual edges
 */

export type MessageChannelCallback = (message: unknown, sourceNodeId: string) => void;

interface MessageChannelData {
  receivers: Map<string, MessageChannelCallback>; // nodeId -> callback
}

export class ChannelRegistry {
  private static instance: ChannelRegistry | null = null;

  private messageChannels = new Map<string, MessageChannelData>();

  static getInstance(): ChannelRegistry {
    if (!ChannelRegistry.instance) {
      ChannelRegistry.instance = new ChannelRegistry();
    }
    return ChannelRegistry.instance;
  }

  /**
   * Subscribe a recv node to a message channel
   */
  subscribeMessage(channel: string, nodeId: string, callback: MessageChannelCallback): void {
    if (!this.messageChannels.has(channel)) {
      this.messageChannels.set(channel, { receivers: new Map() });
    }
    this.messageChannels.get(channel)!.receivers.set(nodeId, callback);
  }

  /**
   * Unsubscribe a recv node from a message channel
   */
  unsubscribeMessage(channel: string, nodeId: string): void {
    const channelData = this.messageChannels.get(channel);
    if (!channelData) return;

    channelData.receivers.delete(nodeId);

    // Clean up empty channels
    if (channelData.receivers.size === 0) {
      this.messageChannels.delete(channel);
    }
  }

  /**
   * Broadcast a message to all receivers on a channel
   * Called by send nodes and JS send() with channel option
   */
  broadcast(channel: string, message: unknown, sourceNodeId: string): void {
    const channelData = this.messageChannels.get(channel);
    if (!channelData) return;

    for (const [, callback] of channelData.receivers) {
      try {
        callback(message, sourceNodeId);
      } catch (error) {
        console.error(`ChannelRegistry: Error broadcasting to channel "${channel}":`, error);
      }
    }
  }

  /**
   * Get the number of receivers on a channel (useful for debugging/UI)
   */
  getReceiverCount(channel: string): number {
    return this.messageChannels.get(channel)?.receivers.size ?? 0;
  }

  /**
   * Check if a channel has any receivers
   */
  hasReceivers(channel: string): boolean {
    return (this.messageChannels.get(channel)?.receivers.size ?? 0) > 0;
  }
}
