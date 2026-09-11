import { describe, expect, it } from 'vitest';

import { MessageChannelRegistry } from '$lib/messages/MessageChannelRegistry';
import { SendObject } from '$objects/send-recv/SendObject';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';

function createSend(channel: string) {
  const values: Array<string | null> = [null, channel];
  const setParamOptions: unknown[] = [];

  const paramsChangeCallbacks = new Set<
    (params: unknown[], index: number, value: unknown) => void
  >();

  const context = {
    getParam(indexOrName: number | string) {
      return indexOrName === 'channel' || indexOrName === 1 ? values[1] : values[0];
    },
    setParam(indexOrName: number | string, value: unknown, options?: unknown) {
      if (indexOrName === 'channel' || indexOrName === 1) {
        values[1] = String(value);
        setParamOptions[1] = options;
      }
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
    setParamOptions,
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
    const registry = MessageChannelRegistry.getInstance();

    const { object } = createSend(channel);
    expect(registry.getChannelNames()).toContain(channel);

    object.destroy();
    expect(registry.getChannelNames()).not.toContain(channel);
  });

  it('exposes sender node ids for a channel', () => {
    const channel = `send-channel-${crypto.randomUUID()}`;
    const registry = MessageChannelRegistry.getInstance();

    const { object } = createSend(channel);
    expect(registry.getChannelNodeIds(channel)).toEqual([object.nodeId]);

    object.destroy();
  });

  it('re-registers when the channel parameter changes', () => {
    const oldChannel = `send-channel-old-${crypto.randomUUID()}`;
    const newChannel = `send-channel-new-${crypto.randomUUID()}`;
    const registry = MessageChannelRegistry.getInstance();

    const { object, triggerParamsChange } = createSend(oldChannel);
    expect(registry.getChannelNodeIds(oldChannel)).toEqual([object.nodeId]);

    object.context.setParam('channel', newChannel);
    triggerParamsChange([null, newChannel], 1, newChannel);

    expect(registry.getChannelNodeIds(oldChannel)).toEqual([]);
    expect(registry.getChannelNodeIds(newChannel)).toEqual([object.nodeId]);

    object.destroy();
  });

  it('updates the channel label when receiving a channel message', () => {
    const { object, setParamOptions } = createSend(`send-channel-${crypto.randomUUID()}`);

    object.onMessage('new-channel', {
      inletName: 'channel',
      source: ''
    });

    expect(object.context.getParam('channel')).toBe('new-channel');
    expect(setParamOptions[1]).toEqual({ notifyUI: true });

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
