import { afterEach, describe, expect, it, vi } from 'vitest';

import { MessageContext, MessageSystem } from '$lib/messages';
import { JSRunner } from '$lib/js-runner/JSRunner';
import { ObjectContext } from '$lib/objects/v2/ObjectContext';
import { logger } from '$lib/utils/logger';
import type { GraphChangeCallback } from '$lib/runtime';

import { JSObject } from './JSObject';

const llmMock = vi.hoisted(() => Object.assign(vi.fn(), { turn: vi.fn() }));

vi.mock('$lib/ai/google', () => ({ createLLMFunction: () => llmMock }));

describe('JSObject', () => {
  const messageSystem = MessageSystem.getInstance();
  const compilerId = 'js-graph-compiler';
  const targetId = 'js-graph-target';

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();

    messageSystem.unregisterNode(compilerId);
    messageSystem.unregisterNode(targetId);
    messageSystem.updateEdges([]);

    logger.clearNodeLogs(compilerId);
  });

  it('returns to stopped after a one-shot delay finishes', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout, clearTimeout });

    const messageContext = new MessageContext(compilerId);

    const context = new ObjectContext(compilerId, messageContext, [], {
      code: 'await delay(1000)',
      runOnMount: true
    });

    const object = new JSObject(compilerId, context);
    const executing = object.create();

    await vi.advanceTimersByTimeAsync(0);

    expect(context.getData()).toMatchObject({ isTimerCallbackActive: true });

    await vi.advanceTimersByTimeAsync(1000);
    await executing;

    expect(context.getData()).toMatchObject({ isTimerCallbackActive: false });

    object.destroy();
    context.destroy();
  });

  it.each(['llm', 'llm.turn'])('tracks %s until it settles', async (method) => {
    let finish!: (value: string) => void;

    const response = new Promise<string>((resolve) => {
      finish = resolve;
    });

    const called = new Promise<void>((resolve) => {
      const mock = method === 'llm' ? llmMock : llmMock.turn;

      mock.mockImplementationOnce(() => {
        resolve();

        return response;
      });
    });

    const messageContext = new MessageContext(compilerId);

    const context = new ObjectContext(compilerId, messageContext, [], {
      code: `await ${method}('Hello')`,
      runOnMount: true
    });

    const object = new JSObject(compilerId, context);
    const executing = object.create();

    await called;

    expect(context.getData()).toMatchObject({ isTimerCallbackActive: true });

    finish('Answer');
    await executing;

    expect(context.getData()).toMatchObject({ isTimerCallbackActive: false });

    object.destroy();
    context.destroy();
  });

  it('keeps registered timers active after an LLM call finishes', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    llmMock.mockResolvedValueOnce('Answer');

    const messageContext = new MessageContext(compilerId);

    const context = new ObjectContext(compilerId, messageContext, [], {
      code: "setTimeout(() => {}, 10000); await llm('Hello')",
      runOnMount: true
    });

    const object = new JSObject(compilerId, context);
    await object.create();

    expect(context.getData()).toMatchObject({ isTimerCallbackActive: true });

    object.onMessage({ type: 'stop' });

    expect(context.getData()).toMatchObject({ isTimerCallbackActive: false });

    object.destroy();
    context.destroy();
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

  it('updates the exposed message ports when a rerun changes their counts', async () => {
    const messageContext = new MessageContext(compilerId);

    const executeJavaScript = vi.fn(async (_nodeId, _code, options) => {
      if (executeJavaScript.mock.calls.length === 2) {
        options.setPortCount?.(3, 3);
      }
    });

    vi.spyOn(JSRunner, 'getInstance').mockReturnValue({
      preprocessCode: vi.fn(async (code: string) => code),
      executeJavaScript,
      destroy: vi.fn()
    } as unknown as JSRunner);

    const context = new ObjectContext(compilerId, messageContext, [], {
      code: 'setPortCount(3, 3)',
      runOnMount: true
    });

    const object = new JSObject(compilerId, context);
    await object.create();

    expect(object.getInlets()).toHaveLength(1);
    expect(object.getOutlets()).toHaveLength(1);

    await object.runAsLibraryDependent();

    expect(object.getInlets()).toHaveLength(3);
    expect(object.getOutlets()).toHaveLength(3);

    object.destroy();
    context.destroy();
  });

  it('clears persisted callback indicators without running code after reload', async () => {
    const messageContext = new MessageContext(compilerId);
    const executeJavaScript = vi.fn();

    vi.spyOn(JSRunner, 'getInstance').mockReturnValue({
      executeJavaScript,
      destroy: vi.fn()
    } as unknown as JSRunner);

    const context = new ObjectContext(compilerId, messageContext, [], {
      code: 'recv(() => {})',
      isMessageCallbackActive: true,
      isTimerCallbackActive: true
    });

    const object = new JSObject(compilerId, context);
    await object.create();

    expect(executeJavaScript).not.toHaveBeenCalled();

    expect(context.getData()).toMatchObject({
      isGraphSubscriptionActive: false,
      isMessageCallbackActive: false,
      isTimerCallbackActive: false
    });

    object.destroy();
    context.destroy();
  });

  it('marks clock callbacks as active and clears them on stop', async () => {
    const messageContext = new MessageContext(compilerId);
    const scheduler = JSRunner.getInstance().getLookaheadClockScheduler(compilerId);

    const code = `
      clock.onBeat('*', () => {});
      clock.schedule(60, () => {});
      clock.every('1:0:0', () => {});
      clock.onPlayStateChange(() => {});
    `;

    const context = new ObjectContext(compilerId, messageContext, [], {
      code,
      runOnMount: true
    });

    const object = new JSObject(compilerId, context);
    await object.create();

    expect(context.getData()).toMatchObject({ isTimerCallbackActive: true });
    expect(scheduler.getEventSnapshot()).toHaveLength(3);

    object.onMessage({ type: 'stop' });
    expect(context.getData()).toMatchObject({ isTimerCallbackActive: false });
    expect(scheduler.getEventSnapshot()).toEqual([]);

    object.destroy();
    context.destroy();
  });

  it.each([
    ['settings', 'settings'],
    ['code', 'code'],
    ['run', 'run']
  ])('sets the primary button to %s without mounting its view', async (requested, expected) => {
    const messageContext = new MessageContext(compilerId);

    const context = new ObjectContext(compilerId, messageContext, [], {
      code: `setPrimaryButton('${requested}')`,
      runOnMount: true,
      primaryButton: requested === 'settings' ? 'code' : 'settings'
    });

    const object = new JSObject(compilerId, context);
    await object.create();

    expect(context.getData()).toMatchObject({ primaryButton: expected });
    expect(logger.getNodeLogs(compilerId)).toEqual([]);

    object.destroy();
    context.destroy();
  });
});
