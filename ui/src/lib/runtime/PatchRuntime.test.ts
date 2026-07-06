import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Edge, Node } from '@xyflow/svelte';
import { PatchAudioRuntime } from './PatchAudioRuntime';
import { PatchMessageRuntime, type PatchRuntimeObjectService } from './PatchMessageRuntime';
import { PatchRuntime } from './PatchRuntime';
import { EditorRuntimeReconciler } from './EditorRuntimeReconciler';
import { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { TextObjectV2 } from '$lib/objects/v2/interfaces/text-objects';
import type { MessageContext } from '$lib/messages/MessageContext';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { logger } from '$lib/utils/logger';

const TEST_OBJECT_TYPE = 'patch-runtime-test';

class PatchRuntimeTestObject implements TextObjectV2 {
  static type = TEST_OBJECT_TYPE;
  static inlets: ObjectInlet[] = [{ name: 'value', type: 'any' as const }];
  static outlets: ObjectOutlet[] = [{ name: 'out', type: 'any' as const }];

  static createdRawParams: unknown[][] = [];
  static destroyedNodeIds: string[] = [];
  static createGate: Promise<void> | null = null;
  static normalizeParamOnCreate = false;
  static dynamicInlets: ObjectInlet[] | null = null;
  static dynamicOutlets: ObjectOutlet[] | null = null;

  constructor(
    readonly nodeId: string,
    readonly context: ObjectContext
  ) {}

  async create(rawParams: unknown[]) {
    await PatchRuntimeTestObject.createGate;
    PatchRuntimeTestObject.createdRawParams.push(rawParams);

    if (PatchRuntimeTestObject.normalizeParamOnCreate) {
      this.context.setParam(0, 'normalized');
    }
  }

  destroy() {
    PatchRuntimeTestObject.destroyedNodeIds.push(this.nodeId);
  }

  getInlets() {
    return PatchRuntimeTestObject.dynamicInlets ?? PatchRuntimeTestObject.inlets;
  }

  getOutlets() {
    return PatchRuntimeTestObject.dynamicOutlets ?? PatchRuntimeTestObject.outlets;
  }
}

beforeEach(() => {
  PatchRuntimeTestObject.createdRawParams = [];
  PatchRuntimeTestObject.destroyedNodeIds = [];
  PatchRuntimeTestObject.createGate = null;
  PatchRuntimeTestObject.normalizeParamOnCreate = false;
  PatchRuntimeTestObject.dynamicInlets = null;
  PatchRuntimeTestObject.dynamicOutlets = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

class FakeObjectService implements PatchRuntimeObjectService {
  private objectsById = new Map<string, TextObjectV2>();

  isV2ObjectType(objectType: string): boolean {
    return objectType === TEST_OBJECT_TYPE;
  }

  async createObject(
    nodeId: string,
    objectType: string,
    messageContext: MessageContext,
    params: unknown[] = [],
    rawParams: string[] = []
  ): Promise<TextObjectV2 | null> {
    if (!this.isV2ObjectType(objectType)) return null;

    const context = new ObjectContext(nodeId, messageContext, PatchRuntimeTestObject.inlets);
    context.initParams(params);

    const object = new PatchRuntimeTestObject(nodeId, context);
    this.objectsById.set(nodeId, object);
    await object.create(rawParams);

    return object;
  }

  removeObjectById(nodeId: string): void {
    const object = this.objectsById.get(nodeId);
    if (!object) return;

    object.destroy?.();
    object.context.destroy();
    this.objectsById.delete(nodeId);
  }

  getObjectById(nodeId: string): TextObjectV2 | null {
    return this.objectsById.get(nodeId) ?? null;
  }
}

class FakeAudioService {
  removeNodeById = vi.fn();
  createNode = vi.fn();
  updateEdges = vi.fn();
  send = vi.fn();
  audioNode = {
    nodeId: 'object-audio-runtime-test',
    audioNode: null
  };

  getNodeById = vi.fn(() => this.audioNode);
}

class FakeEventBus {
  listeners = new Map<string, Array<(event: never) => void>>();

  addEventListener = vi.fn((type: string, listener: (event: never) => void) => {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  });

  removeEventListener = vi.fn((type: string, listener: (event: never) => void) => {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((candidate) => candidate !== listener)
    );
  });

  dispatch(event: { type: string } & Record<string, unknown>) {
    for (const listener of this.listeners.get(event.type) ?? []) {
      listener(event as never);
    }
  }
}

function objectNode(id: string, data: Record<string, unknown>): Node {
  return {
    id,
    type: 'object',
    position: { x: 0, y: 0 },
    data
  };
}

describe('PatchMessageRuntime', () => {
  it('owns V2 text object lifecycle independent of editor graph reconciliation', async () => {
    const objectService = new FakeObjectService();
    const runtime = new PatchMessageRuntime({ objectService });
    const nodeId = 'object-patch-runtime-test';

    await runtime.createObject({
      id: nodeId,
      objectType: TEST_OBJECT_TYPE,
      params: ['initial'],
      rawParams: ['initial']
    });

    const createdObject = objectService.getObjectById(nodeId);
    expect(createdObject).toBeInstanceOf(PatchRuntimeTestObject);
    expect(createdObject?.context.getParams()).toEqual(['initial']);
    expect(PatchRuntimeTestObject.createdRawParams).toEqual([['initial']]);

    await runtime.updateObject(nodeId, {
      id: nodeId,
      objectType: TEST_OBJECT_TYPE,
      params: ['display-only update'],
      rawParams: ['initial']
    });

    expect(objectService.getObjectById(nodeId)).toBe(createdObject);
    expect(PatchRuntimeTestObject.destroyedNodeIds).toEqual([]);

    runtime.destroyObject(nodeId);

    expect(objectService.getObjectById(nodeId)).toBeNull();
    expect(runtime.getObjectMessageContext(nodeId)).toBeNull();
    expect(PatchRuntimeTestObject.destroyedNodeIds).toEqual([nodeId]);
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
      params: ['initial'],
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
      params: ['initial'],
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
      params: ['initial'],
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
      params: ['initial'],
      rawParams: ['initial']
    });

    const revisionAfterCreate = runtime.getObjectRevision(nodeId);

    await runtime.updateObject(nodeId, {
      id: nodeId,
      objectType: TEST_OBJECT_TYPE,
      params: ['next'],
      rawParams: ['next']
    });

    expect(runtime.getObjectRevision(nodeId)).toBe(revisionAfterCreate + 1);
  });
});

