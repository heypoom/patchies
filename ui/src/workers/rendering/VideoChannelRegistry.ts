import {
  VideoChannelMembership,
  type VideoChannelRole
} from '../../lib/video/VideoChannelMembership';
import type { RenderEdge } from '../../lib/rendering/types';

/**
 * VideoChannelRegistry manages wireless video routing between send.vdo and recv.vdo nodes.
 * Lives in the render worker to generate virtual edges before building the render graph.
 *
 * Pattern: send.vdo registers as sender, recv.vdo registers as receiver.
 * Virtual edges connect all senders to all receivers on the same channel.
 */
export class VideoChannelRegistry {
  private static instance: VideoChannelRegistry | null = null;
  private membership = new VideoChannelMembership();

  private constructor() {}

  /**
   * Subscribe a node to a video channel.
   * @param channel - The channel name
   * @param nodeId - The node ID
   * @param role - Whether this node sends or receives on this channel
   */
  subscribe(channel: string, nodeId: string, role: VideoChannelRole): void {
    this.membership.subscribe(channel, nodeId, role);
  }

  /**
   * Unsubscribe a node from a video channel.
   */
  unsubscribe(channel: string, nodeId: string): void {
    this.membership.unsubscribe(channel, nodeId);
  }

  /**
   * Unsubscribe a node from all channels.
   */
  unsubscribeAll(nodeId: string): void {
    this.membership.unsubscribeAll(nodeId);
  }

  /**
   * Generate virtual edges connecting send.vdo nodes to recv.vdo nodes on the same channel.
   * These edges are merged into the render graph before building FBOs.
   */
  getVirtualEdges(): RenderEdge[] {
    const edges: RenderEdge[] = [];

    for (const [channel, data] of this.membership.entries()) {
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
