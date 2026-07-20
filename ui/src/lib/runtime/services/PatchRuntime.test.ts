import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageSystem } from '$lib/messages/MessageSystem';
import { MessageContext } from '$lib/messages/MessageContext';

import { AudioRegistry } from '$lib/registry/AudioRegistry';
import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';

import { ScopeAudioNode } from '$objects/scope~/ScopeAudioNode';
import { TapNode } from '$objects/tap~/native-dsp/nodes/tap.node';

import { AudioAdapter } from '../adapters/AudioAdapter';
import { MessageAdapter } from '../adapters/MessageAdapter';

import {
  setRuntimeGraphFromEditorGraph,
  setRuntimeObjectsFromEditorNodes
} from '../utils/editor-reconciler';

import {
  buttonNode,
  createFakeEditorRuntime,
  createFakeAudioService,
  createFakeEventBus,
  createFakeObjectService,
  createFakeRuntimeConnectionServices,
  knobNode,
  objectNode,
  PatchRuntimeTestObject,
  resetPatchRuntimeTestObject,
  sliderNode,
  switchNode,
  tapTildeNode,
  TEST_OBJECT_TYPE,
  textboxNode,
  toggleNode,
  createTestPatchRuntime
} from '../utils/runtime-test-utils';

import type { ProfilerCoordinator } from '$lib/profiler';

