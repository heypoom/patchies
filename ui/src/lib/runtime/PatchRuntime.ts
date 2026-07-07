import type { AudioNodeV2 } from '$lib/audio/v2/interfaces/audio-nodes';
import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
import type { ObjectMetadata } from '$lib/objects/v2/object-metadata';

import {
  RuntimeAudioObjectAdapter,
  type RuntimeAudioObjectService,
  type RuntimeAudioObjectDescriptor
} from './RuntimeAudioObjectAdapter';

import {
  PatchMessageRuntime,
  type RuntimeObjectPorts,
  type RuntimeObjectService,
  type RuntimeObjectDescriptor
} from './PatchMessageRuntime';

export type {
  RuntimeAudioObjectService,
  RuntimeAudioObjectDescriptor
} from './RuntimeAudioObjectAdapter';
export type {
  RuntimeObjectService as PatchRuntimeObjectService,
  RuntimeObjectDescriptor as RuntimeObjectDescriptor
} from './PatchMessageRuntime';

export type PatchRuntimeOptions = {
  objectService: RuntimeObjectService;
  audioService?: RuntimeAudioObjectService;
  isAudioObject?: (objectType: string) => boolean;
  onObjectParamsChange?: (nodeId: string, params: unknown[]) => void;
  onAudioObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;
};

export class PatchRuntime {
  private message: PatchMessageRuntime;
  private audio: RuntimeAudioObjectAdapter;

  constructor(options: PatchRuntimeOptions) {
    this.message = new PatchMessageRuntime({
      objectService: options.objectService,
      onObjectParamsChange: options.onObjectParamsChange
    });

    this.audio = new RuntimeAudioObjectAdapter({
      audioService: options.audioService,
      isAudioObject: options.isAudioObject,
      onAudioObjectDataChange: options.onAudioObjectDataChange
    });
  }

  isObjectInRegistry(objectType: string): boolean {
    return this.message.isObjectInRegistry(objectType) || this.audio.isObjectInRegistry(objectType);
  }

  async createObject(descriptor: RuntimeObjectDescriptor): Promise<void> {
    await this.message.createObject(descriptor);
  }

  async updateObject(nodeId: string, descriptor: RuntimeObjectDescriptor): Promise<void> {
    await this.message.updateObject(nodeId, descriptor);
  }

  destroyObject(nodeId: string): void {
    this.message.destroyObject(nodeId);
  }

  subscribeObjectMessages(nodeId: string, callback: MessageCallbackFn): (() => void) | null {
    return this.message.subscribeObjectMessages(nodeId, callback);
  }

  getObjectPorts(
    nodeId: string,
    objectMeta: Pick<ObjectMetadata, 'inlets' | 'outlets'> | null | undefined
  ): RuntimeObjectPorts {
    return this.message.getObjectPorts(nodeId, objectMeta);
  }

  trackObjectViewRevision(nodeId: string): number {
    return this.message.trackObjectViewRevision(nodeId);
  }

  syncAudioObject(descriptor: RuntimeAudioObjectDescriptor): boolean {
    return this.audio.syncAudioObject(descriptor);
  }

  syncRuntimeManagedAudioNodes(descriptors: Iterable<RuntimeAudioObjectDescriptor>): void {
    this.audio.syncRuntimeManagedAudioNodes(descriptors);
  }

  suppressNextAudioObjectSync(nodeId: string): void {
    this.audio.suppressNextAudioObjectSync(nodeId);
  }

  createOrUpdateAudioObject(descriptor: RuntimeAudioObjectDescriptor): void {
    this.audio.createOrUpdateAudioObject(descriptor);
  }

  destroyAudioObject(nodeId: string): void {
    this.audio.destroyAudioObject(nodeId);
  }

  sendAudioObjectMessage(nodeId: string, key: string, message: unknown): void {
    this.audio.sendAudioObjectMessage(nodeId, key, message);
  }

  getAudioObject(nodeId: string): AudioNodeV2 | null {
    return this.audio.getAudioObject(nodeId);
  }

  destroy(): void {
    this.message.destroy();
    this.audio.destroy();
  }
}
