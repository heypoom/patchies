interface VideoChannelData {
  senders: Set<string>;
  receivers: Set<string>;
}

export type VideoChannelRegistryListener = () => void;

export class VideoChannelRegistry {
  private static instance: VideoChannelRegistry | null = null;

  private channels = new Map<string, VideoChannelData>();
  private listeners = new Set<VideoChannelRegistryListener>();

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
      this.notifyListeners();
    }
  }

  unsubscribe(channel: string, nodeId: string): void {
    const channelData = this.channels.get(channel);
    if (!channelData) return;

    channelData.senders.delete(nodeId);
    channelData.receivers.delete(nodeId);

    if (channelData.senders.size === 0 && channelData.receivers.size === 0) {
      this.channels.delete(channel);
    }

    if (this.isRealNodeId(nodeId)) {
      this.notifyListeners();
    }
  }

  unsubscribeAll(nodeId: string): void {
    let changed = false;

    for (const [channel, channelData] of this.channels) {
      changed = channelData.senders.delete(nodeId) || changed;
      changed = channelData.receivers.delete(nodeId) || changed;

      if (channelData.senders.size === 0 && channelData.receivers.size === 0) {
        this.channels.delete(channel);
      }
    }

    if (changed && this.isRealNodeId(nodeId)) {
      this.notifyListeners();
    }
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
