import { afterEach, describe, expect, it, vi } from 'vitest';

import { MessageContext, MessageSystem } from '$lib/messages';
import { JSRunner } from '$lib/js-runner/JSRunner';
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

  it('routes execution errors to the node virtual console', async () => {
    const messageContext = new MessageContext(compilerId);

    const context = new ObjectContext(compilerId, messageContext, [], {
      code: "throw new Error('broken js')",
      runOnMount: true
    });

    const object = new JSObject(compilerId, context);
    await object.create();

    expect(logger.getNodeLogs(compilerId)).toMatchObject([
      {
        level: 'error',
        args: ['broken js']
      }
    ]);

    object.destroy();
    context.destroy();
  });

  it('routes graph callback errors to the node virtual console', async () => {
    let graphCallback: GraphChangeCallback | undefined;
    const messageContext = new MessageContext(compilerId);

    const context = new ObjectContext(
      compilerId,
      messageContext,
      [],
      {
        code: `onGraphChange({ tags: ['shader/foo/*'] }, () => { throw new Error('broken graph callback') })`,
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

    expect(() => graphCallback?.({ nodes: [], edges: [] })).not.toThrow();

    expect(logger.getNodeLogs(compilerId)).toMatchObject([
      {
        level: 'error',
        args: ['broken graph callback']
      }
    ]);

    object.destroy();
    context.destroy();
  });

  it('routes rejected graph callbacks to the node virtual console', async () => {
    let graphCallback: GraphChangeCallback | undefined;
    const messageContext = new MessageContext(compilerId);
    const context = new ObjectContext(
      compilerId,
      messageContext,
      [],
      {
        code: `onGraphChange({ tags: ['shader/foo/*'] }, async () => { throw new Error('rejected graph callback') })`,
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

    expect(() => graphCallback?.({ nodes: [], edges: [] })).not.toThrow();
    await Promise.resolve();

    expect(logger.getNodeLogs(compilerId)).toMatchObject([
      {
        level: 'error',
        args: ['rejected graph callback']
      }
    ]);

    object.destroy();
    context.destroy();
  });

  it('clears the graph subscription indicator after the final unsubscribe', async () => {
    const unsubscribe = vi.fn();

    const messageContext = new MessageContext(compilerId);

    const context = new ObjectContext(
      compilerId,
      messageContext,
      [],
      {
        code: `const unsubscribe = onGraphChange({ tags: ['shader/foo/*'] }, () => {}); unsubscribe()`,
        runOnMount: true
      },
      { subscribeGraph: () => unsubscribe }
    );

    const object = new JSObject(compilerId, context);
    await object.create();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(context.getData()).toMatchObject({ isGraphSubscriptionActive: false });

    object.destroy();
    context.destroy();
  });

  it('applies UI setting changes through the runtime settings manager', async () => {
    const messageContext = new MessageContext(compilerId);

    const context = new ObjectContext(compilerId, messageContext, [], {
      code: `await settings.define([{ key: 'gain', label: 'Gain', type: 'number' }])`,
      runOnMount: true
    });

    const object = new JSObject(compilerId, context);
    await object.create();

    object.onMessage({ type: 'setSetting', key: 'gain', value: 0.75 });

    expect(context.getData()).toMatchObject({ settings: { gain: 0.75 } });

    object.destroy();
    context.destroy();
  });

  it('replaces settings callbacks when code reruns', async () => {
    const messageContext = new MessageContext(compilerId);
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

    const context = new ObjectContext(compilerId, messageContext, [], {
      code: `
        await settings.define([{ key: 'gain', label: 'Gain', type: 'number' }]);
        settings.onChange((_, value) => send(value));
      `,
      runOnMount: true
    });

    const object = new JSObject(compilerId, context);
    await object.create();
    await object.runAsLibraryDependent();
    object.onMessage({ type: 'setSetting', key: 'gain', value: 0.75 });

    expect(received).toEqual([0.75]);
    expect(context.getData()).toMatchObject({ isTimerCallbackActive: true });

    object.onMessage({ type: 'stop' });
    object.onMessage({ type: 'setSetting', key: 'gain', value: 1 });

    expect(received).toEqual([0.75]);

    object.destroy();
    context.destroy();
  });

  it('registers libraries and asks the runtime to re-run their dependents', async () => {
    const rerunLibraryDependents = vi.fn();

    const messageContext = new MessageContext(compilerId);

    const context = new ObjectContext(
      compilerId,
      messageContext,
      [],
      {
        code: '// @lib shader-utils\nexport const value = 1;',
        libraryName: 'shader-utils'
      },
      { rerunLibraryDependents }
    );

    const object = new JSObject(compilerId, context);
    await object.create();

    expect(context.getData()).toMatchObject({
      libraryName: 'shader-utils',
      inletCount: 0,
      outletCount: 0
    });

    expect(rerunLibraryDependents).toHaveBeenCalledWith(compilerId, 'shader-utils');

    await object.runAsLibraryDependent();
    expect(rerunLibraryDependents).toHaveBeenCalledTimes(1);

    object.destroy();
    context.destroy();
  });

  it('runs JS library dependents through PatchRuntime', async () => {
    const { createTestPatchRuntime } = await import('$lib/runtime/utils/runtime-test-utils');
    const libraryId = 'shared-utils';
    const dependentId = 'library-importer';

    const runtime = createTestPatchRuntime();
    const received: unknown[] = [];
    const compile = vi.spyOn(JSRunner.getInstance(), 'gen').mockResolvedValue('send(1)');

    messageSystem.registerNode(targetId).addCallback((message) => received.push(message));

    try {
      await runtime.setGraph({
        objects: [
          {
            id: libraryId,
            type: 'js',
            data: {
              code: '// @lib shared-utils\nexport const value = 1;',
              runOnMount: true
            }
          },
          {
            id: dependentId,
            type: 'js',
            data: { code: "import { value } from 'shared-utils'; send(value)" }
          }
        ],
        connections: [
          {
            id: 'library-importer-target',
            source: dependentId,
            outlet: 'message-out',
            target: targetId,
            inlet: 'message-in'
          }
        ]
      });

      await vi.waitFor(() => expect(received).toEqual([1]));
    } finally {
      runtime.destroy();
      compile.mockRestore();
    }
  });
});