beforeEach(() => {
  resetPatchRuntimeTestObject();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const isScope = (objectType: string) => objectType === 'scope~';
const isOsc = (objectType: string) => objectType === 'osc~';
const isTap = (objectType: string) => objectType === 'tap~';

type TestMessageAdapterOptions = Omit<
  ConstructorParameters<typeof MessageAdapter>[0],
  'messageSystem'
> & {
  messageSystem?: ConstructorParameters<typeof MessageAdapter>[0]['messageSystem'];
};

const createTestMessageAdapter = (options: TestMessageAdapterOptions) =>
  new MessageAdapter({
    ...options,
    messageSystem: options.messageSystem ?? MessageSystem.getInstance()
  });

describe('MessageAdapter', () => {
  it('owns V2 text object lifecycle independent of editor graph reconciliation', async () => {
    const objectService = createFakeObjectService();
    const eventBus = PatchiesEventBus.getInstance();
    const runtime = createTestMessageAdapter({ objectService, eventBus });
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
    const objectService = createFakeObjectService();
    const eventBus = PatchiesEventBus.getInstance();
    const runtime = createTestMessageAdapter({ objectService, eventBus });
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

    const objectService = createFakeObjectService();
    const paramUpdates: Array<{ nodeId: string; params: unknown[] }> = [];

    const runtime = createTestMessageAdapter({
      objectService,
      onObjectParamsChange: (nodeId, params) => paramUpdates.push({ nodeId, params }),
      eventBus: PatchiesEventBus.getInstance()
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
    const objectService = createFakeObjectService();
    const eventBus = createFakeEventBus();
    const paramUpdates: Array<{ nodeId: string; params: unknown[] }> = [];

    const runtime = createTestMessageAdapter({
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
    const nodeId = 'object-port-runtime-test';

    const objectService = createFakeObjectService();
    const eventBus = PatchiesEventBus.getInstance();
    const runtime = createTestMessageAdapter({ objectService, eventBus });

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
    const nodeId = 'object-message-subscription-test';

    const objectService = createFakeObjectService();
    const eventBus = PatchiesEventBus.getInstance();
    const runtime = createTestMessageAdapter({ objectService, eventBus });

    await runtime.createObject({
      id: nodeId,
      objectType: TEST_OBJECT_TYPE,
      data: { params: ['initial'] },
      rawParams: ['initial']
    });

    const onMessage = vi.fn();
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
    const nodeId = 'object-revision-replace-test';
    const objectService = createFakeObjectService();

    const runtime = createTestMessageAdapter({
      objectService,
      eventBus: PatchiesEventBus.getInstance()
    });

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

  it('notifies data subscribers when updating an object with the same lifecycle key', async () => {
    const nodeId = 'object-data-update-same-lifecycle-test';
    const objectService = createFakeObjectService();

    const dataUpdates: { nodeId: string; updates: Record<string, unknown> }[] = [];

    const runtime = createTestMessageAdapter({
      objectService,
      eventBus: PatchiesEventBus.getInstance(),
      onObjectDataChange: (nodeId, updates) => dataUpdates.push({ nodeId, updates })
    });

    await runtime.createObject({
      id: nodeId,
      objectType: TEST_OBJECT_TYPE,
      data: { params: ['stable'], value: 'initial' },
      rawParams: ['stable']
    });

    const revisionAfterCreate = runtime.trackObjectViewRevision(nodeId);
    dataUpdates.length = 0;
    PatchRuntimeTestObject.normalizeDataOnUpdate = true;

    await runtime.updateObject(nodeId, {
      id: nodeId,
      objectType: TEST_OBJECT_TYPE,
      data: { params: ['stable'], value: 'incoming' },
      rawParams: ['stable']
    });

    expect(dataUpdates).toEqual([
      {
        nodeId,
        updates: expect.objectContaining({ value: 'normalized' })
      }
    ]);

    expect(runtime.trackObjectViewRevision(nodeId)).toBe(revisionAfterCreate + 1);
  });

  it('notifies view revision subscribers without Svelte reactivity', async () => {
    const nodeId = 'object-revision-subscription-test';
    const objectService = createFakeObjectService();

    const runtime = createTestMessageAdapter({
      objectService,
      eventBus: PatchiesEventBus.getInstance()
    });

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

describe('AudioAdapter', () => {
  it('owns audio object service interactions', () => {
    const audioService = createFakeAudioService();
    const runtime = new AudioAdapter({ audioService });
    const nodeId = 'object-audio-runtime-test';

    runtime.upsertAudioObject({
      id: nodeId,
      objectType: 'osc~',
      params: [440]
    });

    expect(audioService.removeNodeById).toHaveBeenCalledWith(nodeId);
    expect(audioService.createNode).toHaveBeenCalledWith(nodeId, 'osc~', [440]);

    runtime.audioService.send(nodeId, 'frequency', 220);
    expect(audioService.send).toHaveBeenCalledWith(nodeId, 'frequency', 220);

    expect(runtime.audioService.getNodeById(nodeId)).toBe(audioService.audioNode);

    runtime.destroyAudioObject(nodeId);
    expect(audioService.removeNodeById).toHaveBeenLastCalledWith(nodeId);
  });

  it('consumes suppressed audio sync markers once', () => {
    const audioService = createFakeAudioService();
    const runtime = new AudioAdapter({ audioService });
    const nodeId = 'object-audio-sync-test';

    runtime.suppressNextAudioObjectSync(nodeId);

    expect(runtime.consumeSuppressedAudioObjectSync(nodeId)).toBe(true);
    expect(runtime.consumeSuppressedAudioObjectSync(nodeId)).toBe(false);
  });

  it('handles async audio node creation failures as fire-and-forget work', () => {
    const audioService = createFakeAudioService();
    const runtime = new AudioAdapter({ audioService });
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
    const tapNodeId = 'tap-command-target';
    const sourceNodeId = 'tap-command-source';

    const audioService = createFakeAudioService();
    const onAudioObjectDataChange = vi.fn();

    const runtime = new AudioAdapter({
      audioService,
      isAudioObject: isTap,
      onAudioObjectDataChange
    });

    const messageSystem = MessageSystem.getInstance();

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
    const runtime = createTestPatchRuntime({
      objectService: createFakeObjectService(),
      audioService: createFakeAudioService()
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

    await runtime.setGraph({
      objects: [{ id: buttonNodeId, type: 'button', data: {} }],
      connections: [
        {
          id: 'input-to-button',
          source: inputNodeId,
          target: buttonNodeId,
          outlet: 'message-out',
          inlet: 'message-in-0'
        },
        {
          id: 'button-to-target',
          source: buttonNodeId,
          target: targetNodeId,
          outlet: 'message-out',
          inlet: 'message-in-0'
        }
      ]
    });

    expect(runtime.getGraph()).toEqual({
      objects: [{ id: buttonNodeId, type: 'button', data: {} }],
      connections: [
        {
          id: 'input-to-button',
          source: inputNodeId,
          target: buttonNodeId,
          outlet: 'message-out',
          inlet: 'message-in-0'
        },
        {
          id: 'button-to-target',
          source: buttonNodeId,
          target: targetNodeId,
          outlet: 'message-out',
          inlet: 'message-in-0'
        }
      ]
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

  it('fans runtime graph connections out to headless graph services', async () => {
    const connectionServices = createFakeRuntimeConnectionServices();

    const runtime = createTestPatchRuntime({
      objectService: createFakeObjectService(),
      audioService: createFakeAudioService(),
      ...connectionServices
    });

    await runtime.setGraph({
      objects: [
        { id: 'worker-1', type: 'worker', data: {} },
        { id: 'canvas-1', type: 'canvas', data: {} }
      ],
      connections: [
        {
          id: 'worker-to-canvas',
          source: 'worker-1',
          outlet: 'video-out',
          target: 'canvas-1',
          inlet: 'video-in-0'
        }
      ]
    });

    const expectedEdges = [
      {
        id: 'worker-to-canvas',
        source: 'worker-1',
        sourceHandle: 'video-out',
        target: 'canvas-1',
        targetHandle: 'video-in-0'
      }
    ];

    expect(connectionServices.glSystem.updateEdges).toHaveBeenCalledWith(expectedEdges);
    expect(connectionServices.audioAnalysisSystem.updateEdges).toHaveBeenCalledWith(expectedEdges);
    expect(connectionServices.workerNodeSystem.updateEdges).toHaveBeenCalledWith(expectedEdges);
    expect(connectionServices.mediaPipeNodeSystem.updateEdges).toHaveBeenCalledWith(expectedEdges);

    expect(connectionServices.directChannelService.updateNodeTypes).toHaveBeenCalledWith([
      { id: 'worker-1', type: 'worker' },
      { id: 'canvas-1', type: 'canvas' }
    ]);

    expect(connectionServices.directChannelService.updateEdges).toHaveBeenCalledWith(expectedEdges);

    expect(connectionServices.workletDirectChannelService.updateEdges).toHaveBeenCalledWith(
      expectedEdges
    );
  });

  it('cleans up deleted nodes through runtime-owned services', () => {
    const connectionServices = createFakeRuntimeConnectionServices();
    const audioService = createFakeAudioService();

    const messageSystem = { unregisterNode: vi.fn() } as unknown as MessageSystem;
    const profilerCoordinator = { unregister: vi.fn() } as unknown as ProfilerCoordinator;

    const runtime = createTestPatchRuntime({
      objectService: createFakeObjectService(),
      audioService,
      ...connectionServices,
      messageSystem,
      profilerCoordinator
    });

    const nodeId = 'deleted-node';
    runtime.cleanupDeletedNodes([nodeId]);

    expect(messageSystem.unregisterNode).toHaveBeenCalledWith(nodeId);
    expect(audioService.removeNodeById).toHaveBeenCalledWith(nodeId);
    expect(profilerCoordinator.unregister).toHaveBeenCalledWith(nodeId);
    expect(connectionServices.mediaPipeNodeSystem.unregister).toHaveBeenCalledWith(nodeId);
  });

  it('does not fan out edges when setGraph changes only object data', async () => {
    const connectionServices = createFakeRuntimeConnectionServices();
    const runtime = createTestPatchRuntime({
      objectService: createFakeObjectService(),
      audioService: createFakeAudioService(),
      ...connectionServices
    });

    const connections = [
      {
        id: 'button-to-toggle',
        source: 'button-1',
        outlet: 'message-out',
        target: 'toggle-1',
        inlet: 'message-in'
      }
    ];

    await runtime.setGraph({
      objects: [
        { id: 'button-1', type: 'button', data: {} },
        { id: 'toggle-1', type: 'toggle', data: { value: false } }
      ],
      connections
    });

    expect(connectionServices.glSystem.updateEdges).toHaveBeenCalledTimes(1);

    await runtime.setGraph({
      objects: [
        { id: 'button-1', type: 'button', data: {} },
        { id: 'toggle-1', type: 'toggle', data: { value: true } }
      ],
      connections
    });

    expect(connectionServices.glSystem.updateEdges).toHaveBeenCalledTimes(1);
    expect(connectionServices.audioAnalysisSystem.updateEdges).toHaveBeenCalledTimes(1);
    expect(connectionServices.workerNodeSystem.updateEdges).toHaveBeenCalledTimes(1);
    expect(connectionServices.mediaPipeNodeSystem.updateEdges).toHaveBeenCalledTimes(1);
    expect(connectionServices.directChannelService.updateEdges).toHaveBeenCalledTimes(1);
    expect(connectionServices.workletDirectChannelService.updateEdges).toHaveBeenCalledTimes(1);
  });

  it('updates connections separately from objects', async () => {
    const connectionServices = createFakeRuntimeConnectionServices();
    const runtime = createTestPatchRuntime({
      objectService: createFakeObjectService(),
      audioService: createFakeAudioService(),
      ...connectionServices
    });

    await runtime.setObjects([
      { id: 'button-1', type: 'button', data: {} },
      { id: 'toggle-1', type: 'toggle', data: { value: false } }
    ]);

    expect(connectionServices.glSystem.updateEdges).not.toHaveBeenCalled();

    await runtime.setConnections([
      {
        id: 'button-to-toggle',
        source: 'button-1',
        outlet: 'message-out',
        target: 'toggle-1',
        inlet: 'message-in'
      }
    ]);

    expect(connectionServices.glSystem.updateEdges).toHaveBeenCalledTimes(1);

    await runtime.setObjects([
      { id: 'button-1', type: 'button', data: {} },
      { id: 'toggle-1', type: 'toggle', data: { value: true } }
    ]);

    expect(connectionServices.glSystem.updateEdges).toHaveBeenCalledTimes(1);
  });

  it('updates direct-channel node types when objects change without connection changes', async () => {
    const connectionServices = createFakeRuntimeConnectionServices();
    const runtime = createTestPatchRuntime({
      objectService: createFakeObjectService(),
      audioService: createFakeAudioService(),
      ...connectionServices
    });

    await runtime.setGraph({
      objects: [{ id: 'worker-1', type: 'worker', data: {} }],
      connections: []
    });

    connectionServices.directChannelService.updateNodeTypes.mockClear();
    connectionServices.directChannelService.updateEdges.mockClear();

    await runtime.setGraph({
      objects: [{ id: 'worker-1', type: 'js', data: {} }],
      connections: []
    });

    expect(connectionServices.directChannelService.updateNodeTypes).toHaveBeenCalledWith([
      { id: 'worker-1', type: 'js' }
    ]);
    expect(connectionServices.directChannelService.updateEdges).not.toHaveBeenCalled();
  });

  it('reconciles direct API object-kind transitions', async () => {
    const nodeId = 'direct-object-kind-transition';
    const objectService = createFakeObjectService();
    const audioService = createFakeAudioService();
    const runtime = createTestPatchRuntime({
      objectService,
      audioService,
      isAudioObject: isOsc
    });

    await runtime.createObject({
      id: nodeId,
      type: 'osc~',
      data: { name: 'osc~', expr: 'osc~', params: [] }
    });
    await runtime.updateObject(nodeId, {
      id: nodeId,
      type: TEST_OBJECT_TYPE,
      data: { params: ['message'] }
    });

    expect(audioService.removeNodeById).toHaveBeenLastCalledWith(nodeId);
    expect(objectService.getObjectById(nodeId)).toBeInstanceOf(PatchRuntimeTestObject);

    await runtime.updateObject(nodeId, {
      id: nodeId,
      type: 'osc~',
      data: { name: 'osc~', expr: 'osc~', params: [] }
    });

    expect(objectService.getObjectById(nodeId)).toBeNull();
    expect(audioService.createNode).toHaveBeenLastCalledWith(nodeId, 'osc~', []);
  });

  it('serializes overlapping object synchronization and retains the latest descriptor', async () => {
    let releaseCreate!: () => void;
    PatchRuntimeTestObject.createGate = new Promise((resolve) => {
      releaseCreate = resolve;
    });

    const objectService = createFakeObjectService();
    const runtime = createTestPatchRuntime({
      objectService,
      audioService: createFakeAudioService()
    });

    const firstSync = runtime.setObjects([
      { id: 'object-1', type: TEST_OBJECT_TYPE, data: { params: ['first'] } }
    ]);
    const secondSync = runtime.setObjects([
      { id: 'object-1', type: TEST_OBJECT_TYPE, data: { params: ['second'] } }
    ]);

    releaseCreate();
    await Promise.all([firstSync, secondSync]);

    expect(objectService.getObjectById('object-1')?.context.getParams()).toEqual(['second']);
  });

  it('waits for object synchronization before updating connections', async () => {
    let releaseCreate!: () => void;
    PatchRuntimeTestObject.createGate = new Promise((resolve) => {
      releaseCreate = resolve;
    });

    const connectionServices = createFakeRuntimeConnectionServices();
    const runtime = createTestPatchRuntime({
      objectService: createFakeObjectService(),
      audioService: createFakeAudioService(),
      ...connectionServices
    });

    const objectSync = runtime.setObjects([
      { id: 'object-1', type: TEST_OBJECT_TYPE, data: { params: [] } }
    ]);
    const connectionSync = runtime.setConnections([
      {
        id: 'object-to-target',
        source: 'object-1',
        outlet: 'out',
        target: 'target-1',
        inlet: 'value'
      }
    ]);

    await Promise.resolve();

    expect(connectionServices.glSystem.updateEdges).not.toHaveBeenCalled();

    releaseCreate();
    await Promise.all([objectSync, connectionSync]);

    expect(connectionServices.glSystem.updateEdges).toHaveBeenCalledTimes(1);
  });

  it('creates a message endpoint for audio objects', async () => {
    const audioNodeId = 'osc-target';
    const sourceNodeId = 'slider-source';

    const objectService = createFakeObjectService();
    const audioService = createFakeAudioService();

    const runtime = createTestPatchRuntime({
      objectService,
      audioService,
      isAudioObject: isOsc
    });

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

  it('creates message objects from public runtime graph specs', async () => {
    const nodeId = 'object-patch-runtime-facade-test';

    const objectService = createFakeObjectService();
    const audioService = createFakeAudioService();

    const runtime = createTestPatchRuntime({
      objectService,
      audioService,
      isAudioObject: (objectType) => objectType === 'osc~'
    });

    await runtime.createObject({
      id: nodeId,
      type: TEST_OBJECT_TYPE,
      data: {
        name: TEST_OBJECT_TYPE,
        expr: `${TEST_OBJECT_TYPE} initial`,
        params: ['initial']
      }
    });

    expect(PatchRuntimeTestObject.createdRawParams).toContainEqual(['initial']);

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
    const nodeId = 'tap-tilde-editor-runtime-test';
    const audioService = createFakeAudioService();

    const runtime = createTestPatchRuntime({
      objectService: createFakeObjectService(),
      audioService,
      isAudioObject: isTap
    });

    AudioRegistry.getInstance().register(TapNode);

    await setRuntimeGraphFromEditorGraph(runtime, [
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

    await setRuntimeGraphFromEditorGraph(runtime, []);

    expect(audioService.removeNodeById).toHaveBeenLastCalledWith(nodeId);

    runtime.destroy();
  });

  it('diffs runtime-managed audio nodes before calling the audio runtime', async () => {
    const nodeId = 'tap-tilde-runtime-noop-test';
    const audioService = createFakeAudioService();

    const runtime = createTestPatchRuntime({
      objectService: createFakeObjectService(),
      audioService,
      isAudioObject: isTap
    });

    const node = tapTildeNode(nodeId, {
      bufferSize: 1024,
      mode: 'xy',
      fps: 30,
      zeroCrossing: false
    });

    AudioRegistry.getInstance().register(TapNode);

    await setRuntimeGraphFromEditorGraph(runtime, [node]);
    await setRuntimeGraphFromEditorGraph(runtime, [node]);

    expect(audioService.createNode).toHaveBeenCalledTimes(1);

    expect(audioService.createNode).toHaveBeenCalledWith(nodeId, 'tap~', [
      null,
      null,
      1024,
      'xy',
      30,
      false
    ]);

    await setRuntimeGraphFromEditorGraph(runtime, []);

    expect(audioService.removeNodeById).toHaveBeenLastCalledWith(nodeId);

    runtime.destroy();
  });

  it('does not sync dedicated audio UI nodes that still own their view runtime', async () => {
    const nodeId = 'scope-editor-runtime-test';
    const audioService = createFakeAudioService();

    const runtime = createTestPatchRuntime({
      objectService: createFakeObjectService(),
      audioService,
      isAudioObject: isScope
    });

    AudioRegistry.getInstance().register(ScopeAudioNode);

    await setRuntimeGraphFromEditorGraph(runtime, [
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
    const nodeId = 'object-box-audio-reconciler-test';

    const objectService = createFakeObjectService();
    const audioService = createFakeAudioService();

    const createObject = vi.spyOn(objectService, 'createObject');

    const runtime = createTestPatchRuntime({
      objectService,
      audioService,
      isAudioObject: isOsc
    });

    await setRuntimeGraphFromEditorGraph(runtime, [
      objectNode(nodeId, {
        expr: 'osc~ 440',
        name: 'osc~',
        params: [440]
      })
    ]);

    expect(audioService.createNode).toHaveBeenCalledWith(nodeId, 'osc~', [440]);
    expect(createObject).not.toHaveBeenCalled();

    await setRuntimeGraphFromEditorGraph(runtime, []);

    expect(audioService.removeNodeById).toHaveBeenLastCalledWith(nodeId);

    runtime.destroy();
  });

  it('replaces object-box audio nodes with message objects when the object type changes', async () => {
    const objectService = createFakeObjectService();
    const audioService = createFakeAudioService();

    const runtime = createTestPatchRuntime({
      objectService,
      audioService,
      isAudioObject: isOsc
    });
    const nodeId = 'object-box-audio-to-message-test';

    await setRuntimeGraphFromEditorGraph(runtime, [
      objectNode(nodeId, {
        expr: 'osc~ 440',
        name: 'osc~',
        params: [440]
      })
    ]);

    await setRuntimeGraphFromEditorGraph(runtime, [
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
    const nodeId = 'object-box-audio-suppressed-reconcile-test';
    const audioService = createFakeAudioService();

    const runtime = createTestPatchRuntime({
      objectService: createFakeObjectService(),
      audioService,
      isAudioObject: isOsc
    });

    await setRuntimeGraphFromEditorGraph(runtime, [
      objectNode(nodeId, {
        expr: 'osc~ 440',
        name: 'osc~',
        params: [440]
      })
    ]);

    runtime.suppressNextAudioObjectSync(nodeId);

    await setRuntimeGraphFromEditorGraph(runtime, [
      objectNode(nodeId, {
        expr: 'osc~ 220',
        name: 'osc~',
        params: [220]
      })
    ]);

    await setRuntimeGraphFromEditorGraph(runtime, [
      objectNode(nodeId, {
        expr: 'osc~ 220',
        name: 'osc~',
        params: [220]
      })
    ]);

    expect(audioService.createNode).toHaveBeenCalledTimes(1);

    await setRuntimeGraphFromEditorGraph(runtime, [
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
    const audioService = createFakeAudioService();

    const runtime = createTestPatchRuntime({
      objectService: createFakeObjectService(),
      audioService,
      isAudioObject: isOsc
    });

    const node = objectNode('object-box-audio-undo-test', {
      expr: 'osc~ 440',
      name: 'osc~',
      params: [440]
    });

    await setRuntimeGraphFromEditorGraph(runtime, [node]);

    audioService.getNodeById.mockReturnValueOnce(null);
    await setRuntimeGraphFromEditorGraph(runtime, [node]);

    expect(audioService.createNode).toHaveBeenCalledTimes(2);

    runtime.destroy();
  });

  it('translates XYFlow button nodes into public runtime object specs', async () => {
    const runtime = createFakeEditorRuntime();
    const nodeId = 'button-editor-runtime-test';

    await setRuntimeGraphFromEditorGraph(runtime, [buttonNode(nodeId)]);

    expect(runtime.setGraph).toHaveBeenCalledWith({
      objects: [{ id: nodeId, type: 'button', data: {} }],
      connections: []
    });
  });

  it('translates XYFlow toggle value into runtime data', async () => {
    const runtime = createFakeEditorRuntime();
    const nodeId = 'toggle-editor-runtime-test';

    await setRuntimeGraphFromEditorGraph(runtime, [toggleNode(nodeId, { value: true })]);

    expect(runtime.setGraph).toHaveBeenCalledWith({
      objects: [
        {
          id: nodeId,
          type: 'toggle',
          data: { value: true }
        }
      ],
      connections: []
    });
  });

  it('excludes editor position from runtime object data', async () => {
    const runtime = createFakeEditorRuntime();
    const node = toggleNode('toggle-editor-runtime-test', { value: true });

    await setRuntimeObjectsFromEditorNodes(runtime, [{ ...node, position: { x: 100, y: 200 } }]);

    expect(runtime.setObjects).toHaveBeenCalledWith([
      { id: 'toggle-editor-runtime-test', type: 'toggle', data: { value: true } }
    ]);
  });

  it('translates XYFlow switch value into runtime data', async () => {
    const runtime = createFakeEditorRuntime();
    const nodeId = 'switch-editor-runtime-test';

    await setRuntimeGraphFromEditorGraph(runtime, [switchNode(nodeId, { value: true })]);

    expect(runtime.setGraph).toHaveBeenCalledWith({
      objects: [
        {
          id: nodeId,
          type: 'switch',
          data: { value: true }
        }
      ],
      connections: []
    });
  });

  it('translates XYFlow textbox text into runtime data', async () => {
    const runtime = createFakeEditorRuntime();
    const nodeId = 'textbox-editor-runtime-test';

    await setRuntimeGraphFromEditorGraph(runtime, [textboxNode(nodeId, { text: 'saved text' })]);

    expect(runtime.setGraph).toHaveBeenCalledWith({
      objects: [
        {
          id: nodeId,
          type: 'textbox',
          data: { text: 'saved text' }
        }
      ],
      connections: []
    });
  });

  it('translates XYFlow slider data into runtime data', async () => {
    const runtime = createFakeEditorRuntime();
    const nodeId = 'slider-editor-runtime-test';

    await setRuntimeGraphFromEditorGraph(runtime, [
      sliderNode(nodeId, {
        value: 7,
        min: -10,
        max: 10,
        defaultValue: 2,
        isFloat: true,
        step: 0.5
      })
    ]);

    expect(runtime.setGraph).toHaveBeenCalledWith({
      objects: [
        {
          id: nodeId,
          type: 'slider',
          data: {
            value: 7,
            min: -10,
            max: 10,
            defaultValue: 2,
            isFloat: true,
            step: 0.5
          }
        }
      ],
      connections: []
    });
  });

  it('translates XYFlow knob data into runtime data', async () => {
    const runtime = createFakeEditorRuntime();
    const nodeId = 'knob-editor-runtime-test';

    await setRuntimeGraphFromEditorGraph(runtime, [
      knobNode(nodeId, {
        value: 7,
        min: -10,
        max: 10,
        defaultValue: 2,
        isFloat: true,
        step: 0.5
      })
    ]);

    expect(runtime.setGraph).toHaveBeenCalledWith({
      objects: [
        {
          id: nodeId,
          type: 'knob',
          data: {
            value: 7,
            min: -10,
            max: 10,
            defaultValue: 2,
            isFloat: true,
            step: 0.5
          }
        }
      ],
      connections: []
    });
  });

  it('translates XYFlow object nodes into public runtime object specs', async () => {
    const runtime = createFakeEditorRuntime();

    const nodeId = 'object-editor-runtime-test';

    await setRuntimeGraphFromEditorGraph(runtime, [
      objectNode(nodeId, {
        expr: `${TEST_OBJECT_TYPE} initial`,
        name: TEST_OBJECT_TYPE,
        params: ['initial']
      })
    ]);

    expect(runtime.setGraph).toHaveBeenCalledWith({
      objects: [
        {
          id: nodeId,
          type: TEST_OBJECT_TYPE,
          data: {
            expr: `${TEST_OBJECT_TYPE} initial`,
            name: TEST_OBJECT_TYPE,
            params: ['initial']
          }
        }
      ],
      connections: []
    });
  });

  it('translates XYFlow edges into public runtime connections', async () => {
    const runtime = createFakeEditorRuntime();

    await setRuntimeGraphFromEditorGraph(
      runtime,
      [buttonNode('button-1'), toggleNode('toggle-1')],
      [
        {
          id: 'button-to-toggle',
          source: 'button-1',
          sourceHandle: 'message-out',
          target: 'toggle-1',
          targetHandle: 'message-in'
        }
      ]
    );

    expect(runtime.setGraph).toHaveBeenCalledWith({
      objects: [
        { id: 'button-1', type: 'button', data: {} },
        { id: 'toggle-1', type: 'toggle', data: {} }
      ],
      connections: [
        {
          id: 'button-to-toggle',
          source: 'button-1',
          outlet: 'message-out',
          target: 'toggle-1',
          inlet: 'message-in'
        }
      ]
    });
  });

  it('passes an empty runtime object list when editor nodes are removed', async () => {
    const runtime = createFakeEditorRuntime();

    await setRuntimeGraphFromEditorGraph(runtime, []);

    expect(runtime.setGraph).toHaveBeenCalledWith({ objects: [], connections: [] });
  });
});
