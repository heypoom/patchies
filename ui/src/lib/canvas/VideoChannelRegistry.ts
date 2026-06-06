import { VideoChannelMembership, type VideoChannelRole } from '$lib/video/VideoChannelMembership';

export type VideoChannelRegistryListener = () => void;

export class VideoChannelRegistry {
  private static instance: VideoChannelRegistry | null = null;

  private membership = new VideoChannelMembership();
  private listeners = new Set<VideoChannelRegistryListener>();

  subscribe(channel: string, nodeId: string, role: VideoChannelRole): void {
    this.membership.subscribe(channel, nodeId, role);

    if (this.isRealNodeId(nodeId)) {
      this.notifyListeners();
    }
  }

  unsubscribe(channel: string, nodeId: string): void {
    const changed = this.membership.unsubscribe(channel, nodeId);

    if (changed && this.isRealNodeId(nodeId)) {
      this.notifyListeners();
    }
  }

  unsubscribeAll(nodeId: string): void {
    const changed = this.membership.unsubscribeAll(nodeId);

    if (changed && this.isRealNodeId(nodeId)) {
      this.notifyListeners();
    }
  }

  getSenderChannelNames(): string[] {
    return Array.from(this.membership.entries())
      .filter(([, data]) => Array.from(data.senders).some((nodeId) => this.isRealNodeId(nodeId)))
      .map(([channel]) => channel);
  }

  getReceiverChannelNames(): string[] {
    return Array.from(this.membership.entries())
      .filter(([, data]) => Array.from(data.receivers).some((nodeId) => this.isRealNodeId(nodeId)))
      .map(([channel]) => channel);
  }

  getChannelNodeIds(channel: string): string[] {
    const channelData = this.membership.getChannel(channel);
    if (!channelData) return [];

    return Array.from(new Set([...channelData.senders, ...channelData.receivers])).filter(
      (nodeId) => this.isRealNodeId(nodeId)
    );
  }

  onChannelsChange(listener: VideoChannelRegistryListener): () => void {
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

  static getInstance(): VideoChannelRegistry {
    if (!VideoChannelRegistry.instance) {
      VideoChannelRegistry.instance = new VideoChannelRegistry();
    }

    return VideoChannelRegistry.instance;
  }
}
