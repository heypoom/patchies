import type { Node } from '@xyflow/svelte';
import { hash } from 'ohash';
import { AudioRegistry } from '$lib/registry/AudioRegistry';
import type { TextObjectClass } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectInlet } from '$lib/objects/v2/object-metadata';
import { parseObjectParamFromString } from '$lib/objects/parse-object-param';
import { logger } from '$lib/utils/logger';

import type { RuntimeObjectDescriptor, RuntimeAudioObjectDescriptor } from './PatchRuntime';

interface EditorRuntimeObjectData {
  expr?: unknown;
  name?: unknown;
  params?: unknown;

  [key: string]: unknown;
}

interface RuntimeObjectSnapshot {
  ids: Set<string>;
  descriptorKeys: Map<string, string>;
}

type NextRuntimeObjectSnapshot = RuntimeObjectSnapshot & { pendingIds: Set<string> };

export interface EditorRuntime {
  isMessageObjectInRegistry(objectType: string): boolean;
  getMessageObjectClass(objectType: string): TextObjectClass | undefined;
  isAudioObjectInRegistry(objectType: string): boolean;
  createObject(descriptor: RuntimeObjectDescriptor): Promise<void>;
  updateObject(nodeId: string, descriptor: RuntimeObjectDescriptor): Promise<void>;
  destroyObject(nodeId: string): void;
  upsertAudioObject(descriptor: RuntimeAudioObjectDescriptor): void;
  destroyAudioObject(nodeId: string): void;
  getAudioObject(nodeId: string): unknown | null;
  consumeSuppressedAudioObjectSync(nodeId: string): boolean;
}

export class EditorRuntimeReconciler {
  private current: RuntimeObjectSnapshot = {
    ids: new Set(),
    descriptorKeys: new Map()
  };

  private currentAudio: RuntimeObjectSnapshot = {
    ids: new Set(),
    descriptorKeys: new Map()
  };

  private next: NextRuntimeObjectSnapshot = {
    ids: new Set(),
    descriptorKeys: new Map(),
    pendingIds: new Set()
  };

  constructor(private runtime: EditorRuntime) {}

  async reconcile(nodes: Node[]): Promise<void> {
    const nextObjectDescriptors = new Map<string, RuntimeObjectDescriptor>();
    const nextAudioDescriptors = new Map<string, RuntimeAudioObjectDescriptor>();
    const pendingRuntimeUpdates: Promise<void>[] = [];

    for (const node of nodes) {
      const audioDescriptor = this.getRuntimeAudioObjectDescriptorFromEditorNode(node);

      if (audioDescriptor) {
        nextAudioDescriptors.set(audioDescriptor.id, audioDescriptor);
        continue;
      }

      const descriptor = this.getRuntimeObjectDescriptor(node);
      if (!descriptor) continue;

      nextObjectDescriptors.set(descriptor.id, descriptor);
    }

    this.next.ids = new Set(nextObjectDescriptors.keys());

    this.next.descriptorKeys = new Map(
      [...nextObjectDescriptors].map(([nodeId, descriptor]) => [
        nodeId,
        getRuntimeObjectDescriptorKey(descriptor)
      ])
    );

    const trackedRuntimeObjectIds = new Set([...this.current.ids, ...this.next.pendingIds]);

    for (const nodeId of trackedRuntimeObjectIds) {
      if (!nextObjectDescriptors.has(nodeId)) {
        this.runtime.destroyObject(nodeId);
        this.current.ids.delete(nodeId);
        this.current.descriptorKeys.delete(nodeId);

        this.next.pendingIds.delete(nodeId);
      }
    }

    this.syncAudioObjects(nextAudioDescriptors);

    for (const descriptor of nextObjectDescriptors.values()) {
      if (this.next.pendingIds.has(descriptor.id)) continue;

      const descriptorKey = getRuntimeObjectDescriptorKey(descriptor);
      const hasCommittedObject = this.current.ids.has(descriptor.id);
      const lastSyncedDescriptorKey = this.current.descriptorKeys.get(descriptor.id);

      if (hasCommittedObject && lastSyncedDescriptorKey === descriptorKey) continue;

      const operation = () =>
        hasCommittedObject
          ? this.runtime.updateObject(descriptor.id, descriptor)
          : this.runtime.createObject(descriptor);

      pendingRuntimeUpdates.push(this.syncRuntimeObject(descriptor, descriptorKey, operation));
    }

    await Promise.all(pendingRuntimeUpdates);
  }

  private getRuntimeObjectDescriptor(node: Node): RuntimeObjectDescriptor | null {
    const objectType = getRuntimeObjectType(node);
    if (!objectType || !this.runtime.isMessageObjectInRegistry(objectType)) return null;

    const data = node.data as EditorRuntimeObjectData | undefined;
    const objectClass = this.runtime.getMessageObjectClass(objectType);
    if (!objectClass) return null;

    return getRuntimeObjectDescriptorFromNode(node.id, objectType, data);
  }

