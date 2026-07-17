import type { Edge } from '@xyflow/svelte';

import type { AudioService } from '$lib/audio/v2/AudioService';
import type { AudioNodeV2 } from '$lib/audio/v2/interfaces/audio-nodes';

import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import type { MessageCallbackFn } from '$lib/messages/MessageSystem';

import type { ObjectService } from '$lib/objects/v2/ObjectService';
import type { TextObjectClass } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectMetadata } from '$lib/objects/v2/object-metadata';

import { AudioAdapter } from '../adapters/AudioAdapter';
import { MessageAdapter } from '../adapters/MessageAdapter';

import { PatchGraph } from './PatchGraph';
import { RuntimeObjectReconciler } from './RuntimeObjectReconciler';
import { RuntimeObjectResolver } from './RuntimeObjectResolver';

import type { RuntimeAudioObjectDescriptor } from '../types/audio-adapter';

import type {
  RuntimeConnectionSpec,
  RuntimeGraphSpec,
  RuntimeObjectPorts,
  RuntimeObjectSpec,
  RuntimeObjectDescriptor,
  RuntimeObjectViewRevisionListener
} from '../types/runtime-object';

type RuntimeObjectDescriptorOrSpec = RuntimeObjectDescriptor | RuntimeObjectSpec;

interface PatchRuntimeOptions {
  audioService: AudioService;
  objectService: ObjectService;

  isAudioObject?: (objectType: string) => boolean;

  onObjectParamsChange?: (nodeId: string, params: unknown[]) => void;
  onObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;
  onAudioObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;
}

export class PatchRuntime {
  private graph = new PatchGraph();

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

  async setGraph(graph: RuntimeGraphSpec): Promise<void> {
    this.graph.setGraph(graph);
    await this.syncObjects();
    this.syncConnections();
  }

  getGraph(): RuntimeGraphSpec {
    return this.graph.getGraph();
  }

  async createObject(descriptor: RuntimeObjectDescriptorOrSpec): Promise<void> {
    const spec = transformObjectDescriptionToSpec(descriptor);
    this.graph.upsertObject(spec);

    if ('objectType' in descriptor) {
      await this.message.createObject(descriptor);
      return;
    }

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
    const spec = { ...transformObjectDescriptionToSpec(descriptor), id: nodeId };
    this.graph.upsertObject(spec);

    if ('objectType' in descriptor) {
      await this.message.updateObject(nodeId, descriptor);
      return;
    }

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
    this.graph.removeObject(nodeId);
    this.message.destroyObject(nodeId);
    this.destroyAudioObject(nodeId);
    this.syncConnections();
  }

  connect(connection: RuntimeConnectionSpec): string {
    const connectionId = this.graph.upsertConnection(connection);
    this.syncConnections();

    return connectionId;
  }

  disconnect(connectionId: string): void {
    this.graph.removeConnection(connectionId);
    this.syncConnections();
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

  private async syncObjects(): Promise<void> {
    await this.objectReconciler.reconcile(this.graph.getObjects());
  }

  private syncConnections(): void {
    const edges = this.graph.getConnections().map(getEditorEdgeFromRuntimeConnection);

    this.message.updateConnections(edges);
    this.audio.updateConnections(edges);
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

const getEditorEdgeFromRuntimeConnection = (
  connection: RuntimeConnectionSpec & { id: string }
): Edge => ({
  id: connection.id,
  source: connection.source,
  sourceHandle: connection.outlet,
  target: connection.target,
  targetHandle: connection.inlet
});
