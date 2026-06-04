export type AudioChannelRegistryListener = () => void;

export class AudioChannelRegistryListeners {
  private channelListeners = new Set<AudioChannelRegistryListener>();
  private virtualEdgeListeners = new Set<AudioChannelRegistryListener>();

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

  notifyChannelsChanged(): void {
    for (const listener of this.channelListeners) {
      listener();
    }
  }

  notifyVirtualEdgesChanged(): void {
    for (const listener of this.virtualEdgeListeners) {
      listener();
    }
  }
}