  private getRuntimeAudioObjectDescriptorFromEditorNode(
    node: Node
  ): RuntimeAudioObjectDescriptor | null {
    const objectType = getRuntimeObjectType(node);
    if (!objectType || !this.runtime.isAudioObjectInRegistry(objectType)) return null;

    const data = node.data as EditorRuntimeObjectData | undefined;

    if (node.type === 'object') {
      return {
        id: node.id,
        objectType,
        params: getRuntimeObjectParamsFromNode(objectType, data)
      };
    }

    const nodeClass = AudioRegistry.getInstance().get(objectType);
    if (!nodeClass) return null;
    if (!nodeClass.runtimeManaged) return null;

    return {
      id: node.id,
      objectType,
      params: getAudioParamsFromNodeData(nodeClass.inlets ?? [], node.data)
    };
  }

  private syncAudioObjects(nextAudioDescriptors: Map<string, RuntimeAudioObjectDescriptor>): void {
    for (const nodeId of this.currentAudio.ids) {
      if (!nextAudioDescriptors.has(nodeId)) {
        this.runtime.destroyAudioObject(nodeId);
        this.currentAudio.ids.delete(nodeId);
        this.currentAudio.descriptorKeys.delete(nodeId);
      }
    }

    for (const descriptor of nextAudioDescriptors.values()) {
      const descriptorKey = getRuntimeAudioObjectDescriptorKey(descriptor);
      const hasCommittedAudioObject = this.currentAudio.ids.has(descriptor.id);
      const lastSyncedDescriptorKey = this.currentAudio.descriptorKeys.get(descriptor.id);

      if (
        hasCommittedAudioObject &&
        lastSyncedDescriptorKey === descriptorKey &&
        this.runtime.getAudioObject(descriptor.id)
      ) {
        continue;
      }

      if (this.runtime.consumeSuppressedAudioObjectSync(descriptor.id)) {
        if (hasCommittedAudioObject) {
          this.currentAudio.descriptorKeys.set(descriptor.id, descriptorKey);
        } else {
          this.currentAudio.descriptorKeys.delete(descriptor.id);
        }

        continue;
      }

      this.runtime.upsertAudioObject(descriptor);
      this.currentAudio.ids.add(descriptor.id);
      this.currentAudio.descriptorKeys.set(descriptor.id, descriptorKey);
    }
  }

  private async syncRuntimeObject(
    descriptor: RuntimeObjectDescriptor,
    descriptorKey: string,
    operation: () => Promise<void>
  ): Promise<void> {
    this.next.pendingIds.add(descriptor.id);

    try {
      await operation();

      if (this.next.descriptorKeys.get(descriptor.id) !== descriptorKey) return;

      this.current.ids.add(descriptor.id);
      this.current.descriptorKeys.set(descriptor.id, descriptorKey);
    } catch (error) {
      logger.warn(`failed to sync runtime object "${descriptor.id}"`, error);
    } finally {
      this.next.pendingIds.delete(descriptor.id);
    }
  }
}

const getRuntimeObjectDescriptorKey = (descriptor: RuntimeObjectDescriptor): string =>
  hash([descriptor.objectType, descriptor.data, descriptor.rawParams]);

const getRuntimeAudioObjectDescriptorKey = (descriptor: RuntimeAudioObjectDescriptor): string =>
  hash([descriptor.objectType, descriptor.params]);

function getRuntimeObjectType(node: Node): string {
  // Text object types are stored in `data.name`
  if (node.type === 'object') {
    const data = node.data as EditorRuntimeObjectData | undefined;

    return typeof data?.name === 'string' ? data.name : '';
  }

  return node.type ?? '';
}

function getRuntimeObjectDescriptorFromNode(
  nodeId: string,
  objectType: string,
  data?: EditorRuntimeObjectData
) {
  const rawParams = getRawObjectParamsFromExpr(data?.expr);

  const runtimeData =
    data?.name === objectType ? getTextObjectData(objectType, data, rawParams) : { ...data };

  return { id: nodeId, objectType, data: runtimeData, rawParams };
}

function getTextObjectData(
  objectType: string,
  data: EditorRuntimeObjectData | undefined,
  rawParams: string[]
): Record<string, unknown> {
  const params = getRuntimeObjectParamsFromNode(objectType, data, rawParams);

  return {
    expr: typeof data?.expr === 'string' ? data.expr : '',
    name: objectType,
    params
  };
}

function getRuntimeObjectParamsFromNode(
  objectType: string,
  data?: EditorRuntimeObjectData,
  rawParams = getRawObjectParamsFromExpr(data?.expr)
): unknown[] {
  const expectedParams = parseObjectParamFromString(objectType, rawParams);
  const hasSavedParams = Array.isArray(data?.params);
  const savedParams: unknown[] = hasSavedParams ? (data.params as unknown[]) : [];

  return hasSavedParams && savedParams.length === expectedParams.length
    ? savedParams
    : expectedParams;
}

function getRawObjectParamsFromExpr(expr: unknown): string[] {
  if (typeof expr !== 'string') return [];

  const trimmed = expr.trim();
  if (!trimmed) return [];

  return trimmed.split(/\s+/).slice(1);
}

function getAudioParamsFromNodeData(
  inlets: ObjectInlet[],
  data: Record<string, unknown> | undefined
): unknown[] {
  return inlets.map((inlet) => {
    if (inlet.type === 'signal' && !inlet.acceptsFloat && !inlet.messages?.length) {
      return null;
    }

    if (inlet.name && data && data[inlet.name] !== undefined) {
      return data[inlet.name];
    }

    return inlet.defaultValue ?? null;
  });
}
