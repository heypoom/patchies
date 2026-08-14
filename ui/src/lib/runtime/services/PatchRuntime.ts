import type { Edge } from '@xyflow/svelte';

import type { AudioNodeV2 } from '$lib/audio';
import type { PatchiesEventBus } from '$lib/eventbus';
import type { ProfilerCoordinator } from '$lib/profiler';
import type { ObjectMetadata, TextObjectClass } from '$lib/objects';
import type { MessageCallbackFn, MessageSystem } from '$lib/messages';

import { AudioAdapter } from '../adapters/AudioAdapter';
import { MessageAdapter } from '../adapters/MessageAdapter';

import { PatchGraph } from './PatchGraph';
import { GraphObserver } from './GraphObserver';
import { RuntimeObjectResolver } from './RuntimeObjectResolver';
import { RuntimeObjectReconciler } from './RuntimeObjectReconciler';
import { createSerialQueue } from '../utils/serial-queue';

import type {
  RuntimeConnectionSpec,
  RuntimeAudioObjectData,
  RuntimeGraphSpec,
  RuntimeObjectPorts,
  RuntimeObjectSpec,
  RuntimeObjectViewRevisionListener
} from '../types/runtime-object';
import type { GraphChangeCallback, GraphChangeQuery } from './GraphObserver';

import type { PatchRuntimeOptions, RuntimeServices } from '../types/patch-runtime';
import { getLibraryDependentNodeIds } from '$lib/js-runner/js-module-utils';

export class PatchRuntime {
  private graph = new PatchGraph();
  private graphObserver = new GraphObserver(() => this.graph.getGraph());

  private message: MessageAdapter;
  private audio: AudioAdapter;
  private services: RuntimeServices;
  private eventBus: PatchiesEventBus;

  private messageSystem: MessageSystem;
  private profilerCoordinator: ProfilerCoordinator;

  private objectResolver: RuntimeObjectResolver;
  private objectReconciler: RuntimeObjectReconciler;
  private objectSyncQueue = createSerialQueue();

  constructor(options: PatchRuntimeOptions) {
    const { objectService, audioService, eventBus, messageSystem, profilerCoordinator } =
      options.services;

    this.message = new MessageAdapter({
      eventBus,
      messageSystem,
      objectService,
      onObjectParamsChange: options.onObjectParamsChange,
      onObjectDataChange: options.onObjectDataChange,
      objectContextOptions: {
        subscribeGraph: (query, callback) => this.subscribeGraph(query, callback),
        rerunLibraryDependents: (sourceNodeId, libraryName) => {
          queueMicrotask(() => this.rerunLibraryDependents(sourceNodeId, libraryName));
        }
      }
    });

    this.audio = new AudioAdapter({
      audioService,
      isAudioObject: options.isAudioObject,
      onAudioObjectDataChange: options.onAudioObjectDataChange
    });

    this.services = options.services;
    this.eventBus = eventBus;
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
      upsertAudioObject: (object) => this.upsertAudioObject(object),
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
    const { objectsChanged, connectionsChanged, changedObjectIds, changedConnectionNodeIds } =
      this.graph.setGraph(graph);

    if (connectionsChanged) {
      this.syncMessageConnections();
    }

    await this.startObjectSync();

    if (objectsChanged) {
      this.syncNodeTypes();
    }

    if (connectionsChanged) {
      this.syncConnections();
    }

    if (objectsChanged || connectionsChanged) {
      this.graphObserver.notify({ changedObjectIds, changedConnectionNodeIds });
    }
  }

  async setObjects(objects: RuntimeObjectSpec[]): Promise<void> {
    const { changed, changedObjectIds } = this.graph.setObjects(objects);
    if (!changed) return;

    await this.startObjectSync();
    this.syncNodeTypes();
    this.graphObserver.notify({ changedObjectIds, changedConnectionNodeIds: new Set() });
  }

  async setConnections(connections: RuntimeConnectionSpec[]): Promise<void> {
    const { changed, changedConnectionNodeIds } = this.graph.setConnections(connections);
    if (!changed) return;

    await this.waitForObjectSync();

    this.syncConnections();
    this.graphObserver.notify({ changedObjectIds: new Set(), changedConnectionNodeIds });
  }

  getGraph(): RuntimeGraphSpec {
    return this.graph.getGraph();
  }

  /**
   * Add one object through the public runtime API.
   *
   * All public object changes use graph specs, so the reconciler is the single
   * owner of message/audio lifecycle selection and transitions.
   */
  async createObject(spec: RuntimeObjectSpec): Promise<void> {
    this.graph.upsertObject(spec);

    await this.startObjectSync();
    this.syncNodeTypes();
    this.graphObserver.notify({
      changedObjectIds: new Set([spec.id]),
      changedConnectionNodeIds: new Set()
    });
  }

