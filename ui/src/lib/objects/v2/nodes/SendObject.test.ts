import { describe, expect, it } from 'vitest';

import { MessageChannelRegistry } from '$lib/messages/MessageChannelRegistry';
import { SendObject } from './SendObject';

import type { ObjectContext } from '../ObjectContext';

function createSend(channel: string) {
  const values: Array<string | null> = [null, channel];
  const context = {
    getParam(indexOrName: number | string) {
      return indexOrName === 'channel' || indexOrName === 1 ? values[1] : values[0];
    },
    setParam(indexOrName: number | string, value: unknown) {
      if (indexOrName === 'channel' || indexOrName === 1) values[1] = String(value);
    },
    onParamsChange(callback: (params: unknown[], index: number, value: unknown) => void) {
      return () => callback;
    }
  } as unknown as ObjectContext;

  const object = new SendObject(`send-${crypto.randomUUID()}`, context);
  object.create();

  return object;
}

describe('SendObject', () => {
  it('registers its channel name for patchbay resolution', () => {
    const channel = `send-channel-${crypto.randomUUID()}`;
    const object = createSend(channel);

    expect(MessageChannelRegistry.getInstance().getChannelNames()).toContain(channel);

    object.destroy();

    expect(MessageChannelRegistry.getInstance().getChannelNames()).not.toContain(channel);
  });

  it('exposes sender node ids for a channel', () => {
    const channel = `send-channel-${crypto.randomUUID()}`;
    const object = createSend(channel);

    expect(MessageChannelRegistry.getInstance().getChannelNodeIds(channel)).toEqual([
      object.nodeId
    ]);

    object.destroy();
  });

  it('does not expose synthetic patchbay subscribers as receiver channels', () => {
    const registry = MessageChannelRegistry.getInstance();
    const channel = `patchbay-source-${crypto.randomUUID()}`;
    const syntheticNodeId = `patchbay-${crypto.randomUUID()}:${channel}`;

    registry.subscribe(channel, syntheticNodeId, () => {});

    expect(registry.getReceiverChannelNames()).not.toContain(channel);
    expect(registry.getChannelNodeIds(channel)).toEqual([]);

    registry.unsubscribe(channel, syntheticNodeId);
  });
});
