import type { AudioService } from '$lib/audio/v2/AudioService';
import type { AudioNodeV2 } from '$lib/audio/v2/interfaces/audio-nodes';

import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import type { MessageCallbackFn } from '$lib/messages/MessageSystem';

import type { TextObjectClass } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectMetadata } from '$lib/objects/v2/object-metadata';

import { AudioAdapter } from '../adapters/AudioAdapter';
import { MessageAdapter } from '../adapters/MessageAdapter';

import { RuntimeObjectReconciler } from './RuntimeObjectReconciler';
import { RuntimeObjectResolver } from './RuntimeObjectResolver';

import type { RuntimeAudioObjectDescriptor } from '../types/audio-adapter';

import type {
  RuntimeGraphSpec,
  RuntimeObjectPorts,
  RuntimeObjectService,
  RuntimeObjectSpec,
  RuntimeObjectDescriptor,
  RuntimeObjectViewRevisionListener
} from '../types/runtime-object';

type RuntimeObjectDescriptorOrSpec = RuntimeObjectDescriptor | RuntimeObjectSpec;

interface PatchRuntimeOptions {
  audioService: AudioService;
  objectService: RuntimeObjectService;

  isAudioObject?: (objectType: string) => boolean;

  onObjectParamsChange?: (nodeId: string, params: unknown[]) => void;
  onObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;
  onAudioObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;
}

export class PatchRuntime {
  private message: MessageAdapter;
  private audio: AudioAdapter;
  private objectResolver: RuntimeObjectResolver;
  private objectReconciler: RuntimeObjectReconciler;

  constructor(options: PatchRuntimeOptions) {
    this.message = new MessageAdapter({
      objectService: options.objectService,
      onObjectParamsChange: options.onObjectParamsChange,
      onObjectDataChange: options.onObjectDataChange,
      eventBus: PatchiesEventBus.getInstance()
    });

    this.audio = new AudioAdapter({
      audioService: options.audioService,
      isAudioObject: options.isAudioObject,
      onAudioObjectDataChange: options.onAudioObjectDataChange
    });

    this.objectResolver = new RuntimeObjectResolver({
      isMessageObject: (objectType) => this.message.isObjectInRegistry(objectType),
      isAudioObject: (objectType) => this.audio.isObjectInRegistry(objectType)
    });

    this.objectReconciler = new RuntimeObjectReconciler(this.objectResolver, {
      createMessageObject: (descriptor) => this.message.createObject(descriptor),
      updateMessageObject: (nodeId, descriptor) => this.message.updateObject(nodeId, descriptor),
      destroyMessageObject: (nodeId) => this.message.destroyObject(nodeId),
      upsertAudioObject: (descriptor) => this.upsertAudioObject(descriptor),
      destroyAudioObject: (nodeId) => this.destroyAudioObject(nodeId),
      getAudioObject: (nodeId) => this.getAudioObject(nodeId),
      consumeSuppressedAudioObjectSync: (nodeId) => this.consumeSuppressedAudioObjectSync(nodeId)
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

  async reconcileGraph(graph: RuntimeGraphSpec): Promise<void> {
    await this.reconcileObjects(graph.objects);
  }

  async reconcileObjects(objects: RuntimeObjectSpec[]): Promise<void> {
    await this.objectReconciler.reconcile(objects);
  }

  async createObject(descriptor: RuntimeObjectDescriptorOrSpec): Promise<void> {
    if ('objectType' in descriptor) {
      await this.message.createObject(descriptor);
      return;
    }

    const spec = transformObjectDescriptionToSpec(descriptor);
    const resolved = this.objectResolver.resolve(spec);

    if (resolved.kind === 'audio') {
      this.upsertAudioObject(resolved.descriptor);
      return;
    }

    if (resolved.kind === 'message') {
      await this.message.createObject(resolved.descriptor);
    }
  }

  async updateObject(nodeId: string, descriptor: RuntimeObjectDescriptorOrSpec): Promise<void> {
    if ('objectType' in descriptor) {
      await this.message.updateObject(nodeId, descriptor);
      return;
    }

    const spec = transformObjectDescriptionToSpec(descriptor);
    const resolved = this.objectResolver.resolve(spec);

    if (resolved.kind === 'audio') {
      this.upsertAudioObject(resolved.descriptor);
      return;
    }

    if (resolved.kind === 'message') {
      await this.message.updateObject(nodeId, resolved.descriptor);
    }
  }

  destroyObject(nodeId: string): void {
    this.message.destroyObject(nodeId);
    this.destroyAudioObject(nodeId);
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

function transformObjectDescriptionToSpec(
  descriptor: RuntimeObjectDescriptorOrSpec
): RuntimeObjectSpec {
  if ('type' in descriptor) return descriptor;

  return {
    id: descriptor.id,
    type: descriptor.objectType,
    data: descriptor.data
  };
}
