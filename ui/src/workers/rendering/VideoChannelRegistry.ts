import type { RenderEdge } from '../../lib/rendering/types';

interface VideoChannelData {
  senders: Set<string>; // nodeIds that send on this channel
  receivers: Set<string>; // nodeIds that receive on this channel
}

/**
 * VideoChannelRegistry manages wireless video routing between send.vdo and recv.vdo nodes.
 * Lives in the render worker to generate virtual edges before building the render graph.
 *
 * Pattern: send.vdo registers as sender, recv.vdo registers as receiver.
 * Virtual edges connect all senders to all receivers on the same channel.
 */
export class VideoChannelRegistry {
  private static instance: VideoChannelRegistry | null = null;

  private channels = new Map<string, VideoChannelData>();

  private constructor() {}

  /**
   * Subscribe a node to a video channel.
   * @param channel - The channel name
   * @param nodeId - The node ID
   * @param role - Whether this node sends or receives on this channel
   */
  subscribe(channel: string, nodeId: string, role: 'send' | 'recv'): void {
    let channelData = this.channels.get(channel);

    if (!channelData) {
      channelData = { senders: new Set(), receivers: new Set() };
      this.channels.set(channel, channelData);
    }

    if (role === 'send') {
      channelData.senders.add(nodeId);
    } else {
      channelData.receivers.add(nodeId);
    }
  }

  /**
   * Unsubscribe a node from a video channel.
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
   * Unsubscribe a node from all channels.
   */
  unsubscribeAll(nodeId: string): void {
    for (const [channel, data] of this.channels) {
      data.senders.delete(nodeId);
      data.receivers.delete(nodeId);

      if (data.senders.size === 0 && data.receivers.size === 0) {
        this.channels.delete(channel);
      }
    }
  }

  /**
   * Generate virtual edges connecting send.vdo nodes to recv.vdo nodes on the same channel.
   * These edges are merged into the render graph before building FBOs.
   */
  getVirtualEdges(): RenderEdge[] {
    const edges: RenderEdge[] = [];

    for (const [channel, data] of this.channels) {
      // Connect each sender to each receiver on this channel
      for (const senderId of data.senders) {
        for (const receiverId of data.receivers) {
          edges.push({
            id: `virtual-video-${channel}-${senderId}-${receiverId}`,
            source: senderId,
            target: receiverId,
            sourceHandle: 'video-out',
            targetHandle: 'video-in-0'
          });
        }
      }
    }

    return edges;
  }

  /**
   * Get the singleton instance.
   */
  static getInstance(): VideoChannelRegistry {
    if (VideoChannelRegistry.instance === null) {
      VideoChannelRegistry.instance = new VideoChannelRegistry();
    }

    return VideoChannelRegistry.instance;
  }
}
