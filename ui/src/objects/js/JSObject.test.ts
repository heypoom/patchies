import { afterEach, describe, expect, it, vi } from 'vitest';

import { MessageContext, MessageSystem } from '$lib/messages';
import { ObjectContext } from '$lib/objects';
import { logger } from '$lib/utils/logger';
import type { GraphChangeCallback } from '$lib/runtime';

import { JSObject } from './JSObject';

describe('JSObject', () => {
  const messageSystem = MessageSystem.getInstance();
  const compilerId = 'js-graph-compiler';
  const targetId = 'js-graph-target';

  afterEach(() => {
    messageSystem.unregisterNode(compilerId);
    messageSystem.unregisterNode(targetId);
    messageSystem.updateEdges([]);

    logger.clearNodeLogs(compilerId);
  });

  it('sends output from a graph callback without mounting its view', async () => {
    let graphCallback: GraphChangeCallback | undefined;
    const compilerMessageContext = new MessageContext(compilerId);
    const targetQueue = messageSystem.registerNode(targetId);
    const received: unknown[] = [];

    targetQueue.addCallback((message) => received.push(message));

    messageSystem.updateEdges([
      {
        id: 'compiler-target',
        source: compilerId,
        sourceHandle: 'message-out',
        target: targetId,
        targetHandle: 'message-in'
      }
    ]);

    const context = new ObjectContext(
      compilerId,
      compilerMessageContext,
      [],
      {
        code: `onGraphChange({ tags: ['shader/foo/*'] }, ({ nodes }) => send(nodes.map(({ id }) => id)))`,
        runOnMount: true
      },
      {
        subscribeGraph: (_query, callback) => {
          graphCallback = callback;
          return () => {};
        }
      }
    );

    const object = new JSObject(compilerId, context);
    await object.create();
    expect(context.getData()).toMatchObject({ isGraphSubscriptionActive: true });

    graphCallback?.({ nodes: [{ id: 'fragment', type: 'js', data: {}, tags: [] }], edges: [] });
    expect(received).toEqual([['fragment']]);

    object.destroy();
    context.destroy();
  });

  it('routes console output to the node virtual console', async () => {
    const messageContext = new MessageContext(compilerId);

    const context = new ObjectContext(compilerId, messageContext, [], {
      code: "console.log('hello from js')",
      runOnMount: true
    });

    const object = new JSObject(compilerId, context);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    await object.create();

    expect(logger.getNodeLogs(compilerId)).toMatchObject([
      {
        level: 'log',
        args: ['hello from js']
      }
    ]);

    consoleLog.mockRestore();
    object.destroy();
    context.destroy();
  });
});
