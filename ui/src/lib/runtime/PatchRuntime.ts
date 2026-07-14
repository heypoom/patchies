import type { AudioNodeV2 } from '$lib/audio/v2/interfaces/audio-nodes';
import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
import type { TextObjectClass } from '$lib/objects/v2/interfaces/text-objects';
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
  type RuntimeObjectDescriptor,
  type RuntimeObjectViewRevisionListener
} from './PatchMessageRuntime';

export type {
  RuntimeAudioObjectService,
  RuntimeAudioObjectDescriptor
} from './RuntimeAudioObjectAdapter';

export type {
  RuntimeObjectService as PatchRuntimeObjectService,
  RuntimeObjectDescriptor
} from './PatchMessageRuntime';

export type PatchRuntimeOptions = {
  objectService: RuntimeObjectService;
  audioService: RuntimeAudioObjectService;
  isAudioObject?: (objectType: string) => boolean;
  onObjectParamsChange?: (nodeId: string, params: unknown[]) => void;
  onObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;
  onAudioObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;
};

export class PatchRuntime {
  private message: PatchMessageRuntime;
  private audio: RuntimeAudioObjectAdapter;

  constructor(options: PatchRuntimeOptions) {
    this.message = new PatchMessageRuntime({
      objectService: options.objectService,
      onObjectParamsChange: options.onObjectParamsChange,
      onObjectDataChange: options.onObjectDataChange
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

  isMessageObjectInRegistry(objectType: string): boolean {
    return this.message.isObjectInRegistry(objectType);
  }

  getMessageObjectClass(objectType: string): TextObjectClass | undefined {
    return this.message.getObjectClass(objectType);
  }

  isAudioObjectInRegistry(objectType: string): boolean {
    return this.audio.isObjectInRegistry(objectType);
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
    return (
      this.message.subscribeObjectMessages(nodeId, callback) ??
      this.audio.subscribeAudioObjectMessages(nodeId, callback)
    );
  }

  getObjectPorts(
    nodeId: string,
    objectMeta: Pick<ObjectMetadata, 'inlets' | 'outlets'> | null | undefined
  ): RuntimeObjectPorts {
    return this.message.getObjectPorts(nodeId, objectMeta);
  }

  trackObjectViewRevision(nodeId: string): number {
    return (
      this.message.trackObjectViewRevision(nodeId) + this.audio.trackAudioObjectViewRevision(nodeId)
    );
  }

  subscribeObjectViewRevisions(listener: RuntimeObjectViewRevisionListener): () => void {
    const unsubscribeMessage = this.message.subscribeObjectViewRevisions(listener);
    const unsubscribeAudio = this.audio.subscribeAudioObjectViewRevisions(listener);

    return () => {
      unsubscribeMessage();
      unsubscribeAudio();
    };
  }

  suppressNextAudioObjectSync(nodeId: string): void {
    this.audio.suppressNextAudioObjectSync(nodeId);
  }

  consumeSuppressedAudioObjectSync(nodeId: string): boolean {
    return this.audio.consumeSuppressedAudioObjectSync(nodeId);
  }

  upsertAudioObject(descriptor: RuntimeAudioObjectDescriptor): void {
    this.audio.upsertAudioObject(descriptor);
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
