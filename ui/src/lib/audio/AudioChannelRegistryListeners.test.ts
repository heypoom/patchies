import { describe, expect, it } from 'vitest';

import { AudioChannelRegistryListeners } from './AudioChannelRegistryListeners';

describe('AudioChannelRegistryListeners', () => {
  it('tracks channel and virtual-edge listeners independently', () => {
    const listeners = new AudioChannelRegistryListeners();
    let channelCount = 0;
    let virtualEdgeCount = 0;

    const unsubscribeChannels = listeners.onChannelsChange(() => {
      channelCount += 1;
    });
    const unsubscribeVirtualEdges = listeners.onVirtualEdgesChange(() => {
      virtualEdgeCount += 1;
    });

    listeners.notifyChannelsChanged();
    listeners.notifyVirtualEdgesChanged();
    unsubscribeChannels();
    listeners.notifyChannelsChanged();
    listeners.notifyVirtualEdgesChanged();
    unsubscribeVirtualEdges();
    listeners.notifyVirtualEdgesChanged();

    expect(channelCount).toBe(1);
    expect(virtualEdgeCount).toBe(2);
  });
});