describe('PatchAudioRuntime', () => {
  it('owns audio object service interactions', () => {
    const audioService = new FakeAudioService();
    const runtime = new PatchAudioRuntime({ audioService });
    const nodeId = 'object-audio-runtime-test';
    const edges = [{ id: 'audio-edge-1', source: nodeId, target: 'out' }] as Edge[];

    runtime.createOrUpdateAudioObject(nodeId, 'osc~', [440], edges);

    expect(audioService.removeNodeById).toHaveBeenCalledWith(nodeId);
    expect(audioService.createNode).toHaveBeenCalledWith(nodeId, 'osc~', [440]);
    expect(audioService.updateEdges).toHaveBeenCalledWith(edges);

    runtime.sendAudioObjectMessage(nodeId, 'frequency', 220);
    expect(audioService.send).toHaveBeenCalledWith(nodeId, 'frequency', 220);

    expect(runtime.getAudioObject(nodeId)).toBe(audioService.audioNode);

    runtime.destroyAudioObject(nodeId);
    expect(audioService.removeNodeById).toHaveBeenLastCalledWith(nodeId);
  });

  it('syncs audio object identity changes from view state', () => {
    const audioService = new FakeAudioService();

    const runtime = new PatchAudioRuntime({
      audioService,
      isAudioObject: (objectType) => objectType === 'osc~'
    });

    const nodeId = 'object-audio-sync-test';
    const edges = [{ id: 'audio-edge-1', source: nodeId, target: 'out' }] as Edge[];

    expect(
      runtime.syncAudioObject({
        id: nodeId,
        objectType: 'osc~',
        params: [440],
        edges
      })
    ).toBe(true);

    expect(audioService.createNode).toHaveBeenCalledWith(nodeId, 'osc~', [440]);

    expect(
      runtime.syncAudioObject({
        id: nodeId,
        objectType: 'osc~',
        params: [440],
        edges
      })
    ).toBe(false);

    expect(audioService.createNode).toHaveBeenCalledTimes(1);

    runtime.suppressNextAudioObjectSync(nodeId);

    expect(
      runtime.syncAudioObject({
        id: nodeId,
        objectType: 'osc~',
        params: [220],
        edges
      })
    ).toBe(false);

    expect(audioService.createNode).toHaveBeenCalledTimes(1);

    expect(
      runtime.syncAudioObject({
        id: nodeId,
        objectType: 'gain~',
        params: [0.5],
        edges
      })
    ).toBe(true);

    expect(audioService.removeNodeById).toHaveBeenLastCalledWith(nodeId);
  });

  it('does not record stale audio tracking state when a suppressed first sync is consumed', () => {
    const audioService = new FakeAudioService();

    const runtime = new PatchAudioRuntime({
      audioService,
      isAudioObject: (objectType) => objectType === 'osc~'
    });

    const nodeId = 'object-audio-suppressed-first-sync-test';
    const edges = [{ id: 'audio-edge-1', source: nodeId, target: 'out' }] as Edge[];

    runtime.suppressNextAudioObjectSync(nodeId);

    expect(
      runtime.syncAudioObject({
        id: nodeId,
        objectType: 'osc~',
        params: [440],
        edges
      })
    ).toBe(false);

    runtime.destroy();

    expect(audioService.removeNodeById).not.toHaveBeenCalled();

    expect(
      runtime.syncAudioObject({
        id: nodeId,
        objectType: 'osc~',
        params: [440],
        edges
      })
    ).toBe(true);

    expect(audioService.createNode).toHaveBeenCalledWith(nodeId, 'osc~', [440]);
  });
});