  /**
   * Update one object through the public runtime API.
   *
   * The id argument identifies the existing graph entry; its type and data are
   * taken from the new graph spec and reconciled with the current runtime.
   */
  async updateObject(nodeId: string, spec: RuntimeObjectSpec): Promise<void> {
    this.graph.upsertObject({ ...spec, id: nodeId });

    await this.startObjectSync();
    this.syncNodeTypes();
    this.graphObserver.notify({
      changedObjectIds: new Set([nodeId]),
      changedConnectionNodeIds: new Set()
    });
  }

  destroyObject(nodeId: string): void {
    this.graph.removeObject(nodeId);
    this.message.destroyObject(nodeId);
    this.destroyAudioObject(nodeId);
    this.syncNodeTypes();
    this.syncConnections();
    this.graphObserver.notify({
      changedObjectIds: new Set([nodeId]),
      changedConnectionNodeIds: new Set()
    });
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
    this.graphObserver.notify({
      changedObjectIds: new Set(),
      changedConnectionNodeIds: new Set([connection.source, connection.target])
    });

    return connectionId;
  }

  disconnect(connectionId: string): void {
    const connection = this.graph.getConnections().find(({ id }) => id === connectionId);
    this.graph.removeConnection(connectionId);
    this.syncConnections();
    this.graphObserver.notify({
      changedObjectIds: new Set(),
      changedConnectionNodeIds: connection
        ? new Set([connection.source, connection.target])
        : new Set()
    });
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

  subscribeGraph(query: GraphChangeQuery, callback: GraphChangeCallback): () => void {
    return this.graphObserver.subscribe(query, callback);
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

  upsertAudioObject(object: RuntimeObjectSpec<RuntimeAudioObjectData>): void {
    this.audio.upsertAudioObject(object);
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
    this.graphObserver.destroy();
    this.message.destroy();
    this.audio.destroy();
  }

  private async syncObjects(): Promise<void> {
    await this.objectReconciler.reconcile(this.graph.getObjects());
  }

  /**
   * Queue graph reconciliation after the prior attempt settles.
   *
   * A failed sync must not prevent a later editor update from applying, and
   * serializing here prevents older async object creation from racing newer
   * graph state.
   */
  private startObjectSync(): Promise<void> {
    return this.objectSyncQueue.runSerialized(() => this.syncObjects());
  }

  private async waitForObjectSync(): Promise<void> {
    let sync: Promise<void>;

    do {
      sync = this.objectSyncQueue.current;
      await sync;
    } while (sync !== this.objectSyncQueue.current);
  }

  private async rerunLibraryDependents(sourceNodeId: string, libraryName: string): Promise<void> {
    const dependentNodeIds = getLibraryDependentNodeIds(
      this.graph.getObjects(),
      libraryName,
      sourceNodeId
    );

    const changedObjectIds = new Set<string>();

    for (const nodeId of dependentNodeIds) {
      if (await this.message.runObjectAsLibraryDependent(nodeId)) continue;

      const object = this.graph.getObjects().find(({ id }) => id === nodeId);
      if (!object) continue;

      const executeCode =
        (typeof object.data.executeCode === 'number' ? object.data.executeCode : 0) + 1;

      const updates = { executeCode };

      this.graph.upsertObject({
        ...object,
        data: {
          ...object.data,
          ...updates
        }
      });

      changedObjectIds.add(nodeId);

      this.eventBus.dispatch({
        type: 'objectDataChanged',
        nodeId,
        data: { ...object.data, ...updates },
        updates
      });
    }

    await this.startObjectSync();
    this.syncNodeTypes();

    if (changedObjectIds.size > 0) {
      this.graphObserver.notify({
        changedObjectIds,
        changedConnectionNodeIds: new Set()
      });
    }
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

    this.syncMessageConnections();
    this.audio.audioService.updateEdges(edges);
    glSystem.updateEdges(edges);

    audioAnalysisSystem.updateEdges(edges);
    workerNodeSystem.updateEdges(edges);
    mediaPipeNodeSystem.updateEdges(edges);
    directChannelService.updateEdges(edges);
    workletDirectChannelService.updateEdges(edges);
  }

  private syncMessageConnections(): void {
    this.message.updateEdges(this.graph.getConnections().map(getEditorEdgeFromRuntimeConnection));
  }

  private syncNodeTypes(): void {
    const nodeTypes = this.graph.getObjects().map(({ id, type }) => ({ id, type }));

    this.services.directChannelService.updateNodeTypes(nodeTypes);
  }
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
