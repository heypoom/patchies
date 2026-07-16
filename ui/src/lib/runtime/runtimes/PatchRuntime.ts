import type { AudioNodeV2 } from '$lib/audio/v2/interfaces/audio-nodes';
import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
import type { TextObjectClass } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectMetadata } from '$lib/objects/v2/object-metadata';

import { MessageRuntime } from './MessageRuntime';
import { AudioRuntime } from './AudioRuntime';

import { RuntimeObjectReconciler } from '../services/RuntimeObjectReconciler';
import { RuntimeObjectResolver } from '../services/RuntimeObjectResolver';

import type {
  RuntimeAudioObjectDescriptor,
  RuntimeAudioObjectService
} from '../types/audio-adapter';

import type {
  RuntimeObjectDescriptor,
  RuntimeGraphSpec,
  RuntimeObjectPorts,
  RuntimeObjectService,
  RuntimeObjectSpec,
  RuntimeObjectViewRevisionListener
} from '../types/runtime-object';
import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';

interface PatchRuntimeOptions {
  objectService: RuntimeObjectService;
  audioService: RuntimeAudioObjectService;

  isAudioObject?: (objectType: string) => boolean;

  onObjectParamsChange?: (nodeId: string, params: unknown[]) => void;
  onObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;
  onAudioObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;
}

type RuntimeObjectInput = RuntimeObjectDescriptor | RuntimeObjectSpec;

export class PatchRuntime {
  private message: MessageRuntime;
  private audio: AudioRuntime;
  private objectResolver: RuntimeObjectResolver;
  private objectReconciler: RuntimeObjectReconciler;

  constructor(options: PatchRuntimeOptions) {
    this.message = new MessageRuntime({
      objectService: options.objectService,
      onObjectParamsChange: options.onObjectParamsChange,
      onObjectDataChange: options.onObjectDataChange,
      eventBus: PatchiesEventBus.getInstance()
    });

    this.audio = new AudioRuntime({
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

  async createObject(object: RuntimeObjectInput): Promise<void> {
    if ('objectType' in object) {
      await this.message.createObject(object);
      return;
    }

    const spec = normalizeRuntimeObjectSpec(object);
    const resolved = this.objectResolver.resolve(spec);

    if (resolved.kind === 'audio') {
      this.upsertAudioObject(resolved.descriptor);
      return;
    }

    if (resolved.kind === 'message') {
      await this.message.createObject(resolved.descriptor);
    }
  }

  async updateObject(nodeId: string, object: RuntimeObjectInput): Promise<void> {
    if ('objectType' in object) {
      await this.message.updateObject(nodeId, object);
      return;
    }

    const spec = normalizeRuntimeObjectSpec(object);
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

function normalizeRuntimeObjectSpec(object: RuntimeObjectInput): RuntimeObjectSpec {
  if ('type' in object) return object;

  return {
    id: object.id,
    type: object.objectType,
    data: object.data
  };
}
