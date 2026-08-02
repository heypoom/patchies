import { logger } from '$lib/utils/logger';

import { RuntimeObjectResolver } from './RuntimeObjectResolver';
import { getRuntimeAudioObjectKey, getObjectKey } from '../utils/runtime-object-keys';
import { createSerialQueue } from '../utils/serial-queue';

import type { RuntimeAudioObjectData, RuntimeObjectSpec } from '../types/runtime-object';

interface RuntimeObjectSnapshot {
  ids: Set<string>;
  objectKeys: Map<string, string>;
}

type NextRuntimeObjectSnapshot = RuntimeObjectSnapshot & { pendingIds: Set<string> };

export interface RuntimeObjectReconcilerRuntime {
  createMessageObject(object: RuntimeObjectSpec): Promise<void>;
  updateMessageObject(nodeId: string, object: RuntimeObjectSpec): Promise<void>;
  destroyMessageObject(nodeId: string): void;
  upsertAudioObject(object: RuntimeObjectSpec<RuntimeAudioObjectData>): void;
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
    const nextAudioObjects = new Map<string, RuntimeObjectSpec<RuntimeAudioObjectData>>();

    const pendingRuntimeUpdates: Promise<void>[] = [];

    for (const object of objects) {
      const resolved = this.resolver.resolve(object);

      if (resolved.kind === 'audio') {
        nextAudioObjects.set(resolved.object.id, resolved.object);
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

    this.syncAudioObjects(nextAudioObjects);

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

  private syncAudioObjects(
    nextAudioObjects: Map<string, RuntimeObjectSpec<RuntimeAudioObjectData>>
  ): void {
    for (const nodeId of this.currentAudio.ids) {
      if (!nextAudioObjects.has(nodeId)) {
        this.runtime.destroyAudioObject(nodeId);
        this.currentAudio.ids.delete(nodeId);
        this.currentAudio.objectKeys.delete(nodeId);
      }
    }

    for (const object of nextAudioObjects.values()) {
      const objectKey = getRuntimeAudioObjectKey(object);
      const hasCommittedAudioObject = this.currentAudio.ids.has(object.id);
      const lastSyncedObjectKey = this.currentAudio.objectKeys.get(object.id);

      if (
        hasCommittedAudioObject &&
        lastSyncedObjectKey === objectKey &&
        this.runtime.getAudioObject(object.id)
      ) {
        continue;
      }

      if (this.runtime.consumeSuppressedAudioObjectSync(object.id)) {
        if (hasCommittedAudioObject) {
          this.currentAudio.objectKeys.set(object.id, objectKey);
        } else {
          this.currentAudio.objectKeys.delete(object.id);
        }

        continue;
      }

      this.runtime.upsertAudioObject(object);
      this.currentAudio.ids.add(object.id);
      this.currentAudio.objectKeys.set(object.id, objectKey);
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
