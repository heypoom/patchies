import type { Edge } from '@xyflow/svelte';

import type { AudioService, AudioNodeClass, AudioNodeV2 } from '$lib/audio';

import { MessageContext } from '$lib/messages/MessageContext';
import type { MessageCallbackFn } from '$lib/messages/MessageSystem';

import { AudioRegistry } from '$lib/registry/AudioRegistry';
import { validateMessageToObject } from '$lib/objects/validate-object-message';

import { RuntimeViewRevisionTracker } from '../services/RuntimeViewRevisionTracker';

import type { RuntimeAudioObjectDescriptor } from '../types/audio-adapter';

import type { RuntimeObjectViewRevisionListener } from '../types/runtime-object';

interface AudioAdapterOptions {
  audioService: AudioService;

  isAudioObject?: (objectType: string) => boolean;
  onAudioObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;
}

type RuntimeAudioObjectEntry = { messageContext: MessageContext };

export class AudioAdapter {
  private audioService: AudioService;

  private isAudioObject: (objectType: string) => boolean;
  private onAudioObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;

  /** Runtime-owned audio objects and their message contexts. */
  private audioObjects = new Map<string, RuntimeAudioObjectEntry>();

  /** Node ids whose next editor-state sync should be ignored because runtime messaging already applied it. */
  private suppressedAudioObjectSyncs = new Set<string>();

  private viewRevisions = new RuntimeViewRevisionTracker();

  constructor(options: AudioAdapterOptions) {
    this.audioService = options.audioService;

    this.isAudioObject =
      options.isAudioObject ?? ((objectType) => AudioRegistry.getInstance().isDefined(objectType));

    this.onAudioObjectDataChange = options.onAudioObjectDataChange;
  }

  isObjectInRegistry(objectType: string): boolean {
    return this.isAudioObject(objectType);
  }

  suppressNextAudioObjectSync(nodeId: string): void {
    this.suppressedAudioObjectSyncs.add(nodeId);
  }

  consumeSuppressedAudioObjectSync(nodeId: string): boolean {
    const isSuppressed = this.suppressedAudioObjectSyncs.has(nodeId);
    this.suppressedAudioObjectSyncs.delete(nodeId);

    return isSuppressed;
  }

  upsertAudioObject(descriptor: RuntimeAudioObjectDescriptor): void {
    // cleanup existing nodes
    this.removeAudioObjectMessageContext(descriptor.id, false);
    this.audioService.removeNodeById(descriptor.id);

    // insert new nodes
    this.audioService
      .createNode(descriptor.id, descriptor.objectType, descriptor.params)
      .catch(() => undefined);

    const messageContext = this.createAudioObjectMessageContext(
      descriptor.id,
      descriptor.objectType
    );

    this.audioObjects.set(descriptor.id, { messageContext });
    this.suppressedAudioObjectSyncs.delete(descriptor.id);

    this.viewRevisions.bump(descriptor.id);
  }

  destroyAudioObject(nodeId: string): void {
    // cleanup existing nodes
    this.audioService.removeNodeById(nodeId);
    this.removeAudioObjectMessageContext(nodeId, true);

    this.suppressedAudioObjectSyncs.delete(nodeId);
    this.viewRevisions.bump(nodeId);
  }

  sendAudioObjectMessage(nodeId: string, key: string, message: unknown): void {
    this.audioService.send(nodeId, key, message);
  }

  updateConnections(edges: Edge[]): void {
    this.audioService.updateEdges(edges);
  }

  getAudioObject(nodeId: string): AudioNodeV2 | null {
    return this.audioService.getNodeById(nodeId);
  }

  subscribeAudioObjectMessages(nodeId: string, callback: MessageCallbackFn): (() => void) | null {
    const messageContext = this.audioObjects.get(nodeId)?.messageContext;
    if (!messageContext) return null;

    messageContext.queue.addCallback(callback);

    return () => {
      messageContext.queue.removeCallback(callback);
    };
  }

  trackAudioObjectViewRevision(nodeId: string): number {
    return this.viewRevisions.track(nodeId);
  }

  subscribeAudioObjectViewRevisions(listener: RuntimeObjectViewRevisionListener): () => void {
    return this.viewRevisions.subscribe(listener);
  }

  destroy(): void {
    for (const nodeId of this.audioObjects.keys()) {
      this.destroyAudioObject(nodeId);
    }
  }

  private createAudioObjectMessageContext(nodeId: string, objectType: string): MessageContext {
    const nodeClass = AudioRegistry.getInstance().get(objectType);

    const messageContext = new MessageContext(nodeId);
    const callback = this.createAudioObjectMessageCallback(nodeId, nodeClass);

    messageContext.queue.addCallback(callback);

    return messageContext;
  }

  private createAudioObjectMessageCallback(
    nodeId: string,
    nodeClass: AudioNodeClass | undefined
  ): MessageCallbackFn {
    return (message, meta) => {
      const settingsUpdate = nodeClass?.getMessageSettingsUpdate?.(message);

      if (settingsUpdate) {
        for (const [key, value] of Object.entries(settingsUpdate)) {
          this.sendAudioObjectMessage(nodeId, key, value);
        }

        this.suppressNextAudioObjectSync(nodeId);
        this.onAudioObjectDataChange?.(nodeId, settingsUpdate);

        return;
      }

      const inlet = meta.inlet;
      if (inlet === undefined) return;

      const inletDefinition = nodeClass?.inlets?.[inlet];
      if (!inletDefinition?.name) return;
      if (!validateMessageToObject(message, inletDefinition)) return;

      this.sendAudioObjectMessage(nodeId, inletDefinition.name, message);
    };
  }

  private removeAudioObjectMessageContext(nodeId: string, unregisterMessageNode: boolean): void {
    const messageContext = this.audioObjects.get(nodeId)?.messageContext;
    if (!messageContext) return;

    messageContext.destroy({ unregisterNode: unregisterMessageNode });

    this.audioObjects.delete(nodeId);
  }
}
