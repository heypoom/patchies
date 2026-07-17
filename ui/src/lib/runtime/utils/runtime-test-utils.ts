import type { Node } from '@xyflow/svelte';
import { vi } from 'vitest';

import type { MessageContext } from '$lib/messages';
import type { AudioService, AudioNodeV2 } from '$lib/audio';

import {
  type ObjectService,
  type TextObjectClass,
  type TextObjectV2,
  type ObjectInlet,
  type ObjectOutlet,
  ObjectContext
} from '$lib/objects';

import type { PatchiesEventBus } from '$lib/eventbus';

import { ButtonObject } from '$objects/button/ButtonObject';

import type { EditorRuntime } from '../types/editor-runtime';
import type { GLSystem } from '$lib/canvas/GLSystem';

export const TEST_OBJECT_TYPE = 'patch-runtime-test';

export class PatchRuntimeTestObject implements TextObjectV2 {
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

export function resetPatchRuntimeTestObject(): void {
  PatchRuntimeTestObject.createdRawParams = [];
  PatchRuntimeTestObject.destroyedNodeIds = [];
  PatchRuntimeTestObject.createGate = null;
  PatchRuntimeTestObject.normalizeParamOnCreate = false;
  PatchRuntimeTestObject.dynamicInlets = null;
  PatchRuntimeTestObject.dynamicOutlets = null;
}

export class FakeObjectService {
  private fakeObjectsById = new Map<string, TextObjectV2>();

  isObjectInRegistry(objectType: string): boolean {
    return objectType === TEST_OBJECT_TYPE || objectType === ButtonObject.type;
  }

  getObjectClass(objectType: string): TextObjectClass | undefined {
    if (objectType === ButtonObject.type) return ButtonObject;
    if (objectType === TEST_OBJECT_TYPE) return PatchRuntimeTestObject;

    return undefined;
  }

  async createObject(
    nodeId: string,
    objectType: string,
    messageContext: MessageContext,
    data: Record<string, unknown> = {},
    rawParams: string[] = []
  ): Promise<TextObjectV2 | null> {
    if (!this.isObjectInRegistry(objectType)) return null;

    const ObjectClass: TextObjectClass =
      objectType === ButtonObject.type ? ButtonObject : PatchRuntimeTestObject;

    const context = new ObjectContext(nodeId, messageContext, ObjectClass.inlets, data);

    const object = new ObjectClass(nodeId, context);
    this.fakeObjectsById.set(nodeId, object);

    context.addMessageCallback((data, meta) => {
      object.onMessage?.(data, meta);
    });

    await object.create?.(rawParams);

    return object;
  }

  removeObjectById(nodeId: string): void {
    const object = this.fakeObjectsById.get(nodeId);
    if (!object) return;

    object.destroy?.();
    object.context.destroy();

    this.fakeObjectsById.delete(nodeId);
  }

  getObjectById(nodeId: string): TextObjectV2 | null {
    return this.fakeObjectsById.get(nodeId) ?? null;
  }
}

export const createFakeObjectService = () =>
  new FakeObjectService() as unknown as FakeObjectService & ObjectService;

class FakeAudioService {
  audioNode: AudioNodeV2 = { nodeId: 'object-audio-runtime-test', audioNode: null };
  removeNodeById = vi.fn<AudioService['removeNodeById']>();
  createNode = vi.fn<AudioService['createNode']>(() => Promise.resolve(this.audioNode));
  send = vi.fn<AudioService['send']>();
  getNodeById = vi.fn<AudioService['getNodeById']>(() => this.audioNode);
  updateEdges = vi.fn<AudioService['updateEdges']>();
}

export const createFakeAudioService = () =>
  new FakeAudioService() as FakeAudioService & AudioService;

export const createFakeRuntimeConnectionServices = () => ({
  glSystem: { updateEdges: vi.fn() } as unknown as GLSystem,
  audioAnalysisSystem: { updateEdges: vi.fn() },
  workerNodeSystem: { updateEdges: vi.fn() },
  mediaPipeNodeSystem: { updateEdges: vi.fn(), unregister: vi.fn() },
  directChannelService: { updateNodeTypes: vi.fn(), updateEdges: vi.fn() },
  workletDirectChannelService: { updateEdges: vi.fn() }
});

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

export const createFakeEventBus = (): PatchiesEventBus =>
  new FakeEventBus() as unknown as PatchiesEventBus;

export const objectNode = (id: string, data: Record<string, unknown>): Node => ({
  id,
  type: 'object',
  position: { x: 0, y: 0 },
  data
});

export const buttonNode = (id: string): Node => ({
  id,
  type: 'button',
  position: { x: 0, y: 0 },
  data: {}
});

export const toggleNode = (id: string, data: Record<string, unknown> = {}): Node => ({
  id,
  type: 'toggle',
  position: { x: 0, y: 0 },
  data
});

export const switchNode = (id: string, data: Record<string, unknown> = {}): Node => ({
  id,
  type: 'switch',
  position: { x: 0, y: 0 },
  data
});

export const textboxNode = (id: string, data: Record<string, unknown> = {}): Node => ({
  id,
  type: 'textbox',
  position: { x: 0, y: 0 },
  data
});

export const sliderNode = (id: string, data: Record<string, unknown> = {}): Node => ({
  id,
  type: 'slider',
  position: { x: 0, y: 0 },
  data
});

export const knobNode = (id: string, data: Record<string, unknown> = {}): Node => ({
  id,
  type: 'knob',
  position: { x: 0, y: 0 },
  data
});

export const tapTildeNode = (id: string, data: Record<string, unknown> = {}): Node => ({
  id,
  type: 'tap~',
  position: { x: 0, y: 0 },
  data
});

export const createFakeEditorRuntime = (overrides: Partial<EditorRuntime> = {}) => ({
  setGraph: vi.fn(() => Promise.resolve()),
  ...overrides
});
