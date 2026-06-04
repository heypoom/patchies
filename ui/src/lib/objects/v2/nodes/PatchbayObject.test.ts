import { describe, expect, it } from 'vitest';

import { MessageChannelRegistry } from '$lib/messages/MessageChannelRegistry';
import { PatchbayObject } from './PatchbayObject';

import type { ObjectContext } from '../ObjectContext';

function createPatchbay(code: string) {
  const params = [code];
  const context = {
    getParam(indexOrName: number | string) {
      return indexOrName === 'code' || indexOrName === 0 ? params[0] : undefined;
    },
    setParam(indexOrName: number | string, value: unknown) {
      if (indexOrName === 'code' || indexOrName === 0) {
        params[0] = value as string;
      }
    },
    onParamsChange(callback: (params: unknown[], index: number, value: unknown) => void) {
      return () => callback;
    }
  } as unknown as ObjectContext;

  const object = new PatchbayObject(`patchbay-${crypto.randomUUID()}`, context);
  object.create([]);

  return { object, params };
}

function collectChannel(channel: string) {
  const registry = MessageChannelRegistry.getInstance();
  const nodeId = `collector-${crypto.randomUUID()}`;
  const messages: unknown[] = [];

  registry.subscribe(channel, nodeId, (message) => {
    messages.push(message);
  });

  return {
    messages,
    destroy: () => registry.unsubscribe(channel, nodeId)
  };
}

describe('PatchbayObject', () => {
  it('forwards messages through declared virtual channels', () => {
    const suffix = crypto.randomUUID();
    const source = `source-${suffix}`;
    const bus = `bus-${suffix}`;
    const destination = `destination-${suffix}`;
    const collector = collectChannel(destination);
    const { object } = createPatchbay(`
      [Message]
      chan ${source}
      chan ${bus}
      chan ${destination}
      ${source} -> ${bus} -> ${destination}
    `);

    MessageChannelRegistry.getInstance().broadcast(source, { type: 'bang' }, 'sender');

    expect(collector.messages).toEqual([{ type: 'bang' }]);

    object.destroy();
    collector.destroy();
  });

  it('removes stale routes when the code changes', () => {
    const suffix = crypto.randomUUID();
    const source = `source-${suffix}`;
    const oldDestination = `old-${suffix}`;
    const newDestination = `new-${suffix}`;
    const oldCollector = collectChannel(oldDestination);
    const newCollector = collectChannel(newDestination);
    const { object, params } = createPatchbay(`
      [Message]
      chan ${source}
      chan ${oldDestination}
      ${source} -> ${oldDestination}
    `);

    params[0] = `
      [Message]
      chan ${source}
      chan ${newDestination}
      ${source} -> ${newDestination}
    `;
    object.applyCode();

    MessageChannelRegistry.getInstance().broadcast(source, 'hello', 'sender');

    expect(oldCollector.messages).toEqual([]);
    expect(newCollector.messages).toEqual(['hello']);

    object.destroy();
    oldCollector.destroy();
    newCollector.destroy();
  });

  it('keeps the last valid routes active when edited code has errors', () => {
    const suffix = crypto.randomUUID();
    const source = `source-${suffix}`;
    const destination = `destination-${suffix}`;
    const collector = collectChannel(destination);
    const { object, params } = createPatchbay(`
      [Message]
      chan ${source}
      chan ${destination}
      ${source} -> ${destination}
    `);

    params[0] = `
      [Message]
      chan ${source}
      ${source} -> Missing-${suffix}
    `;
    object.applyCode();

    MessageChannelRegistry.getInstance().broadcast(source, 'still-routes', 'sender');

    expect(collector.messages).toEqual(['still-routes']);

    object.destroy();
    collector.destroy();
  });

  it('revalidates when message channels register after patchbay creation', () => {
    const suffix = crypto.randomUUID();
    const source = `late-source-${suffix}`;
    const bus = `late-bus-${suffix}`;
    const destination = `late-destination-${suffix}`;
    const registry = MessageChannelRegistry.getInstance();
    const { object } = createPatchbay(`
      [Message]
      chan ${bus}
      ${source} -> ${bus} -> ${destination}
    `);

    expect(object.diagnostics.map((diagnostic) => diagnostic.name)).toEqual([source, destination]);

    registry.registerSender(source, `send-${suffix}`);
    registry.subscribe(destination, `recv-${suffix}`, () => {});

    expect(object.diagnostics).toEqual([]);

    object.destroy();
    registry.unregisterSender(source, `send-${suffix}`);
    registry.unsubscribe(destination, `recv-${suffix}`);
  });
});
