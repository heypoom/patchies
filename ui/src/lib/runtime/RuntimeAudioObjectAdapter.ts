import { SvelteMap } from 'svelte/reactivity';

import type { AudioNodeClass, AudioNodeV2 } from '$lib/audio/v2/interfaces/audio-nodes';
import { MessageContext } from '$lib/messages/MessageContext';
import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
import { validateMessageToObject } from '$lib/objects/validate-object-message';
import { AudioRegistry } from '$lib/registry/AudioRegistry';

export interface RuntimeAudioObjectService {
  removeNodeById(nodeId: string): void;
  createNode(nodeId: string, objectType: string, params: unknown[]): Promise<AudioNodeV2 | null>;
  send(nodeId: string, key: string, message: unknown): void;
  getNodeById(nodeId: string): AudioNodeV2 | null;
}

export interface RuntimeAudioObjectAdapterOptions {
  audioService: RuntimeAudioObjectService;
  isAudioObject?: (objectType: string) => boolean;
  onAudioObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;
}

export type RuntimeAudioObjectDescriptor = {
  id: string;
  objectType: string;
  params: unknown[];
};

type RuntimeAudioObjectRecord = {
  messageContext: MessageContext;
};

export class RuntimeAudioObjectAdapter {
  private audioService: RuntimeAudioObjectService;

  private isAudioObject: (objectType: string) => boolean;
  private onAudioObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;

  /** Runtime-owned audio objects and their message contexts. */
  private audioObjects = new Map<string, RuntimeAudioObjectRecord>();

  /** Node ids whose next editor-state sync should be ignored because runtime messaging already applied it. */
  private suppressedAudioObjectSyncs = new Set<string>();

  /** Reactive revision counter used by views that read runtime-derived audio node state. */
  private audioObjectViewRevisions = new SvelteMap<string, number>();

  constructor(options: RuntimeAudioObjectAdapterOptions) {
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

    this.bumpAudioObjectViewRevision(descriptor.id);
  }

  destroyAudioObject(nodeId: string): void {
    // cleanup existing nodes
    this.audioService.removeNodeById(nodeId);
    this.removeAudioObjectMessageContext(nodeId, true);

    this.suppressedAudioObjectSyncs.delete(nodeId);
    this.bumpAudioObjectViewRevision(nodeId);
  }

  sendAudioObjectMessage(nodeId: string, key: string, message: unknown): void {
    this.audioService.send(nodeId, key, message);
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
    return this.audioObjectViewRevisions.get(nodeId) ?? 0;
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

  private bumpAudioObjectViewRevision(nodeId: string): void {
    this.audioObjectViewRevisions.set(nodeId, (this.audioObjectViewRevisions.get(nodeId) ?? 0) + 1);
  }
}
