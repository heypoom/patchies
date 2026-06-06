import { describe, expect, it } from 'vitest';

import { AudioChannelRegistry } from './AudioChannelRegistry';

describe('AudioChannelRegistry', () => {
  it('exposes sender and receiver channel names separately', () => {
    const registry = AudioChannelRegistry.getInstance();
    const suffix = crypto.randomUUID();
    const source = `audio-source-${suffix}`;
    const destination = `audio-destination-${suffix}`;
    const senderId = `send-audio-${suffix}`;
    const receiverId = `recv-audio-${suffix}`;

    registry.subscribe(source, senderId, 'send');
    registry.subscribe(destination, receiverId, 'recv');

    expect(registry.getSenderChannelNames()).toContain(source);
    expect(registry.getReceiverChannelNames()).toContain(destination);
    expect(registry.getReceiverChannelNames()).not.toContain(source);
    expect(registry.getSenderChannelNames()).not.toContain(destination);

    registry.unsubscribe(source, senderId);
    registry.unsubscribe(destination, receiverId);
  });

  it('ignores synthetic patchbay endpoints for channel discovery and node jumps', () => {
    const registry = AudioChannelRegistry.getInstance();
    const suffix = crypto.randomUUID();
    const channel = `audio-patchbay-${suffix}`;
    const senderId = `patchbay-${suffix}:audio-send:${channel}`;
    const receiverId = `patchbay-${suffix}:audio-recv:${channel}`;

    registry.subscribe(channel, senderId, 'send');
    registry.subscribe(channel, receiverId, 'recv');

    expect(registry.getSenderChannelNames()).not.toContain(channel);
    expect(registry.getReceiverChannelNames()).not.toContain(channel);
    expect(registry.getChannelNodeIds(channel)).toEqual([]);

    registry.unsubscribe(channel, senderId);
    registry.unsubscribe(channel, receiverId);
  });

  it('notifies listeners when real channel membership changes', () => {
    const registry = AudioChannelRegistry.getInstance();
    const channel = `audio-observed-${crypto.randomUUID()}`;
    const nodeId = `send-audio-${crypto.randomUUID()}`;
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
