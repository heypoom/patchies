import { describe, expect, it } from 'vitest';

import { AudioChannelRegistry } from '$lib/audio/AudioChannelRegistry';
import { VideoChannelRegistry } from '$lib/canvas/VideoChannelRegistry';
import { MessageChannelRegistry } from '$lib/messages/MessageChannelRegistry';
import { MessageSystem } from '$lib/messages/MessageSystem';
import { setPatchbayAudioRuntime } from '$lib/patchbay/patchbay-audio-runtime';
import { setPatchbayMessageRuntime } from '$lib/patchbay/patchbay-message-runtime';
import { setPatchbayVideoRuntime } from '$lib/patchbay/patchbay-video-runtime';
import { PatchbayObject } from './PatchbayObject';

import type { ObjectContext } from '../ObjectContext';
import type { PatchbayAudioRuntime } from '$lib/patchbay/patchbay-audio-runtime';

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

function createPatchbayWithNodes(
  code: string,
  nodes: Array<{ id: string; type?: string; data: Record<string, unknown> }>
) {
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

  const object = new PatchbayObject(`patchbay-${crypto.randomUUID()}`, context, {
    getNodes: () => nodes
  });
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
      },
      registerEdge() {},
      unregisterEdge() {}
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

  it('keeps unchanged video channel routes stable when patchbay code re-applies', () => {
    const suffix = crypto.randomUUID();
    const source = `video-source-${suffix}`;
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
      },
      registerEdge() {},
      unregisterEdge() {}
    });

    registry.subscribe(source, sourceNodeId, 'send');
    registry.subscribe(destination, destinationNodeId, 'recv');

    const { object, params } = createPatchbay(`
      [Video]
      ${source} -> ${destination}
    `);

    params[0] = `
      [Video]
      // same route, edited code
      ${source} -> ${destination}
    `;

    object.applyCode();

    expect(object.diagnostics).toEqual([]);
    expect(registeredRoutes).toHaveLength(1);
    expect(unregisteredRoutes).toEqual([]);

    object.destroy();
    expect(unregisteredRoutes).toEqual(registeredRoutes.map(({ routeId }) => routeId));

    restoreVideoRuntime();
    registry.unsubscribe(source, sourceNodeId);
    registry.unsubscribe(destination, destinationNodeId);
  });

  it('registers message object endpoints as hidden message edges', () => {
    const suffix = crypto.randomUUID();
    const source = `message-source-${suffix}`;
    const targetNodeId = `js-${suffix}`;
    const registeredEdges: Array<{ routeId: string; edge: unknown }> = [];
    const unregisteredEdges: string[] = [];

    const restoreMessageRuntime = setPatchbayMessageRuntime({
      registerEdge(routeId, edge) {
        registeredEdges.push({ routeId, edge });
      },
      unregisterEdge(routeId) {
        unregisteredEdges.push(routeId);
      },
      registerEndpoint() {},
      unregisterEndpoint() {},
      sendFromEndpoint() {}
    });

    MessageChannelRegistry.getInstance().registerSender(source, `send-${suffix}`);

    const { object } = createPatchbayWithNodes(
      `
      [Message]
      ${source} -> obj ${targetNodeId}:0
      `,
      [{ id: targetNodeId, type: 'object', data: { name: 'js' } }]
    );

    expect(object.diagnostics).toEqual([]);

    expect(registeredEdges).toEqual([
      {
        routeId: expect.stringContaining(`message-edge:${source}->obj ${targetNodeId}:0`),
        edge: expect.objectContaining({
          target: targetNodeId,
          targetHandle: 'message-in-0'
        })
      }
    ]);

    object.destroy();
    expect(unregisteredEdges).toEqual(registeredEdges.map(({ routeId }) => routeId));

    restoreMessageRuntime();
    MessageChannelRegistry.getInstance().unregisterSender(source, `send-${suffix}`);
  });

  it('registers one message source routed to multiple object endpoints', () => {
    const suffix = crypto.randomUUID();
    const source = `message-source-${suffix}`;
    const targetA = `js-a-${suffix}`;
    const targetB = `js-b-${suffix}`;
    const registeredEdges: Array<{ routeId: string; edge: unknown }> = [];
    const unregisteredEdges: string[] = [];
    const endpointMessages: Array<{ sourceNodeId: string; message: unknown }> = [];

    const restoreMessageRuntime = setPatchbayMessageRuntime({
      registerEdge(routeId, edge) {
        registeredEdges.push({ routeId, edge });
      },
      unregisterEdge(routeId) {
        unregisteredEdges.push(routeId);
      },
      registerEndpoint() {},
      unregisterEndpoint() {},
      sendFromEndpoint(sourceNodeId, message) {
        endpointMessages.push({ sourceNodeId, message });
      }
    });

    MessageChannelRegistry.getInstance().registerSender(source, `send-${suffix}`);

    const { object } = createPatchbayWithNodes(
      `
      [Message]
      ${source} -> obj ${targetA}:0
      ${source} -> obj ${targetB}:0
      `,
      [
        { id: targetA, type: 'object', data: { name: 'js' } },
        { id: targetB, type: 'object', data: { name: 'js' } }
      ]
    );

    expect(object.diagnostics).toEqual([]);

    expect(registeredEdges).toEqual(
      expect.arrayContaining([
        {
          routeId: expect.stringContaining(`message-edge:${source}->obj ${targetA}:0`),
          edge: expect.objectContaining({
            target: targetA,
            targetHandle: 'message-in-0'
          })
        },
        {
          routeId: expect.stringContaining(`message-edge:${source}->obj ${targetB}:0`),
          edge: expect.objectContaining({
            target: targetB,
            targetHandle: 'message-in-0'
          })
        }
      ])
    );
    expect(registeredEdges).toHaveLength(2);

    object.destroy();
    expect(unregisteredEdges).toEqual(registeredEdges.map(({ routeId }) => routeId));

    MessageChannelRegistry.getInstance().broadcast(source, 'after-destroy', `send-${suffix}`);
    expect(endpointMessages).toEqual([]);

    restoreMessageRuntime();
    MessageChannelRegistry.getInstance().unregisterSender(source, `send-${suffix}`);
  });

  it('routes message object endpoints for general MessageContext nodes', () => {
    const suffix = crypto.randomUUID();
    const sliderNodeId = `slider-${suffix}`;
    const peekNodeId = `peek-${suffix}`;
    const received: unknown[] = [];
    const messageSystem = MessageSystem.getInstance();

    messageSystem.updateEdges([]);
    messageSystem.registerNode(peekNodeId).addCallback((message) => {
      received.push(message);
    });

    const { object } = createPatchbayWithNodes(
      `
      [Message]
      obj ${sliderNodeId} -> obj ${peekNodeId}
      `,
      [
        { id: sliderNodeId, type: 'slider', data: {} },
        { id: peekNodeId, type: 'peek', data: {} }
      ]
    );

    messageSystem.sendMessage(sliderNodeId, 0.45);

    expect(object.diagnostics).toEqual([]);
    expect(received).toEqual([0.45]);

    object.destroy();
    messageSystem.unregisterNode(peekNodeId);
  });

  it('registers audio object endpoints as hidden audio edges', () => {
    const suffix = crypto.randomUUID();
    const source = `audio-source-${suffix}`;
    const targetNodeId = `gain-${suffix}`;
    const sourceNodeId = `send-audio-${suffix}`;
    const registry = AudioChannelRegistry.getInstance();
    const registeredEdges: Array<{ routeId: string; edge: unknown }> = [];
    const unregisteredEdges: string[] = [];
    const audioRuntime: PatchbayAudioRuntime = {
      registerEdge(routeId, edge) {
        registeredEdges.push({ routeId, edge });
      },
      unregisterEdge(routeId) {
        unregisteredEdges.push(routeId);
      }
    };
    const restoreAudioRuntime = setPatchbayAudioRuntime(audioRuntime);

    registry.subscribe(source, sourceNodeId, 'send');

    const { object } = createPatchbayWithNodes(
      `
      [Audio]
      ${source} -> obj ${targetNodeId}:1
      `,
      [{ id: targetNodeId, type: 'object', data: { name: 'gain~' } }]
    );

    const audioEdges = registry
      .getVirtualEdges()
      .filter((edge) => edge.id.includes(source) || edge.target === targetNodeId);

    expect(object.diagnostics).toEqual([]);
    expect(audioEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: sourceNodeId,
          target: expect.stringContaining(`:audio-recv:${source}`),
          sourceHandle: 'audio-out',
          targetHandle: 'audio-in'
        })
      ])
    );
    expect(registeredEdges).toEqual([
      {
        routeId: expect.stringContaining(`audio-edge:${source}->obj ${targetNodeId}:1`),
        edge: expect.objectContaining({
          target: targetNodeId,
          targetHandle: 'message-in-1'
        })
      }
    ]);

    object.destroy();
    expect(unregisteredEdges).toEqual(registeredEdges.map(({ routeId }) => routeId));
    restoreAudioRuntime();
    registry.unsubscribe(source, sourceNodeId);
  });

  it('registers audio shorthand expressions as hidden expr nodes between channel endpoints', () => {
    const suffix = crypto.randomUUID();
    const source = `audio-source-${suffix}`;
    const destination = `audio-destination-${suffix}`;
    const sourceNodeId = `send-audio-${suffix}`;
    const destinationNodeId = `recv-audio-${suffix}`;
    const registry = AudioChannelRegistry.getInstance();
    const registeredEdges: Array<{ routeId: string; edge: unknown }> = [];
    const unregisteredVirtualExpressions: string[] = [];
    const registeredVirtualExpressions: Array<{
      routeId: string;
      expression: { nodeId: string; expression: string };
    }> = [];

    const audioRuntime: PatchbayAudioRuntime = {
      registerEdge(routeId, edge) {
        registeredEdges.push({ routeId, edge });
      },
      unregisterEdge() {},
      registerVirtualExpression(routeId, expression) {
        registeredVirtualExpressions.push({ routeId, expression });
      },
      unregisterVirtualExpression(routeId) {
        unregisteredVirtualExpressions.push(routeId);
      }
    };
    const restoreAudioRuntime = setPatchbayAudioRuntime(audioRuntime);

    registry.subscribe(source, sourceNodeId, 'send');
    registry.subscribe(destination, destinationNodeId, 'recv');

    const { object } = createPatchbay(`
      [Audio]
      ${source} * 0.5 -> ${destination}
    `);

    expect(object.diagnostics).toEqual([]);
    expect(registeredVirtualExpressions).toEqual([
      {
        routeId: expect.stringContaining('audio-expr'),
        expression: expect.objectContaining({
          nodeId: expect.stringContaining(':audio-expr:inline:'),
          expression: 's * 0.5'
        })
      }
    ]);
    expect(registeredEdges).toEqual([
      {
        routeId: expect.stringContaining(`${source}->expr~`),
        edge: expect.objectContaining({
          target: registeredVirtualExpressions[0].expression.nodeId,
          sourceHandle: 'audio-out',
          targetHandle: 'audio-in-0'
        })
      },
      {
        routeId: expect.stringContaining(`expr~`),
        edge: expect.objectContaining({
          source: registeredVirtualExpressions[0].expression.nodeId,
          targetHandle: 'audio-in'
        })
      }
    ]);

    object.destroy();
    expect(unregisteredVirtualExpressions).toEqual(
      registeredVirtualExpressions.map(({ routeId }) => routeId)
    );

    restoreAudioRuntime();
    registry.unsubscribe(source, sourceNodeId);
    registry.unsubscribe(destination, destinationNodeId);
  });

  it('registers video object endpoints as hidden video edges', () => {
    const suffix = crypto.randomUUID();
    const source = `video-source-${suffix}`;
    const targetNodeId = `glsl-${suffix}`;
    const sourceNodeId = `send-video-${suffix}`;
    const registry = VideoChannelRegistry.getInstance();
    const registeredRoutes: Array<{ routeId: string; from: string; to: string }> = [];
    const registeredEdges: Array<{ routeId: string; edge: unknown }> = [];

    const restoreVideoRuntime = setPatchbayVideoRuntime({
      registerRoute(routeId, from, to) {
        registeredRoutes.push({ routeId, from, to });
      },
      unregisterRoute() {},
      registerEdge(routeId, edge) {
        registeredEdges.push({ routeId, edge });
      },
      unregisterEdge() {}
    });

    registry.subscribe(source, sourceNodeId, 'send');

    const { object } = createPatchbayWithNodes(
      `
      [Video]
      ${source} -> obj ${targetNodeId}:0
      `,
      [
        {
          id: targetNodeId,
          type: 'glsl',
          data: {
            glUniformDefs: [
              { name: 'mix', type: 'float' },
              { name: 'iChannel0', type: 'sampler2D' }
            ]
          }
        }
      ]
    );

    expect(object.diagnostics).toEqual([]);
    expect(registeredEdges).toEqual([
      {
        routeId: expect.stringContaining(`video-edge:${source}->obj ${targetNodeId}:0`),
        edge: expect.objectContaining({
          target: targetNodeId,
          targetHandle: 'video-in-1-iChannel0-sampler2D'
        })
      }
    ]);
    expect(registeredRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: source
        })
      ])
    );

    object.destroy();
    restoreVideoRuntime();
    registry.unsubscribe(source, sourceNodeId);
  });

  it('does not re-register object routes when only node position changes', () => {
    const suffix = crypto.randomUUID();
    const source = `video-source-${suffix}`;
    const targetNodeId = `glsl-${suffix}`;
    const registry = VideoChannelRegistry.getInstance();
    const registeredEdges: Array<{ routeId: string; edge: unknown }> = [];
    const unregisteredEdges: string[] = [];
    const nodes = [
      {
        id: targetNodeId,
        type: 'glsl',
        position: { x: 0, y: 0 },
        data: {
          glUniformDefs: [{ name: 'iChannel0', type: 'sampler2D' }]
        }
      }
    ];

    const restoreVideoRuntime = setPatchbayVideoRuntime({
      registerRoute() {},
      unregisterRoute() {},
      registerEdge(routeId, edge) {
        registeredEdges.push({ routeId, edge });
      },
      unregisterEdge(routeId) {
        unregisteredEdges.push(routeId);
      }
    });

    registry.subscribe(source, `send-video-${suffix}`, 'send');

    const { object } = createPatchbayWithNodes(
      `
      [Video]
      ${source} -> obj ${targetNodeId}:0
      `,
      nodes
    );

    nodes[0].position = { x: 100, y: 100 };
    object.applyCode();

    expect(registeredEdges).toHaveLength(1);
    expect(unregisteredEdges).toEqual([]);

    object.destroy();
    restoreVideoRuntime();
    registry.unsubscribe(source, `send-video-${suffix}`);
  });
});
