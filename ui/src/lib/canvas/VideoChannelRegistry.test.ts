import { describe, expect, it } from 'vitest';

import { VideoChannelRegistry } from './VideoChannelRegistry';

describe('VideoChannelRegistry', () => {
  it('exposes sender and receiver channel names separately', () => {
    const registry = VideoChannelRegistry.getInstance();
    const suffix = crypto.randomUUID();
    const source = `video-source-${suffix}`;
    const destination = `video-destination-${suffix}`;
    const senderId = `send-video-${suffix}`;
    const receiverId = `recv-video-${suffix}`;

    registry.subscribe(source, senderId, 'send');
    registry.subscribe(destination, receiverId, 'recv');

    expect(registry.getSenderChannelNames()).toContain(source);
    expect(registry.getReceiverChannelNames()).toContain(destination);
    expect(registry.getReceiverChannelNames()).not.toContain(source);
    expect(registry.getSenderChannelNames()).not.toContain(destination);

    registry.unsubscribe(source, senderId);
    registry.unsubscribe(destination, receiverId);
  });

  it('ignores synthetic patchbay endpoints for discovery and node jumps', () => {
    const registry = VideoChannelRegistry.getInstance();
    const suffix = crypto.randomUUID();
    const channel = `video-patchbay-${suffix}`;
    const senderId = `patchbay-${suffix}:video-send:${channel}`;
    const receiverId = `patchbay-${suffix}:video-recv:${channel}`;

    registry.subscribe(channel, senderId, 'send');
    registry.subscribe(channel, receiverId, 'recv');

    expect(registry.getSenderChannelNames()).not.toContain(channel);
    expect(registry.getReceiverChannelNames()).not.toContain(channel);
    expect(registry.getChannelNodeIds(channel)).toEqual([]);

    registry.unsubscribe(channel, senderId);
    registry.unsubscribe(channel, receiverId);
  });

  it('notifies listeners when real channel membership changes', () => {
    const registry = VideoChannelRegistry.getInstance();
    const channel = `video-observed-${crypto.randomUUID()}`;
    const nodeId = `send-video-${crypto.randomUUID()}`;
    let count = 0;
    const unsubscribe = registry.onChannelsChange(() => {
      count += 1;
    });

    registry.subscribe(channel, nodeId, 'send');
    registry.unsubscribe(channel, nodeId);

    expect(count).toBe(2);

    unsubscribe();
  });
});
