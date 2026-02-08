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

export class AudioChannelRegistry {
  private static instance: AudioChannelRegistry | null = null;

  private channels = new Map<string, AudioChannelData>();

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

  static getInstance(): AudioChannelRegistry {
    if (!AudioChannelRegistry.instance) {
      AudioChannelRegistry.instance = new AudioChannelRegistry();
    }

    return AudioChannelRegistry.instance;
  }
}
