import { describe, expect, it } from 'vitest';

import { AudioChannelRegistry } from '$lib/audio/AudioChannelRegistry';
import { VideoChannelRegistry } from '$lib/canvas/VideoChannelRegistry';
import { MessageChannelRegistry } from '$lib/messages/MessageChannelRegistry';
import { setPatchbayVideoRuntime } from '$lib/patchbay/patchbay-video-runtime';
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

  it('registers audio patchbay routes as virtual audio channel endpoints', () => {
    const suffix = crypto.randomUUID();
    const source = `audio-source-${suffix}`;
    const bus = `audio-bus-${suffix}`;
    const destination = `audio-destination-${suffix}`;
    const sourceNodeId = `send-audio-${suffix}`;
    const destinationNodeId = `recv-audio-${suffix}`;
    const registry = AudioChannelRegistry.getInstance();

    registry.subscribe(source, sourceNodeId, 'send');
    registry.subscribe(destination, destinationNodeId, 'recv');

    const { object } = createPatchbay(`
      [Audio]
      chan ${bus}
      ${source} -> ${bus} -> ${destination}
    `);

    const audioEdges = registry
      .getVirtualEdges()
      .filter(
        (edge) => edge.id.includes(source) || edge.id.includes(bus) || edge.id.includes(destination)
      );

    expect(audioEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: sourceNodeId,
          target: expect.stringContaining(`:audio-recv:${source}`),
          sourceHandle: 'audio-out',
          targetHandle: 'audio-in'
        }),
        expect.objectContaining({
          source: expect.stringContaining(`:audio-send:${bus}`),
          target: expect.stringContaining(`:audio-recv:${bus}`),
          sourceHandle: 'audio-out',
          targetHandle: 'audio-in'
        }),
        expect.objectContaining({
          source: expect.stringContaining(`:audio-send:${destination}`),
          target: destinationNodeId,
          sourceHandle: 'audio-out',
          targetHandle: 'audio-in'
        })
      ])
    );

    object.destroy();
    registry.unsubscribe(source, sourceNodeId);
    registry.unsubscribe(destination, destinationNodeId);
  });

  it('registers video patchbay routes as hidden recv.vdo to send.vdo pairs', () => {
    const suffix = crypto.randomUUID();
    const source = `video-source-${suffix}`;
    const bus = `video-bus-${suffix}`;
    const destination = `video-destination-${suffix}`;
    const sourceNodeId = `send-video-${suffix}`;
    const destinationNodeId = `recv-video-${suffix}`;
    const registry = VideoChannelRegistry.getInstance();
    const registeredRoutes: Array<{ routeId: string; from: string; to: string }> = [];
    const unregisteredRoutes: string[] = [];
    const restoreVideoRuntime = setPatchbayVideoRuntime({
      registerRoute(routeId, from, to) {
        registeredRoutes.push({ routeId, from, to });
      },
      unregisterRoute(routeId) {
        unregisteredRoutes.push(routeId);
      }
    });

    registry.subscribe(source, sourceNodeId, 'send');
    registry.subscribe(destination, destinationNodeId, 'recv');

    const { object } = createPatchbay(`
      [Video]
      chan ${bus}
      ${source} -> ${bus} -> ${destination}
    `);

    expect(object.diagnostics).toEqual([]);
    expect(registeredRoutes).toEqual([
      {
        routeId: expect.stringContaining(`video-route:${source}->${bus}`),
        from: source,
        to: bus
      },
      {
        routeId: expect.stringContaining(`video-route:${bus}->${destination}`),
        from: bus,
        to: destination
      }
    ]);

    object.destroy();
    expect(unregisteredRoutes).toEqual(registeredRoutes.map(({ routeId }) => routeId));

    restoreVideoRuntime();
    registry.unsubscribe(source, sourceNodeId);
    registry.unsubscribe(destination, destinationNodeId);
  });
});
