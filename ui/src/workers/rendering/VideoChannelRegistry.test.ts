import { describe, expect, it } from 'vitest';

import { VideoChannelRegistry } from './VideoChannelRegistry';

describe('worker VideoChannelRegistry', () => {
  it('generates virtual render edges for matching senders and receivers', () => {
    const registry = VideoChannelRegistry.getInstance();
    const suffix = crypto.randomUUID();
    const channel = `worker-video-${suffix}`;
    const senderId = `send-vdo-${suffix}`;
    const receiverId = `recv-vdo-${suffix}`;

    registry.subscribe(channel, senderId, 'send');
    registry.subscribe(channel, receiverId, 'recv');

    expect(registry.getVirtualEdges()).toContainEqual({
      id: `virtual-video-${channel}-${senderId}-${receiverId}`,
      source: senderId,
      target: receiverId,
      sourceHandle: 'video-out',
      targetHandle: 'video-in-0'
    });

    registry.unsubscribeAll(senderId);
    registry.unsubscribeAll(receiverId);
  });
});