describe('PatchRuntime', () => {
  it('keeps a facade over message and audio runtime helpers', async () => {
    const objectService = new FakeObjectService();
    const audioService = new FakeAudioService();

    const runtime = new PatchRuntime({
      objectService,
      audioService,
      isAudioObject: (objectType) => objectType === 'osc~'
    });
    const nodeId = 'object-patch-runtime-facade-test';
    const edges = [{ id: 'audio-edge-1', source: nodeId, target: 'out' }] as Edge[];

    await runtime.createObject({
      id: nodeId,
      objectType: TEST_OBJECT_TYPE,
      params: ['initial'],
      rawParams: ['initial']
    });
    runtime.createOrUpdateAudioObject(nodeId, 'osc~', [440], edges);

    expect(objectService.getObjectById(nodeId)).toBeInstanceOf(PatchRuntimeTestObject);
    expect(audioService.createNode).toHaveBeenCalledWith(nodeId, 'osc~', [440]);

    runtime.destroy();

    expect(objectService.getObjectById(nodeId)).toBeNull();
    expect(audioService.removeNodeById).toHaveBeenLastCalledWith(nodeId);
  });
});

describe('EditorRuntimeReconciler', () => {
  it('translates XYFlow object nodes into PatchRuntime object calls', async () => {
    const runtime = {
      canCreateObject: vi.fn((objectType: string) => objectType === TEST_OBJECT_TYPE),
      createObject: vi.fn(),
      updateObject: vi.fn(),
      destroyObject: vi.fn()
    };
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
      params: ['initial'],
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
      params: ['display-only update'],
      rawParams: ['initial']
    });

    await reconciler.reconcile([]);

    expect(runtime.destroyObject).toHaveBeenCalledWith(nodeId);
  });

  it('skips updates when the runtime object spec has not changed', async () => {
    const runtime = {
      canCreateObject: vi.fn((objectType: string) => objectType === TEST_OBJECT_TYPE),
      createObject: vi.fn(),
      updateObject: vi.fn(),
      destroyObject: vi.fn()
    };

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

    const runtime = {
      canCreateObject: vi.fn((objectType: string) => objectType === TEST_OBJECT_TYPE),
      createObject: vi
        .fn()
        .mockRejectedValueOnce(new Error('create failed'))
        .mockResolvedValueOnce(undefined),
      updateObject: vi.fn(),
      destroyObject: vi.fn()
    };

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

    expect(warn).toHaveBeenCalledWith(
      `failed to sync runtime object "object-editor-runtime-create-retry-test"`,
      expect.any(Error)
    );
  });

  it('retries failed updates on the next reconcile', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const runtime = {
      canCreateObject: vi.fn((objectType: string) => objectType === TEST_OBJECT_TYPE),
      createObject: vi.fn(),
      updateObject: vi
        .fn()
        .mockRejectedValueOnce(new Error('update failed'))
        .mockResolvedValueOnce(undefined),
      destroyObject: vi.fn()
    };

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

    expect(warn).toHaveBeenCalledWith(
      `failed to sync runtime object "object-editor-runtime-update-retry-test"`,
      expect.any(Error)
    );
  });

  it('destroys runtime objects removed while an earlier create is still pending', async () => {
    let releaseCreate!: () => void;

    const runtime = {
      canCreateObject: vi.fn((objectType: string) => objectType === TEST_OBJECT_TYPE),
      createObject: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            releaseCreate = resolve;
          })
      ),
      updateObject: vi.fn(),
      destroyObject: vi.fn()
    };

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
