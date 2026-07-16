import { logger } from '$lib/utils/logger';

import { RuntimeObjectResolver } from './RuntimeObjectResolver';
import {
  getRuntimeAudioObjectDescriptorKey,
  getRuntimeObjectDescriptorKey
} from '../utils/runtime-object-keys';

import type { RuntimeAudioObjectDescriptor } from '../types/audio-adapter';
import type { RuntimeObjectDescriptor, RuntimeObjectSpec } from '../types/runtime-object';

interface RuntimeObjectSnapshot {
  ids: Set<string>;
  descriptorKeys: Map<string, string>;
}

type NextRuntimeObjectSnapshot = RuntimeObjectSnapshot & { pendingIds: Set<string> };

export interface RuntimeObjectReconcilerRuntime {
  createMessageObject(descriptor: RuntimeObjectDescriptor): Promise<void>;
  updateMessageObject(nodeId: string, descriptor: RuntimeObjectDescriptor): Promise<void>;
  destroyMessageObject(nodeId: string): void;
  upsertAudioObject(descriptor: RuntimeAudioObjectDescriptor): void;
  destroyAudioObject(nodeId: string): void;
  getAudioObject(nodeId: string): unknown | null;
  consumeSuppressedAudioObjectSync(nodeId: string): boolean;
}

export class RuntimeObjectReconciler {
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

  constructor(
    private resolver: RuntimeObjectResolver,
    private runtime: RuntimeObjectReconcilerRuntime
  ) {}

  async reconcile(objects: RuntimeObjectSpec[]): Promise<void> {
    const nextObjectDescriptors = new Map<string, RuntimeObjectDescriptor>();
    const nextAudioDescriptors = new Map<string, RuntimeAudioObjectDescriptor>();
    const pendingRuntimeUpdates: Promise<void>[] = [];

    for (const object of objects) {
      const resolved = this.resolver.resolve(object);

      if (resolved.kind === 'audio') {
        nextAudioDescriptors.set(resolved.descriptor.id, resolved.descriptor);
        continue;
      }

      if (resolved.kind === 'message') {
        nextObjectDescriptors.set(resolved.descriptor.id, resolved.descriptor);
      }
    }

    this.next.ids = new Set(nextObjectDescriptors.keys());

    this.next.descriptorKeys = new Map(
      Array.from(nextObjectDescriptors).map(([nodeId, descriptor]) => [
        nodeId,
        getRuntimeObjectDescriptorKey(descriptor)
      ])
    );

    const trackedRuntimeObjectIds = new Set([...this.current.ids, ...this.next.pendingIds]);

    for (const nodeId of trackedRuntimeObjectIds) {
      if (!nextObjectDescriptors.has(nodeId)) {
        this.runtime.destroyMessageObject(nodeId);
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
          ? this.runtime.updateMessageObject(descriptor.id, descriptor)
          : this.runtime.createMessageObject(descriptor);

      pendingRuntimeUpdates.push(this.syncRuntimeObject(descriptor, descriptorKey, operation));
    }

    await Promise.all(pendingRuntimeUpdates);
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
