export type VideoChannelRole = 'send' | 'recv';

export type VideoChannelData = {
  senders: Set<string>;
  receivers: Set<string>;
};

export class VideoChannelMembership {
  private channels = new Map<string, VideoChannelData>();

  subscribe(channel: string, nodeId: string, role: VideoChannelRole): void {
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

  unsubscribe(channel: string, nodeId: string): boolean {
    const channelData = this.channels.get(channel);
    if (!channelData) return false;

    const changed = channelData.senders.delete(nodeId) || channelData.receivers.delete(nodeId);
    this.deleteChannelIfEmpty(channel, channelData);

    return changed;
  }

  unsubscribeAll(nodeId: string): boolean {
    let changed = false;

    for (const [channel, channelData] of this.channels) {
      changed = channelData.senders.delete(nodeId) || changed;
      changed = channelData.receivers.delete(nodeId) || changed;

      this.deleteChannelIfEmpty(channel, channelData);
    }

    return changed;
  }

  entries(): IterableIterator<[string, VideoChannelData]> {
    return this.channels.entries();
  }

  getChannel(channel: string): VideoChannelData | undefined {
    return this.channels.get(channel);
  }

  private deleteChannelIfEmpty(channel: string, channelData: VideoChannelData): void {
    if (channelData.senders.size === 0 && channelData.receivers.size === 0) {
      this.channels.delete(channel);
    }
  }
}
