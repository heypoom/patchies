import { describe, expect, it, vi } from 'vitest';

import { PatchbayVideoIntegration } from './PatchbayVideoIntegration';
import { VideoChannelRegistry } from './VideoChannelRegistry';

describe('PatchbayVideoIntegration', () => {
  it('registers hidden recv/send nodes and a virtual edge for channel routes', () => {
    const upsertNode = vi.fn();
    const removeNode = vi.fn();
    const onGraphChanged = vi.fn();
    const integration = new PatchbayVideoIntegration({
      upsertNode,
      removeNode,
      onGraphChanged
    });

    integration.registerRoute('route-1', 'Source', 'Target');

    expect(upsertNode).toHaveBeenCalledWith(
      'route-1:video-recv:Source',
      'recv.vdo',
      { channel: 'Source' },
      { force: true }
    );
    expect(upsertNode).toHaveBeenCalledWith(
      'route-1:video-send:Target',
      'send.vdo',
      { channel: 'Target' },
      { force: true }
    );
    expect(integration.getEdges()).toEqual([
      {
        id: 'route-1:video-edge:Source->Target',
        source: 'route-1:video-recv:Source',
        target: 'route-1:video-send:Target',
        sourceHandle: 'video-out',
        targetHandle: 'video-in-0'
      }
    ]);
    expect(onGraphChanged).toHaveBeenCalledTimes(1);

    integration.unregisterRoute('route-1');

    expect(removeNode).toHaveBeenCalledWith('route-1:video-recv:Source');
    expect(removeNode).toHaveBeenCalledWith('route-1:video-send:Target');
    expect(integration.getEdges()).toEqual([]);
    expect(onGraphChanged).toHaveBeenCalledTimes(2);
  });

  it('keeps video channel registry membership stable for unchanged nodes', () => {
    const registry = VideoChannelRegistry.getInstance();
    const channel = `patchbay-video-integration-${crypto.randomUUID()}`;
    const nodeId = `recv-video-${crypto.randomUUID()}`;
    const integration = new PatchbayVideoIntegration({
      upsertNode: vi.fn(),
      removeNode: vi.fn(),
      onGraphChanged: vi.fn(),
      videoChannelRegistry: registry
    });

    integration.registerVideoChannelNode(nodeId, 'recv.vdo', { channel });
    integration.registerVideoChannelNode(nodeId, 'recv.vdo', { channel });

    expect(registry.getReceiverChannelNames()).toContain(channel);

    integration.unregisterVideoChannelNode(nodeId);
    expect(registry.getReceiverChannelNames()).not.toContain(channel);
  });
});
