/**
 * AudioChannelRegistry - Manages named audio channel subscriptions for send~/recv~ nodes
 *
 * Tracks sender/receiver membership and generates virtual edges for AudioService.
 */

import type { Edge } from '@xyflow/svelte';

interface AudioChannelData {
  senders: Set<string>; // nodeIds of send~ nodes
  receivers: Set<string>; // nodeIds of recv~ nodes
}

export type AudioChannelRegistryListener = () => void;

export class AudioChannelRegistry {
  private static instance: AudioChannelRegistry | null = null;

  private channels = new Map<string, AudioChannelData>();
  private channelListeners = new Set<AudioChannelRegistryListener>();
  private virtualEdgeListeners = new Set<AudioChannelRegistryListener>();

  /**
   * Subscribe an audio node to a channel as sender or receiver
   */
  subscribe(channel: string, nodeId: string, role: 'send' | 'recv'): void {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, { senders: new Set(), receivers: new Set() });
    }

    const channelData = this.channels.get(channel)!;

    if (role === 'send') {
      channelData.senders.add(nodeId);
    } else {
      channelData.receivers.add(nodeId);
    }

    if (this.isRealNodeId(nodeId)) {
      this.notifyChannelListeners();
    }
    this.notifyVirtualEdgeListeners();
  }

  /**
   * Unsubscribe an audio node from a channel
   */
  unsubscribe(channel: string, nodeId: string): void {
    const channelData = this.channels.get(channel);
    if (!channelData) return;

    channelData.senders.delete(nodeId);
    channelData.receivers.delete(nodeId);

    // Clean up empty channels
    if (channelData.senders.size === 0 && channelData.receivers.size === 0) {
      this.channels.delete(channel);
    }

    if (this.isRealNodeId(nodeId)) {
      this.notifyChannelListeners();
    }
    this.notifyVirtualEdgeListeners();
  }

  getSenderChannelNames(): string[] {
    return Array.from(this.channels.entries())
      .filter(([, data]) => Array.from(data.senders).some((nodeId) => this.isRealNodeId(nodeId)))
      .map(([channel]) => channel);
  }

  getReceiverChannelNames(): string[] {
    return Array.from(this.channels.entries())
      .filter(([, data]) => Array.from(data.receivers).some((nodeId) => this.isRealNodeId(nodeId)))
      .map(([channel]) => channel);
  }

  getChannelNodeIds(channel: string): string[] {
    const channelData = this.channels.get(channel);
    if (!channelData) return [];

    return Array.from(new Set([...channelData.senders, ...channelData.receivers])).filter(
      (nodeId) => this.isRealNodeId(nodeId)
    );
  }

  /**
   * Get virtual edges for all audio channels.
   * Returns Edge objects connecting each sender to all receivers on the same channel.
   */
  getVirtualEdges(): Edge[] {
    const edges: Edge[] = [];
    let edgeCounter = 0;

    for (const [channel, data] of this.channels) {
      for (const senderId of data.senders) {
        for (const receiverId of data.receivers) {
          edges.push({
            id: `virtual-audio-${channel}-${edgeCounter++}`,
            source: senderId,
            target: receiverId,
            sourceHandle: 'audio-out',
            targetHandle: 'audio-in'
          });
        }
      }
    }

    return edges;
  }

  onChannelsChange(listener: AudioChannelRegistryListener): () => void {
    this.channelListeners.add(listener);

    return () => {
      this.channelListeners.delete(listener);
    };
  }

  onVirtualEdgesChange(listener: AudioChannelRegistryListener): () => void {
    this.virtualEdgeListeners.add(listener);

    return () => {
      this.virtualEdgeListeners.delete(listener);
    };
  }

  private isRealNodeId(nodeId: string): boolean {
    return !nodeId.includes(':');
  }

  private notifyChannelListeners(): void {
    for (const listener of this.channelListeners) {
      listener();
    }
  }

  private notifyVirtualEdgeListeners(): void {
    for (const listener of this.virtualEdgeListeners) {
      listener();
    }
  }

  static getInstance(): AudioChannelRegistry {
    if (!AudioChannelRegistry.instance) {
      AudioChannelRegistry.instance = new AudioChannelRegistry();
    }

    return AudioChannelRegistry.instance;
  }
}
