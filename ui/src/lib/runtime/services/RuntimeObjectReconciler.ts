import { logger } from '$lib/utils/logger';

import { RuntimeObjectResolver } from './RuntimeObjectResolver';
import { getRuntimeAudioObjectDescriptorKey, getObjectKey } from '../utils/runtime-object-keys';
import { createSerialQueue } from '../utils/serial-queue';

import type { RuntimeAudioObjectDescriptor } from '../types/audio-adapter';
import type { RuntimeObjectSpec } from '../types/runtime-object';

interface RuntimeObjectSnapshot {
  ids: Set<string>;
  objectKeys: Map<string, string>;
}

type NextRuntimeObjectSnapshot = RuntimeObjectSnapshot & { pendingIds: Set<string> };

export interface RuntimeObjectReconcilerRuntime {
  createMessageObject(object: RuntimeObjectSpec): Promise<void>;
  updateMessageObject(nodeId: string, object: RuntimeObjectSpec): Promise<void>;
  destroyMessageObject(nodeId: string): void;
  upsertAudioObject(descriptor: RuntimeAudioObjectDescriptor): void;
  destroyAudioObject(nodeId: string): void;
  getAudioObject(nodeId: string): unknown | null;
  consumeSuppressedAudioObjectSync(nodeId: string): boolean;
}

export class RuntimeObjectReconciler {
  private reconcileQueue = createSerialQueue();

  private current: RuntimeObjectSnapshot = {
    ids: new Set(),
    objectKeys: new Map()
  };

  private currentAudio: RuntimeObjectSnapshot = {
    ids: new Set(),
    objectKeys: new Map()
  };

  private next: NextRuntimeObjectSnapshot = {
    ids: new Set(),
    objectKeys: new Map(),
    pendingIds: new Set()
  };

  constructor(
    private resolver: RuntimeObjectResolver,
    private runtime: RuntimeObjectReconcilerRuntime
  ) {}

  /**
   * Reconcile a graph snapshot after any earlier reconciliation settles.
   *
   * Each operation reads and updates shared lifecycle state, so concurrent
   * reconciliations could otherwise destroy an object while its older async
   * creation is still in flight. A rejected operation is deliberately ignored
   * for queueing purposes so a later snapshot can still recover the runtime.
   */
  reconcile(objects: RuntimeObjectSpec[]): Promise<void> {
    return this.reconcileQueue.runSerialized(() => this.reconcileObjects(objects));
  }

  private async reconcileObjects(objects: RuntimeObjectSpec[]): Promise<void> {
    const nextMessageObjects = new Map<string, RuntimeObjectSpec>();
    const nextAudioDescriptors = new Map<string, RuntimeAudioObjectDescriptor>();

    const pendingRuntimeUpdates: Promise<void>[] = [];

    for (const object of objects) {
      const resolved = this.resolver.resolve(object);

      if (resolved.kind === 'audio') {
        nextAudioDescriptors.set(resolved.descriptor.id, resolved.descriptor);
        continue;
      }

      if (resolved.kind === 'message') {
        nextMessageObjects.set(resolved.object.id, resolved.object);
      }
    }

    this.next.ids = new Set(nextMessageObjects.keys());

    this.next.objectKeys = new Map(
      Array.from(nextMessageObjects).map(([nodeId, object]) => [nodeId, getObjectKey(object)])
    );

    const trackedRuntimeObjectIds = new Set([...this.current.ids, ...this.next.pendingIds]);

    for (const nodeId of trackedRuntimeObjectIds) {
      if (!nextMessageObjects.has(nodeId)) {
        this.runtime.destroyMessageObject(nodeId);
        this.current.ids.delete(nodeId);
        this.current.objectKeys.delete(nodeId);

        this.next.pendingIds.delete(nodeId);
      }
    }

    this.syncAudioObjects(nextAudioDescriptors);

    for (const object of nextMessageObjects.values()) {
      if (this.next.pendingIds.has(object.id)) continue;

      const objectKey = getObjectKey(object);
      const hasCommittedObject = this.current.ids.has(object.id);
      const lastSyncedObjectKey = this.current.objectKeys.get(object.id);

      if (hasCommittedObject && lastSyncedObjectKey === objectKey) continue;

      const operation = () =>
        hasCommittedObject
          ? this.runtime.updateMessageObject(object.id, object)
          : this.runtime.createMessageObject(object);

      pendingRuntimeUpdates.push(this.syncRuntimeObject(object, objectKey, operation));
    }

    await Promise.all(pendingRuntimeUpdates);
  }

  private syncAudioObjects(nextAudioDescriptors: Map<string, RuntimeAudioObjectDescriptor>): void {
    for (const nodeId of this.currentAudio.ids) {
      if (!nextAudioDescriptors.has(nodeId)) {
        this.runtime.destroyAudioObject(nodeId);
        this.currentAudio.ids.delete(nodeId);
        this.currentAudio.objectKeys.delete(nodeId);
      }
    }

    for (const descriptor of nextAudioDescriptors.values()) {
      const descriptorKey = getRuntimeAudioObjectDescriptorKey(descriptor);
      const hasCommittedAudioObject = this.currentAudio.ids.has(descriptor.id);
      const lastSyncedDescriptorKey = this.currentAudio.objectKeys.get(descriptor.id);

      if (
        hasCommittedAudioObject &&
        lastSyncedDescriptorKey === descriptorKey &&
        this.runtime.getAudioObject(descriptor.id)
      ) {
        continue;
      }

      if (this.runtime.consumeSuppressedAudioObjectSync(descriptor.id)) {
        if (hasCommittedAudioObject) {
          this.currentAudio.objectKeys.set(descriptor.id, descriptorKey);
        } else {
          this.currentAudio.objectKeys.delete(descriptor.id);
        }

        continue;
      }

      this.runtime.upsertAudioObject(descriptor);
      this.currentAudio.ids.add(descriptor.id);
      this.currentAudio.objectKeys.set(descriptor.id, descriptorKey);
    }
  }

  private async syncRuntimeObject(
    spec: RuntimeObjectSpec,
    objectKey: string,
    operation: () => Promise<void>
  ): Promise<void> {
    this.next.pendingIds.add(spec.id);

    try {
      await operation();

      if (this.next.objectKeys.get(spec.id) !== objectKey) return;

      this.current.ids.add(spec.id);
      this.current.objectKeys.set(spec.id, objectKey);
    } catch (error) {
      logger.warn(`failed to sync runtime object "${spec.id}"`, error);
    } finally {
      this.next.pendingIds.delete(spec.id);
    }
  }
}
