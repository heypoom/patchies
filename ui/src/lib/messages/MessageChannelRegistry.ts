/**
 * MessageChannelRegistry - Manages named message channel subscriptions for send/recv objects
 *
 * Handles direct broadcast of messages to all receivers on a channel.
 */

import { profiler } from '$lib/profiler';

export type MessageChannelCallback = (message: unknown, sourceNodeId: string) => void;
export type MessageChannelRegistryListener = () => void;

interface MessageChannelData {
  senders: Set<string>;
  receivers: Map<string, MessageChannelCallback>; // nodeId -> callback
}

export class MessageChannelRegistry {
  private static instance: MessageChannelRegistry | null = null;

  private channels = new Map<string, MessageChannelData>();
  private listeners = new Set<MessageChannelRegistryListener>();

  /**
   * Subscribe a recv node to a message channel
   */
  subscribe(channel: string, nodeId: string, callback: MessageChannelCallback): void {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, { senders: new Set(), receivers: new Map() });
    }

    this.channels.get(channel)!.receivers.set(nodeId, callback);
    if (this.isRealNodeId(nodeId)) {
      this.notifyListeners();
    }
  }

  /**
   * Register a sender on a message channel so channel-aware tools can discover it.
   */
  registerSender(channel: string, nodeId: string): void {
    if (!this.isRealNodeId(nodeId)) return;

    if (!this.channels.has(channel)) {
      this.channels.set(channel, { senders: new Set(), receivers: new Map() });
    }

    const senders = this.channels.get(channel)!.senders;
    const hadSender = senders.has(nodeId);
    senders.add(nodeId);

    if (!hadSender) {
      this.notifyListeners();
    }
  }

  /**
   * Unregister a sender from a message channel.
   */
  unregisterSender(channel: string, nodeId: string): void {
    if (!this.isRealNodeId(nodeId)) return;

    const channelData = this.channels.get(channel);
    if (!channelData) return;

    const hadSender = channelData.senders.delete(nodeId);

    this.deleteChannelIfEmpty(channel, channelData);
    if (hadSender) {
      this.notifyListeners();
    }
  }

  /**
   * Unsubscribe a recv node from a message channel
   */
  unsubscribe(channel: string, nodeId: string): void {
    const channelData = this.channels.get(channel);
    if (!channelData) return;

    channelData.receivers.delete(nodeId);

    this.deleteChannelIfEmpty(channel, channelData);
    if (this.isRealNodeId(nodeId)) {
      this.notifyListeners();
    }
  }

  /**
   * Broadcast a message to all receivers on a channel
   * Called by send nodes and JS send() with channel option
   */
  broadcast(channel: string, message: unknown, sourceNodeId: string): void {
    const channelEntry = this.channels.get(channel);
    if (!channelEntry) return;

    profiler.measureBroadcast(() => {
      for (const [, callback] of channelEntry.receivers) {
        try {
          callback(message, sourceNodeId);
        } catch (error) {
          console.error(
            `MessageChannelRegistry: Error broadcasting to channel "${channel}":`,
            error
          );
        }
      }
    });
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

  /**
   * Get all known message channels.
   * Used by tools that need to resolve channel names without delivering messages.
   */
  getChannelNames(): string[] {
    return Array.from(this.channels.keys());
  }

  getSenderChannelNames(): string[] {
    return Array.from(this.channels.entries())
      .filter(([, channelData]) =>
        Array.from(channelData.senders).some((nodeId) => this.isRealNodeId(nodeId))
      )
      .map(([channel]) => channel);
  }

  getReceiverChannelNames(): string[] {
    return Array.from(this.channels.entries())
      .filter(([, channelData]) =>
        Array.from(channelData.receivers.keys()).some((nodeId) => this.isRealNodeId(nodeId))
      )
      .map(([channel]) => channel);
  }

  /**
   * Get real node IDs associated with a channel.
   * Synthetic patchbay subscriber IDs are excluded because they are not canvas nodes.
   */
  getChannelNodeIds(channel: string): string[] {
    const channelData = this.channels.get(channel);
    if (!channelData) return [];

    const nodeIds = new Set([...channelData.senders, ...channelData.receivers.keys()]);

    return Array.from(nodeIds).filter((nodeId) => this.isRealNodeId(nodeId));
  }

  onChannelsChange(listener: MessageChannelRegistryListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private isRealNodeId(nodeId: string): boolean {
    return !nodeId.includes(':');
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private deleteChannelIfEmpty(channel: string, channelData: MessageChannelData): void {
    if (channelData.senders.size === 0 && channelData.receivers.size === 0) {
      this.channels.delete(channel);
    }
  }

  static getInstance(): MessageChannelRegistry {
    if (!MessageChannelRegistry.instance) {
      MessageChannelRegistry.instance = new MessageChannelRegistry();
    }

    return MessageChannelRegistry.instance;
  }
}
