import type { Node } from '@xyflow/svelte';
import { vi } from 'vitest';
import type { AudioNodeV2 } from '$lib/audio/v2/interfaces/audio-nodes';
import type { MessageContext } from '$lib/messages/MessageContext';
import { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { TextObjectClass, TextObjectV2 } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { ButtonObject } from '$objects/button/ButtonObject';

import type { EditorRuntime } from './EditorRuntimeReconciler';
import type { RuntimeObjectService } from './PatchMessageRuntime';

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

export class FakeObjectService implements RuntimeObjectService {
  private objectsById = new Map<string, TextObjectV2>();

  isObjectInRegistry(objectType: string): boolean {
    return objectType === TEST_OBJECT_TYPE || objectType === ButtonObject.type;
  }

  async createObject(
    nodeId: string,
    objectType: string,
    messageContext: MessageContext,
    params: unknown[] = [],
    rawParams: string[] = []
  ): Promise<TextObjectV2 | null> {
    if (!this.isObjectInRegistry(objectType)) return null;

    const ObjectClass: TextObjectClass =
      objectType === ButtonObject.type ? ButtonObject : PatchRuntimeTestObject;
    const context = new ObjectContext(nodeId, messageContext, ObjectClass.inlets);
    context.initParams(params);

    const object = new ObjectClass(nodeId, context);
    this.objectsById.set(nodeId, object);
    context.addMessageCallback((data, meta) => {
      object.onMessage?.(data, meta);
    });

    await object.create?.(rawParams);

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

export class FakeAudioService {
  removeNodeById = vi.fn();
  createNode = vi.fn(() => Promise.resolve(this.audioNode));
  send = vi.fn();

  audioNode: AudioNodeV2 = {
    nodeId: 'object-audio-runtime-test',
    audioNode: null
  };

  getNodeById = vi.fn<() => AudioNodeV2 | null>(() => this.audioNode);
}

export class FakeEventBus {
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
  isMessageObjectInRegistry: vi.fn(
    (objectType: string) =>
      objectType === TEST_OBJECT_TYPE ||
      objectType === 'button' ||
      objectType === 'knob' ||
      objectType === 'slider' ||
      objectType === 'switch' ||
      objectType === 'textbox' ||
      objectType === 'toggle'
  ),
  isAudioObjectInRegistry: vi.fn(() => false),
  createObject: vi.fn(),
  updateObject: vi.fn(),
  destroyObject: vi.fn(),
  upsertAudioObject: vi.fn(),
  destroyAudioObject: vi.fn(),
  getAudioObject: vi.fn(() => null),
  consumeSuppressedAudioObjectSync: vi.fn(() => false),
  ...overrides
});
