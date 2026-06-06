import { describe, expect, it } from 'vitest';

import { MessageChannelRegistry } from '$lib/messages/MessageChannelRegistry';
import { SendObject } from './SendObject';

import type { ObjectContext } from '../ObjectContext';

function createSend(channel: string) {
  const values: Array<string | null> = [null, channel];
  const paramsChangeCallbacks = new Set<
    (params: unknown[], index: number, value: unknown) => void
  >();
  const context = {
    getParam(indexOrName: number | string) {
      return indexOrName === 'channel' || indexOrName === 1 ? values[1] : values[0];
    },
    setParam(indexOrName: number | string, value: unknown) {
      if (indexOrName === 'channel' || indexOrName === 1) values[1] = String(value);
    },
    onParamsChange(callback: (params: unknown[], index: number, value: unknown) => void) {
      paramsChangeCallbacks.add(callback);
      return () => {
        paramsChangeCallbacks.delete(callback);
      };
    }
  } as unknown as ObjectContext;

  const object = new SendObject(`send-${crypto.randomUUID()}`, context);
  object.create();

  return {
    object,
    triggerParamsChange(params: unknown[], index: number, value: unknown) {
      for (const callback of paramsChangeCallbacks) {
        callback(params, index, value);
      }
    }
  };
}

describe('SendObject', () => {
  it('registers its channel name for patchbay resolution', () => {
    const channel = `send-channel-${crypto.randomUUID()}`;
    const { object } = createSend(channel);

    expect(MessageChannelRegistry.getInstance().getChannelNames()).toContain(channel);

    object.destroy();

    expect(MessageChannelRegistry.getInstance().getChannelNames()).not.toContain(channel);
  });

  it('exposes sender node ids for a channel', () => {
    const channel = `send-channel-${crypto.randomUUID()}`;
    const { object } = createSend(channel);

    expect(MessageChannelRegistry.getInstance().getChannelNodeIds(channel)).toEqual([
      object.nodeId
    ]);

    object.destroy();
  });

  it('re-registers when the channel parameter changes', () => {
    const oldChannel = `send-channel-old-${crypto.randomUUID()}`;
    const newChannel = `send-channel-new-${crypto.randomUUID()}`;
    const { object, triggerParamsChange } = createSend(oldChannel);

    expect(MessageChannelRegistry.getInstance().getChannelNodeIds(oldChannel)).toEqual([
      object.nodeId
    ]);

    object.context.setParam('channel', newChannel);
    triggerParamsChange([null, newChannel], 1, newChannel);

    expect(MessageChannelRegistry.getInstance().getChannelNodeIds(oldChannel)).toEqual([]);
    expect(MessageChannelRegistry.getInstance().getChannelNodeIds(newChannel)).toEqual([
      object.nodeId
    ]);

    object.destroy();
  });

  it('does not re-register after destroy when params change', () => {
    const oldChannel = `send-channel-old-${crypto.randomUUID()}`;
    const newChannel = `send-channel-new-${crypto.randomUUID()}`;
    const { object, triggerParamsChange } = createSend(oldChannel);

    object.destroy();
    object.context.setParam('channel', newChannel);
    triggerParamsChange([null, newChannel], 1, newChannel);

    expect(MessageChannelRegistry.getInstance().getChannelNodeIds(oldChannel)).toEqual([]);
    expect(MessageChannelRegistry.getInstance().getChannelNodeIds(newChannel)).toEqual([]);
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
