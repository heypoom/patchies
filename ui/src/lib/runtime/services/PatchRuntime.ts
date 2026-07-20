import type { Edge } from '@xyflow/svelte';

import type { AudioNodeV2 } from '$lib/audio';
import type { ProfilerCoordinator } from '$lib/profiler';
import type { ObjectMetadata, TextObjectClass } from '$lib/objects';
import type { MessageCallbackFn, MessageSystem } from '$lib/messages';

import { AudioAdapter } from '../adapters/AudioAdapter';
import { MessageAdapter } from '../adapters/MessageAdapter';

import { PatchGraph } from './PatchGraph';
import { RuntimeObjectResolver } from './RuntimeObjectResolver';
import { RuntimeObjectReconciler } from './RuntimeObjectReconciler';

import type { RuntimeAudioObjectDescriptor } from '../types/audio-adapter';

import type {
  RuntimeConnectionSpec,
  RuntimeGraphSpec,
  RuntimeObjectPorts,
  RuntimeObjectSpec,
  RuntimeObjectViewRevisionListener
} from '../types/runtime-object';

import type {
  PatchRuntimeOptions,
  RuntimeServices,
  RuntimeObjectDescriptorOrSpec
} from '../types/patch-runtime';

export class PatchRuntime {
  private graph = new PatchGraph();

  private message: MessageAdapter;
  private audio: AudioAdapter;
  private services: RuntimeServices;

  private messageSystem: MessageSystem;
  private profilerCoordinator: ProfilerCoordinator;

  private objectResolver: RuntimeObjectResolver;
  private objectReconciler: RuntimeObjectReconciler;
  private objectSync = Promise.resolve();

  constructor(options: PatchRuntimeOptions) {
    const { objectService, audioService, eventBus, messageSystem, profilerCoordinator } =
      options.services;

    this.message = new MessageAdapter({
      eventBus,
      messageSystem,
      objectService,
      onObjectParamsChange: options.onObjectParamsChange,
      onObjectDataChange: options.onObjectDataChange
    });

    this.audio = new AudioAdapter({
      audioService,
      isAudioObject: options.isAudioObject,
      onAudioObjectDataChange: options.onAudioObjectDataChange
    });

    this.services = options.services;
    this.messageSystem = messageSystem;
    this.profilerCoordinator = profilerCoordinator;

    this.objectResolver = new RuntimeObjectResolver({
      isMessageObject: (objectType) => this.message.objectService.isObjectInRegistry(objectType),
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
    return (
      this.message.objectService.isObjectInRegistry(objectType) ||
      this.audio.isObjectInRegistry(objectType)
    );
  }

  isMessageObjectInRegistry(objectType: string): boolean {
    return this.message.objectService.isObjectInRegistry(objectType);
  }

  getMessageObjectClass(objectType: string): TextObjectClass | undefined {
    return this.message.objectService.getObjectClass(objectType);
  }

  isAudioObjectInRegistry(objectType: string): boolean {
    return this.audio.isObjectInRegistry(objectType);
  }

  async setGraph(graph: RuntimeGraphSpec): Promise<void> {
    const { objectsChanged, connectionsChanged } = this.graph.setGraph(graph);

    await this.startObjectSync();

    if (objectsChanged) {
      this.syncNodeTypes();
    }

    if (connectionsChanged) {
      this.syncConnections();
    }
  }

  async setObjects(objects: RuntimeObjectSpec[]): Promise<void> {
    if (!this.graph.setObjects(objects)) return;

    await this.startObjectSync();
    this.syncNodeTypes();
  }

  async setConnections(connections: RuntimeConnectionSpec[]): Promise<void> {
    if (!this.graph.setConnections(connections)) return;

    await this.waitForObjectSync();
    this.syncConnections();
  }

  getGraph(): RuntimeGraphSpec {
    return this.graph.getGraph();
  }

  async createObject(descriptor: RuntimeObjectDescriptorOrSpec): Promise<void> {
    const spec = transformObjectDescriptionToSpec(descriptor);
    this.graph.upsertObject(spec);

    if ('objectType' in descriptor) {
      this.destroyAudioObject(descriptor.id);
      await this.message.createObject(descriptor);
      return;
    }

    this.removeOppositeRuntimeObject(spec);
    await this.startObjectSync();
  }

  async updateObject(nodeId: string, descriptor: RuntimeObjectDescriptorOrSpec): Promise<void> {
    const spec = { ...transformObjectDescriptionToSpec(descriptor), id: nodeId };
    this.graph.upsertObject(spec);

    if ('objectType' in descriptor) {
      this.destroyAudioObject(nodeId);
      await this.message.updateObject(nodeId, descriptor);
      return;
    }

    this.removeOppositeRuntimeObject(spec);
    await this.startObjectSync();
  }

  destroyObject(nodeId: string): void {
    this.graph.removeObject(nodeId);
    this.message.destroyObject(nodeId);
    this.destroyAudioObject(nodeId);
    this.syncConnections();
  }

  cleanupDeletedNodes(nodeIds: Iterable<string>): void {
    for (const nodeId of nodeIds) {
      this.messageSystem.unregisterNode(nodeId);
      this.audio.audioService.removeNodeById(nodeId);
      this.services.mediaPipeNodeSystem.unregister(nodeId);
      this.profilerCoordinator.unregister(nodeId);
    }
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

  refreshConnections(): void {
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
    this.audio.audioService.send(nodeId, key, message);
  }

  getAudioObject(nodeId: string): AudioNodeV2 | null {
    return this.audio.audioService.getNodeById(nodeId);
  }

  destroy(): void {
    this.message.destroy();
    this.audio.destroy();
  }

  private async syncObjects(): Promise<void> {
    await this.objectReconciler.reconcile(this.graph.getObjects());
  }

  private startObjectSync(): Promise<void> {
    const sync = this.objectSync.catch(() => undefined).then(() => this.syncObjects());
    this.objectSync = sync;

    return sync;
  }

  private async waitForObjectSync(): Promise<void> {
    let sync: Promise<void>;

    do {
      sync = this.objectSync;
      await sync;
    } while (sync !== this.objectSync);
  }

  private syncConnections(): void {
    const edges = this.graph.getConnections().map(getEditorEdgeFromRuntimeConnection);

    const {
      glSystem,
      audioAnalysisSystem,
      workerNodeSystem,
      mediaPipeNodeSystem,
      directChannelService,
      workletDirectChannelService
    } = this.services;

    this.message.updateEdges(edges);
    this.audio.audioService.updateEdges(edges);
    glSystem.updateEdges(edges);

    audioAnalysisSystem.updateEdges(edges);
    workerNodeSystem.updateEdges(edges);
    mediaPipeNodeSystem.updateEdges(edges);
    directChannelService.updateEdges(edges);
    workletDirectChannelService.updateEdges(edges);
  }

  private syncNodeTypes(): void {
    const nodeTypes = this.graph.getObjects().map(({ id, type }) => ({ id, type }));
    this.services.directChannelService.updateNodeTypes(nodeTypes);
  }

  private removeOppositeRuntimeObject(spec: RuntimeObjectSpec): void {
    const resolved = this.objectResolver.resolve(spec);

    if (resolved.kind === 'audio') {
      this.message.destroyObject(spec.id);
    } else if (resolved.kind === 'message') {
      this.destroyAudioObject(spec.id);
    }
  }
}

function transformObjectDescriptionToSpec(
  descriptor: RuntimeObjectDescriptorOrSpec
): RuntimeObjectSpec {
  if ('type' in descriptor) return descriptor;

  return { id: descriptor.id, type: descriptor.objectType, data: descriptor.data };
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
