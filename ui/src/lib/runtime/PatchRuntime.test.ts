import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RuntimeAudioObjectAdapter } from './RuntimeAudioObjectAdapter';
import { PatchMessageRuntime } from './PatchMessageRuntime';
import { PatchRuntime } from './PatchRuntime';
import { EditorRuntimeReconciler } from './EditorRuntimeReconciler';
import { logger } from '$lib/utils/logger';
import { MessageSystem } from '$lib/messages/MessageSystem';
import { MessageContext } from '$lib/messages/MessageContext';
import { AudioRegistry } from '$lib/registry/AudioRegistry';
import { TapNode } from '$objects/tap~/native-dsp/nodes/tap.node';
import { ScopeAudioNode } from '$objects/scope~/ScopeAudioNode';
import {
  buttonNode,
  createFakeEditorRuntime,
  FakeAudioService,
  FakeEventBus,
  FakeObjectService,
  knobNode,
  objectNode,
  PatchRuntimeTestObject,
  resetPatchRuntimeTestObject,
  sliderNode,
  switchNode,
  tapTildeNode,
  TEST_OBJECT_TYPE,
  textboxNode,
  toggleNode
} from './PatchRuntime.test-helpers';

beforeEach(() => {
  resetPatchRuntimeTestObject();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const isScope = (objectType: string) => objectType === 'scope~';
const isOsc = (objectType: string) => objectType === 'osc~';
const isTap = (objectType: string) => objectType === 'tap~';

describe('PatchMessageRuntime', () => {
  it('owns V2 text object lifecycle independent of editor graph reconciliation', async () => {
    const objectService = new FakeObjectService();
    const runtime = new PatchMessageRuntime({ objectService });
    const nodeId = 'object-patch-runtime-test';

    await runtime.createObject({
      id: nodeId,
      objectType: TEST_OBJECT_TYPE,
      data: { params: ['initial'] },
      rawParams: ['initial']
    });

    const createdObject = objectService.getObjectById(nodeId);
    expect(createdObject).toBeInstanceOf(PatchRuntimeTestObject);
    expect(createdObject?.context.getParams()).toEqual(['initial']);
    expect(PatchRuntimeTestObject.createdRawParams).toEqual([['initial']]);

    await runtime.updateObject(nodeId, {
      id: nodeId,
      objectType: TEST_OBJECT_TYPE,
      data: { params: ['display-only update'] },
      rawParams: ['initial']
    });

    expect(objectService.getObjectById(nodeId)).toBe(createdObject);
    expect(PatchRuntimeTestObject.destroyedNodeIds).toEqual([]);

    runtime.destroyObject(nodeId);

    expect(objectService.getObjectById(nodeId)).toBeNull();
    expect(runtime.getObjectMessageContext(nodeId)).toBeNull();
    expect(PatchRuntimeTestObject.destroyedNodeIds).toEqual([nodeId]);
  });

  it('keeps message edges routable after replacing an object with the same node id', async () => {
    const objectService = new FakeObjectService();
    const runtime = new PatchMessageRuntime({ objectService });
    const messageSystem = MessageSystem.getInstance();
    const sourceNodeId = 'object-message-replace-source';
    const targetNodeId = 'object-message-replace-target';
    const onMessage = vi.fn();

    const targetQueue = messageSystem.registerNode(targetNodeId);
    targetQueue.addCallback(onMessage);

    await runtime.createObject({
      id: sourceNodeId,
      objectType: TEST_OBJECT_TYPE,
      data: { params: ['initial'] },
      rawParams: ['initial']
    });

    messageSystem.updateEdges([
      {
        id: 'replace-source-to-target',
        source: sourceNodeId,
        target: targetNodeId,
        sourceHandle: 'message-out',
        targetHandle: 'message-in-0'
      }
    ]);

    runtime.getObjectMessageContext(sourceNodeId)?.send('before replace');
    expect(onMessage).toHaveBeenCalledWith(
      'before replace',
      expect.objectContaining({ source: sourceNodeId })
    );

    await runtime.updateObject(sourceNodeId, {
      id: sourceNodeId,
      objectType: TEST_OBJECT_TYPE,
      data: { params: ['next'] },
      rawParams: ['next']
    });

    runtime.getObjectMessageContext(sourceNodeId)?.send('after replace');
    expect(onMessage).toHaveBeenCalledWith(
      'after replace',
      expect.objectContaining({ source: sourceNodeId })
    );

    runtime.destroy();
    messageSystem.unregisterNode(targetNodeId);
    messageSystem.updateEdges([]);
  });

  it('ignores async create results after the object is destroyed', async () => {
    let releaseCreate!: () => void;

    PatchRuntimeTestObject.createGate = new Promise((resolve) => {
      releaseCreate = resolve;
    });

    PatchRuntimeTestObject.normalizeParamOnCreate = true;

    const objectService = new FakeObjectService();
    const paramUpdates: Array<{ nodeId: string; params: unknown[] }> = [];

    const runtime = new PatchMessageRuntime({
      objectService,
      onObjectParamsChange: (nodeId, params) => paramUpdates.push({ nodeId, params })
    });

    const nodeId = 'object-patch-runtime-async-test';

    const createPromise = runtime.createObject({
      id: nodeId,
      objectType: TEST_OBJECT_TYPE,
      data: { params: ['initial'] },
      rawParams: ['initial']
    });

    runtime.destroyObject(nodeId);
    releaseCreate();
    await createPromise;

    expect(objectService.getObjectById(nodeId)).toBeNull();
    expect(runtime.getObjectMessageContext(nodeId)).toBeNull();
    expect(paramUpdates).toEqual([]);
  });

  it('forwards object param events through the runtime callback', () => {
    const objectService = new FakeObjectService();
    const eventBus = new FakeEventBus();
    const paramUpdates: Array<{ nodeId: string; params: unknown[] }> = [];

    const runtime = new PatchMessageRuntime({
      objectService,
      eventBus,
      onObjectParamsChange: (nodeId, params) => paramUpdates.push({ nodeId, params })
    });

    eventBus.dispatch({
      type: 'objectParamsChanged',
      nodeId: 'object-param-event-test',
      params: ['updated'],
      index: 0,
      value: 'updated'
    });

    expect(paramUpdates).toEqual([{ nodeId: 'object-param-event-test', params: ['updated'] }]);

    runtime.destroy();

    expect(eventBus.removeEventListener).toHaveBeenCalledWith(
      'objectParamsChanged',
      expect.any(Function)
    );
  });

  it('resolves runtime object ports without exposing ObjectService to the view', async () => {
    const objectService = new FakeObjectService();
    const runtime = new PatchMessageRuntime({ objectService });
    const nodeId = 'object-port-runtime-test';

    PatchRuntimeTestObject.dynamicInlets = [{ name: 'dynamic-in', type: 'float' }];
    PatchRuntimeTestObject.dynamicOutlets = [{ name: 'dynamic-out', type: 'string' }];

    await runtime.createObject({
      id: nodeId,
      objectType: TEST_OBJECT_TYPE,
      data: { params: ['initial'] },
      rawParams: ['initial']
    });

    expect(
      runtime.getObjectPorts(nodeId, {
        inlets: [{ name: 'fallback-in', type: 'any' }],
        outlets: [{ name: 'fallback-out', type: 'any' }]
      })
    ).toEqual({
      inlets: [{ name: 'dynamic-in', type: 'float' }],
      outlets: [{ name: 'dynamic-out', type: 'string' }],
      hasDynamicOutlets: true
    });
  });

  it('subscribes view callbacks to runtime object messages', async () => {
    const objectService = new FakeObjectService();
    const runtime = new PatchMessageRuntime({ objectService });
    const nodeId = 'object-message-subscription-test';
    const onMessage = vi.fn();

    await runtime.createObject({
      id: nodeId,
      objectType: TEST_OBJECT_TYPE,
      data: { params: ['initial'] },
      rawParams: ['initial']
    });

    const unsubscribe = runtime.subscribeObjectMessages(nodeId, onMessage);
    expect(unsubscribe).toEqual(expect.any(Function));

    runtime
      .getObjectMessageContext(nodeId)
      ?.queue.sendMessage({ source: 'source-node', data: 'payload' });

    expect(onMessage).toHaveBeenCalledWith('payload', {
      source: 'source-node',
      data: 'payload'
    });

    unsubscribe?.();
    runtime
      .getObjectMessageContext(nodeId)
      ?.queue.sendMessage({ source: 'source-node', data: 'after-unsubscribe' });

    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it('bumps object revision once when replacing an existing object', async () => {
    const objectService = new FakeObjectService();
    const runtime = new PatchMessageRuntime({ objectService });
    const nodeId = 'object-revision-replace-test';

    await runtime.createObject({
      id: nodeId,
      objectType: TEST_OBJECT_TYPE,
      data: { params: ['initial'] },
      rawParams: ['initial']
    });

    const revisionAfterCreate = runtime.trackObjectViewRevision(nodeId);

    await runtime.updateObject(nodeId, {
      id: nodeId,
      objectType: TEST_OBJECT_TYPE,
      data: { params: ['next'] },
      rawParams: ['next']
    });

    expect(runtime.trackObjectViewRevision(nodeId)).toBe(revisionAfterCreate + 1);
  });

  it('notifies view revision subscribers without Svelte reactivity', async () => {
    const objectService = new FakeObjectService();
    const runtime = new PatchMessageRuntime({ objectService });
    const nodeId = 'object-revision-subscription-test';
    const revisionUpdates: string[] = [];

    await runtime.createObject({
      id: nodeId,
      objectType: TEST_OBJECT_TYPE,
      data: { params: ['initial'] },
      rawParams: ['initial']
    });

    const unsubscribe = runtime.subscribeObjectViewRevisions((changedNodeId) => {
      revisionUpdates.push(changedNodeId);
    });

    await runtime.updateObject(nodeId, {
      id: nodeId,
      objectType: TEST_OBJECT_TYPE,
      data: { params: ['next'] },
      rawParams: ['next']
    });

    unsubscribe();

    await runtime.updateObject(nodeId, {
      id: nodeId,
      objectType: TEST_OBJECT_TYPE,
      data: { params: ['final'] },
      rawParams: ['final']
    });

    expect(revisionUpdates).toEqual([nodeId]);
  });
});

describe('RuntimeAudioObjectAdapter', () => {
  it('owns audio object service interactions', () => {
    const audioService = new FakeAudioService();
    const runtime = new RuntimeAudioObjectAdapter({ audioService });
    const nodeId = 'object-audio-runtime-test';

    runtime.upsertAudioObject({
      id: nodeId,
      objectType: 'osc~',
      params: [440]
    });

    expect(audioService.removeNodeById).toHaveBeenCalledWith(nodeId);
    expect(audioService.createNode).toHaveBeenCalledWith(nodeId, 'osc~', [440]);

    runtime.sendAudioObjectMessage(nodeId, 'frequency', 220);
    expect(audioService.send).toHaveBeenCalledWith(nodeId, 'frequency', 220);

    expect(runtime.getAudioObject(nodeId)).toBe(audioService.audioNode);

    runtime.destroyAudioObject(nodeId);
    expect(audioService.removeNodeById).toHaveBeenLastCalledWith(nodeId);
  });

  it('consumes suppressed audio sync markers once', () => {
    const audioService = new FakeAudioService();
    const runtime = new RuntimeAudioObjectAdapter({ audioService });
    const nodeId = 'object-audio-sync-test';

    runtime.suppressNextAudioObjectSync(nodeId);

    expect(runtime.consumeSuppressedAudioObjectSync(nodeId)).toBe(true);
    expect(runtime.consumeSuppressedAudioObjectSync(nodeId)).toBe(false);
  });

  it('handles async audio node creation failures as fire-and-forget work', () => {
    const audioService = new FakeAudioService();
    const runtime = new RuntimeAudioObjectAdapter({ audioService });
    const nodeId = 'object-audio-create-rejection-test';
    const catchHandlers: Array<(error: unknown) => unknown> = [];

    const createPromise = {
      catch: vi.fn((handler: (error: unknown) => unknown) => {
        catchHandlers.push(handler);

        return Promise.resolve(null);
      })
    } as unknown as ReturnType<typeof audioService.createNode>;

    audioService.createNode.mockReturnValueOnce(createPromise);

    runtime.upsertAudioObject({
      id: nodeId,
      objectType: 'osc~',
      params: [440]
    });

    expect(createPromise.catch).toHaveBeenCalledWith(expect.any(Function));
    expect(catchHandlers).toHaveLength(1);
    expect(() => catchHandlers[0](new Error('create failed'))).not.toThrow();
  });

  it('routes audio object command messages through runtime-owned message contexts', () => {
    const audioService = new FakeAudioService();
    const onAudioObjectDataChange = vi.fn();

    const runtime = new RuntimeAudioObjectAdapter({
      audioService,
      isAudioObject: isTap,
      onAudioObjectDataChange
    });

    const messageSystem = MessageSystem.getInstance();
    const sourceNodeId = 'tap-command-source';
    const tapNodeId = 'tap-command-target';

    AudioRegistry.getInstance().register(TapNode);
    messageSystem.registerNode(sourceNodeId);
    messageSystem.updateEdges([
      {
        id: 'source-to-tap-command',
        source: sourceNodeId,
        target: tapNodeId,
        sourceHandle: 'message-out',
        targetHandle: 'message-in-0'
      }
    ]);

    runtime.upsertAudioObject({
      id: tapNodeId,
      objectType: 'tap~',
      params: [null, null, 512, 'wave', 0, true]
    });
    messageSystem.sendMessage(sourceNodeId, { type: 'setSamples', value: 1024 });

    expect(audioService.send).toHaveBeenCalledWith(tapNodeId, 'bufferSize', 1024);
    expect(onAudioObjectDataChange).toHaveBeenCalledWith(tapNodeId, { bufferSize: 1024 });

    runtime.destroy();
    messageSystem.unregisterNode(sourceNodeId);
    messageSystem.updateEdges([]);
  });
});

describe('PatchRuntime', () => {
  it('owns button message routing outside the Svelte view lifecycle', async () => {
    const runtime = new PatchRuntime({
      objectService: new FakeObjectService(),
      audioService: new FakeAudioService()
    });

    const inputNodeId = 'button-runtime-input';
    const buttonNodeId = 'button-runtime-test';
    const targetNodeId = 'button-runtime-target';
    const messageSystem = MessageSystem.getInstance();
    const onMessage = vi.fn();
    const onViewMessage = vi.fn();

    const targetQueue = messageSystem.registerNode(targetNodeId);
    targetQueue.addCallback(onMessage);
    messageSystem.registerNode(inputNodeId);

    messageSystem.updateEdges([
      {
        id: 'input-to-button',
        source: inputNodeId,
        target: buttonNodeId,
        sourceHandle: 'message-out',
        targetHandle: 'message-in-0'
      },
      {
        id: 'button-to-target',
        source: buttonNodeId,
        target: targetNodeId,
        sourceHandle: 'message-out',
        targetHandle: 'message-in-0'
      }
    ]);

    await runtime.createObject({
      id: buttonNodeId,
      objectType: 'button',
      data: {},
      rawParams: []
    });

    const viewMessageContext = new MessageContext(buttonNodeId);
    viewMessageContext.messageCallbacks = [onViewMessage];

    viewMessageContext.queue.sendMessage({ data: { type: 'bang' }, source: buttonNodeId });

    expect(onMessage).toHaveBeenCalledWith(
      { type: 'bang' },
      expect.objectContaining({ source: buttonNodeId })
    );
    expect(onViewMessage).toHaveBeenCalledWith(
      { type: 'bang' },
      expect.objectContaining({ source: buttonNodeId })
    );

    messageSystem.sendMessage(inputNodeId, 'inbound button message');

    expect(onMessage).toHaveBeenCalledTimes(2);
    expect(onViewMessage).toHaveBeenCalledWith(
      'inbound button message',
      expect.objectContaining({
        source: inputNodeId,
        inlet: 0,
        inletKey: 'message-in-0'
      })
    );

    viewMessageContext.destroy({ unregisterNode: false });
    runtime.destroy();
    messageSystem.unregisterNode(inputNodeId);
    messageSystem.unregisterNode(targetNodeId);
    messageSystem.updateEdges([]);
  });

  it('creates a message endpoint for audio objects', async () => {
    const objectService = new FakeObjectService();
    const audioService = new FakeAudioService();

    const runtime = new PatchRuntime({
      objectService,
      audioService,
      isAudioObject: isOsc
    });

    const sourceNodeId = 'slider-source';
    const audioNodeId = 'osc-target';
    const callback = vi.fn();
    const messageSystem = MessageSystem.getInstance();

    expect(runtime.isObjectInRegistry('osc~')).toBe(true);

    runtime.upsertAudioObject({
      id: audioNodeId,
      objectType: 'osc~',
      params: [440]
    });

    const unsubscribe = runtime.subscribeObjectMessages(audioNodeId, callback);
    expect(unsubscribe).toEqual(expect.any(Function));

    messageSystem.registerNode(sourceNodeId);

    messageSystem.updateEdges([
      {
        id: 'slider-to-osc-frequency',
        source: sourceNodeId,
        target: audioNodeId,
        sourceHandle: 'message-out',
        targetHandle: 'message-in-0'
      }
    ]);

    messageSystem.sendMessage(sourceNodeId, 220);

    expect(callback).toHaveBeenCalledWith(
      220,
      expect.objectContaining({
        source: sourceNodeId,
        inlet: 0,
        inletKey: 'message-in-0'
      })
    );

    unsubscribe?.();
    runtime.destroy();

    messageSystem.unregisterNode(sourceNodeId);
    messageSystem.updateEdges([]);
  });

  it('keeps a facade over message and audio runtime helpers', async () => {
    const objectService = new FakeObjectService();
    const audioService = new FakeAudioService();

    const runtime = new PatchRuntime({
      objectService,
      audioService,
      isAudioObject: (objectType) => objectType === 'osc~'
    });

    const nodeId = 'object-patch-runtime-facade-test';

    await runtime.createObject({
      id: nodeId,
      objectType: TEST_OBJECT_TYPE,
      data: { params: ['initial'] },
      rawParams: ['initial']
    });
    runtime.upsertAudioObject({
      id: nodeId,
      objectType: 'osc~',
      params: [440]
    });

    expect(objectService.getObjectById(nodeId)).toBeInstanceOf(PatchRuntimeTestObject);
    expect(audioService.createNode).toHaveBeenCalledWith(nodeId, 'osc~', [440]);

    runtime.destroy();

    expect(objectService.getObjectById(nodeId)).toBeNull();
    expect(audioService.removeNodeById).toHaveBeenLastCalledWith(nodeId);
  });
});

describe('EditorRuntimeReconciler', () => {
  it('syncs dedicated audio UI nodes through the audio runtime lifecycle', async () => {
    const audioService = new FakeAudioService();

    const runtime = new PatchRuntime({
      objectService: new FakeObjectService(),
      audioService,
      isAudioObject: isTap
    });

    const reconciler = new EditorRuntimeReconciler(runtime);
    const nodeId = 'tap-tilde-editor-runtime-test';

    AudioRegistry.getInstance().register(TapNode);

    await reconciler.reconcile([
      tapTildeNode(nodeId, {
        bufferSize: 1024,
        mode: 'xy',
        fps: 30,
        zeroCrossing: false
      })
    ]);

    expect(audioService.createNode).toHaveBeenCalledWith(nodeId, 'tap~', [
      null,
      null,
      1024,
      'xy',
      30,
      false
    ]);

    await reconciler.reconcile([]);

    expect(audioService.removeNodeById).toHaveBeenLastCalledWith(nodeId);

    runtime.destroy();
  });

  it('diffs runtime-managed audio nodes before calling the audio runtime', async () => {
    const runtime = createFakeEditorRuntime({
      isAudioObjectInRegistry: vi.fn(isTap),
      getAudioObject: vi.fn(() => ({ nodeId: 'tap-tilde-runtime-noop-test', audioNode: null }))
    });

    const reconciler = new EditorRuntimeReconciler(runtime);
    const nodeId = 'tap-tilde-runtime-noop-test';

    const node = tapTildeNode(nodeId, {
      bufferSize: 1024,
      mode: 'xy',
      fps: 30,
      zeroCrossing: false
    });

    AudioRegistry.getInstance().register(TapNode);

    await reconciler.reconcile([node]);
    await reconciler.reconcile([node]);

    expect(runtime.upsertAudioObject).toHaveBeenCalledTimes(1);
    expect(runtime.upsertAudioObject).toHaveBeenCalledWith({
      id: nodeId,
      objectType: 'tap~',
      params: [null, null, 1024, 'xy', 30, false]
    });

    await reconciler.reconcile([]);

    expect(runtime.destroyAudioObject).toHaveBeenCalledWith(nodeId);
  });

  it('does not sync dedicated audio UI nodes that still own their view runtime', async () => {
    const audioService = new FakeAudioService();

    const runtime = new PatchRuntime({
      objectService: new FakeObjectService(),
      audioService,
      isAudioObject: isScope
    });

    const reconciler = new EditorRuntimeReconciler(runtime);
    const nodeId = 'scope-editor-runtime-test';

    AudioRegistry.getInstance().register(ScopeAudioNode);

    await reconciler.reconcile([
      {
        id: nodeId,
        type: 'scope~',
        position: { x: 0, y: 0 },
        data: {}
      }
    ]);

    expect(audioService.createNode).not.toHaveBeenCalled();

    runtime.destroy();
  });

  it('syncs object-box audio nodes through the audio runtime lifecycle', async () => {
    const objectService = new FakeObjectService();
    const audioService = new FakeAudioService();
    const createObject = vi.spyOn(objectService, 'createObject');

    const runtime = new PatchRuntime({
      objectService,
      audioService,
      isAudioObject: isOsc
    });

    const reconciler = new EditorRuntimeReconciler(runtime);
    const nodeId = 'object-box-audio-reconciler-test';

    await reconciler.reconcile([
      objectNode(nodeId, {
        expr: 'osc~ 440',
        name: 'osc~',
        params: [440]
      })
    ]);

    expect(audioService.createNode).toHaveBeenCalledWith(nodeId, 'osc~', [440]);
    expect(createObject).not.toHaveBeenCalled();

    await reconciler.reconcile([]);

    expect(audioService.removeNodeById).toHaveBeenLastCalledWith(nodeId);

    runtime.destroy();
  });

  it('replaces object-box audio nodes with message objects when the object type changes', async () => {
    const objectService = new FakeObjectService();
    const audioService = new FakeAudioService();

    const runtime = new PatchRuntime({
      objectService,
      audioService,
      isAudioObject: isOsc
    });

    const reconciler = new EditorRuntimeReconciler(runtime);
    const nodeId = 'object-box-audio-to-message-test';

    await reconciler.reconcile([
      objectNode(nodeId, {
        expr: 'osc~ 440',
        name: 'osc~',
        params: [440]
      })
    ]);

    await reconciler.reconcile([
      objectNode(nodeId, {
        expr: `${TEST_OBJECT_TYPE} next`,
        name: TEST_OBJECT_TYPE,
        params: ['next']
      })
    ]);

    expect(audioService.removeNodeById).toHaveBeenLastCalledWith(nodeId);
    expect(objectService.getObjectById(nodeId)).toBeInstanceOf(PatchRuntimeTestObject);

    runtime.destroy();
  });

  it('consumes suppressed object-box audio updates without recreating the audio node', async () => {
    const audioService = new FakeAudioService();

    const runtime = new PatchRuntime({
      objectService: new FakeObjectService(),
      audioService,
      isAudioObject: isOsc
    });

    const reconciler = new EditorRuntimeReconciler(runtime);
    const nodeId = 'object-box-audio-suppressed-reconcile-test';

    await reconciler.reconcile([
      objectNode(nodeId, {
        expr: 'osc~ 440',
        name: 'osc~',
        params: [440]
      })
    ]);

    runtime.suppressNextAudioObjectSync(nodeId);

    await reconciler.reconcile([
      objectNode(nodeId, {
        expr: 'osc~ 220',
        name: 'osc~',
        params: [220]
      })
    ]);

    await reconciler.reconcile([
      objectNode(nodeId, {
        expr: 'osc~ 220',
        name: 'osc~',
        params: [220]
      })
    ]);

    expect(audioService.createNode).toHaveBeenCalledTimes(1);

    await reconciler.reconcile([
      objectNode(nodeId, {
        expr: 'osc~ 330',
        name: 'osc~',
        params: [330]
      })
    ]);

    expect(audioService.createNode).toHaveBeenCalledTimes(2);

    runtime.destroy();
  });

  it('recreates an audio object when reconciler state outlives the service node', async () => {
    const audioService = new FakeAudioService();

    const runtime = new PatchRuntime({
      objectService: new FakeObjectService(),
      audioService,
      isAudioObject: isOsc
    });

    const reconciler = new EditorRuntimeReconciler(runtime);
    const node = objectNode('object-box-audio-undo-test', {
      expr: 'osc~ 440',
      name: 'osc~',
      params: [440]
    });

    await reconciler.reconcile([node]);

    audioService.getNodeById.mockReturnValueOnce(null);
    await reconciler.reconcile([node]);

    expect(audioService.createNode).toHaveBeenCalledTimes(2);

    runtime.destroy();
  });

  it('translates XYFlow button nodes into runtime object lifecycle calls', async () => {
    const runtime = createFakeEditorRuntime();
    const reconciler = new EditorRuntimeReconciler(runtime);
    const nodeId = 'button-editor-runtime-test';

    await reconciler.reconcile([buttonNode(nodeId)]);
    await reconciler.reconcile([buttonNode(nodeId)]);

    expect(runtime.createObject).toHaveBeenCalledWith({
      id: nodeId,
      objectType: 'button',
      data: {},
      rawParams: []
    });

    expect(runtime.createObject).toHaveBeenCalledTimes(1);
    expect(runtime.destroyObject).not.toHaveBeenCalled();

    await reconciler.reconcile([]);

    expect(runtime.destroyObject).toHaveBeenCalledWith(nodeId);
  });

  it('translates XYFlow toggle value into runtime data', async () => {
    const runtime = createFakeEditorRuntime();
    const reconciler = new EditorRuntimeReconciler(runtime);
    const nodeId = 'toggle-editor-runtime-test';

    await reconciler.reconcile([toggleNode(nodeId, { value: true })]);

    expect(runtime.createObject).toHaveBeenCalledWith({
      id: nodeId,
      objectType: 'toggle',
      data: { value: true },
      rawParams: []
    });
  });

  it('translates XYFlow switch value into runtime data', async () => {
    const runtime = createFakeEditorRuntime();
    const reconciler = new EditorRuntimeReconciler(runtime);
    const nodeId = 'switch-editor-runtime-test';

    await reconciler.reconcile([switchNode(nodeId, { value: true })]);

    expect(runtime.createObject).toHaveBeenCalledWith({
      id: nodeId,
      objectType: 'switch',
      data: { value: true },
      rawParams: []
    });
  });

  it('translates XYFlow textbox text into runtime data', async () => {
    const runtime = createFakeEditorRuntime();
    const reconciler = new EditorRuntimeReconciler(runtime);
    const nodeId = 'textbox-editor-runtime-test';

    await reconciler.reconcile([textboxNode(nodeId, { text: 'saved text' })]);

    expect(runtime.createObject).toHaveBeenCalledWith({
      id: nodeId,
      objectType: 'textbox',
      data: { text: 'saved text' },
      rawParams: []
    });
  });

  it('translates XYFlow slider data into runtime data', async () => {
    const runtime = createFakeEditorRuntime();
    const reconciler = new EditorRuntimeReconciler(runtime);
    const nodeId = 'slider-editor-runtime-test';

    await reconciler.reconcile([
      sliderNode(nodeId, {
        value: 7,
        min: -10,
        max: 10,
        defaultValue: 2,
        isFloat: true,
        step: 0.5
      })
    ]);

    expect(runtime.createObject).toHaveBeenCalledWith({
      id: nodeId,
      objectType: 'slider',
      data: {
        value: 7,
        min: -10,
        max: 10,
        defaultValue: 2,
        isFloat: true,
        step: 0.5
      },
      rawParams: []
    });
  });

  it('translates XYFlow knob data into runtime data', async () => {
    const runtime = createFakeEditorRuntime();
    const reconciler = new EditorRuntimeReconciler(runtime);
    const nodeId = 'knob-editor-runtime-test';

    await reconciler.reconcile([
      knobNode(nodeId, {
        value: 7,
        min: -10,
        max: 10,
        defaultValue: 2,
        isFloat: true,
        step: 0.5
      })
    ]);

    expect(runtime.createObject).toHaveBeenCalledWith({
      id: nodeId,
      objectType: 'knob',
      data: {
        value: 7,
        min: -10,
        max: 10,
        defaultValue: 2,
        isFloat: true,
        step: 0.5
      },
      rawParams: []
    });
  });

  it('translates XYFlow object nodes into PatchRuntime object calls', async () => {
    const runtime = createFakeEditorRuntime();
    const reconciler = new EditorRuntimeReconciler(runtime);

    const nodeId = 'object-editor-runtime-test';

    await reconciler.reconcile([
      objectNode(nodeId, {
        expr: `${TEST_OBJECT_TYPE} initial`,
        name: TEST_OBJECT_TYPE,
        params: ['initial']
      })
    ]);

    expect(runtime.createObject).toHaveBeenCalledWith({
      id: nodeId,
      objectType: TEST_OBJECT_TYPE,
      data: {
        expr: `${TEST_OBJECT_TYPE} initial`,
        name: TEST_OBJECT_TYPE,
        params: ['initial']
      },
      rawParams: ['initial']
    });

    await reconciler.reconcile([
      objectNode(nodeId, {
        expr: `${TEST_OBJECT_TYPE} initial`,
        name: TEST_OBJECT_TYPE,
        params: ['display-only update']
      })
    ]);

    expect(runtime.updateObject).toHaveBeenCalledWith(nodeId, {
      id: nodeId,
      objectType: TEST_OBJECT_TYPE,
      data: {
        expr: `${TEST_OBJECT_TYPE} initial`,
        name: TEST_OBJECT_TYPE,
        params: ['display-only update']
      },
      rawParams: ['initial']
    });

    await reconciler.reconcile([]);

    expect(runtime.destroyObject).toHaveBeenCalledWith(nodeId);
  });

  it('skips updates when the runtime object descriptor has not changed', async () => {
    const runtime = createFakeEditorRuntime();
    const reconciler = new EditorRuntimeReconciler(runtime);

    const node = objectNode('object-editor-runtime-skip-test', {
      expr: `${TEST_OBJECT_TYPE} initial`,
      name: TEST_OBJECT_TYPE,
      params: ['initial']
    });

    await reconciler.reconcile([node]);
    await reconciler.reconcile([node]);

    expect(runtime.createObject).toHaveBeenCalledTimes(1);
    expect(runtime.updateObject).not.toHaveBeenCalled();
  });

  it('retries failed creates as creates on the next reconcile', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const runtime = createFakeEditorRuntime({
      createObject: vi
        .fn()
        .mockRejectedValueOnce(new Error('create failed'))
        .mockResolvedValueOnce(undefined)
    });

    const reconciler = new EditorRuntimeReconciler(runtime);

    const node = objectNode('object-editor-runtime-create-retry-test', {
      expr: `${TEST_OBJECT_TYPE} initial`,
      name: TEST_OBJECT_TYPE,
      params: ['initial']
    });

    await expect(reconciler.reconcile([node])).resolves.toBeUndefined();
    await reconciler.reconcile([node]);

    expect(runtime.createObject).toHaveBeenCalledTimes(2);
    expect(runtime.updateObject).not.toHaveBeenCalled();

    expect(warn).toHaveBeenCalledWith(expect.any(String), expect.any(Error));
  });

  it('retries failed updates on the next reconcile', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const runtime = createFakeEditorRuntime({
      updateObject: vi
        .fn()
        .mockRejectedValueOnce(new Error('update failed'))
        .mockResolvedValueOnce(undefined)
    });

    const reconciler = new EditorRuntimeReconciler(runtime);
    const nodeId = 'object-editor-runtime-update-retry-test';

    await reconciler.reconcile([
      objectNode(nodeId, {
        expr: `${TEST_OBJECT_TYPE} initial`,
        name: TEST_OBJECT_TYPE,
        params: ['initial']
      })
    ]);

    const updatedNode = objectNode(nodeId, {
      expr: `${TEST_OBJECT_TYPE} initial`,
      name: TEST_OBJECT_TYPE,
      params: ['updated']
    });

    await expect(reconciler.reconcile([updatedNode])).resolves.toBeUndefined();
    await reconciler.reconcile([updatedNode]);

    expect(runtime.updateObject).toHaveBeenCalledTimes(2);

    expect(warn).toHaveBeenCalledWith(expect.any(String), expect.any(Error));
  });

  it('destroys runtime objects removed while an earlier create is still pending', async () => {
    let releaseCreate!: () => void;

    const runtime = createFakeEditorRuntime({
      createObject: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            releaseCreate = resolve;
          })
      )
    });

    const reconciler = new EditorRuntimeReconciler(runtime);
    const nodeId = 'object-editor-runtime-pending-create-test';

    const firstReconcile = reconciler.reconcile([
      objectNode(nodeId, {
        expr: `${TEST_OBJECT_TYPE} initial`,
        name: TEST_OBJECT_TYPE,
        params: ['initial']
      })
    ]);

    await reconciler.reconcile([]);
    releaseCreate();

    await firstReconcile;

    expect(runtime.destroyObject).toHaveBeenCalledWith(nodeId);
  });
});
