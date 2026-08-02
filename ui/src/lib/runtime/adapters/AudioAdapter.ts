import {
  type AudioService,
  type AudioNodeClass,
  type AudioNodeV2,
  isRuntimeDataAwareAudioNode
} from '$lib/audio';

import { MessageContext, type MessageCallbackFn } from '$lib/messages';

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

interface RuntimeAudioObjectEntry {
  messageContext: MessageContext;
  params: unknown[];
}

export class AudioAdapter {
  public readonly audioService: AudioService;

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
    const onBeforeAudioNodeCreate = descriptor.runtimeData
      ? (node: AudioNodeV2) => {
          if (!isRuntimeDataAwareAudioNode(node)) return;

          node.bindRuntimeData({
            initialData: descriptor.runtimeData!,
            update: (updates) => {
              if (this.audioService.getNodeById(descriptor.id) !== node) return;

              this.suppressNextAudioObjectSync(descriptor.id);
              this.onAudioObjectDataChange?.(descriptor.id, updates);
              this.viewRevisions.bump(descriptor.id);
            }
          });
        }
      : undefined;

    const nodePromise = this.audioService.createNode(
      descriptor.id,
      descriptor.objectType,
      descriptor.params,
      onBeforeAudioNodeCreate
    );

    nodePromise.catch?.(() => undefined);

    const messageContext = this.createAudioObjectMessageContext(
      descriptor.id,
      descriptor.objectType
    );

    this.audioObjects.set(descriptor.id, {
      messageContext,
      params: [...descriptor.params]
    });

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
          this.audioService.send(nodeId, key, value);
        }

        this.suppressNextAudioObjectSync(nodeId);
        this.onAudioObjectDataChange?.(nodeId, settingsUpdate);

        return;
      }

      if (nodeClass?.dynamicMessageTarget && meta.inlet !== undefined) {
        this.audioService.send(nodeId, nodeClass.dynamicMessageTarget, {
          inletIndex: meta.inlet,
          message
        });

        return;
      }

      const inletDefinition = getAudioMessageInlet(nodeClass, meta.inlet);
      if (!inletDefinition?.name) return;
      if (!validateMessageToObject(message, inletDefinition)) return;

      this.audioService.send(nodeId, inletDefinition.name, message);

      // Audio Params needs to be updated in the runtime entry
      if (inletDefinition.isAudioParam && typeof message === 'number' && meta.inlet !== undefined) {
        const audioObject = this.audioObjects.get(nodeId);
        if (!audioObject) return;

        const params = [...audioObject.params];
        params[meta.inlet] = message;
        audioObject.params = params;

        this.suppressNextAudioObjectSync(nodeId);
        this.onAudioObjectDataChange?.(nodeId, { params });
      }
    };
  }

  private removeAudioObjectMessageContext(
    nodeId: string,
    unregisterNodeFromMessageSystem: boolean
  ): void {
    const messageContext = this.audioObjects.get(nodeId)?.messageContext;
    if (!messageContext) return;

    messageContext.destroy({ unregisterNode: unregisterNodeFromMessageSystem });

    this.audioObjects.delete(nodeId);
  }
}

const getAudioMessageInlet = (nodeClass: AudioNodeClass | undefined, inlet: number | undefined) => {
  if (!nodeClass?.inlets) return undefined;
  if (inlet !== undefined) return nodeClass.inlets[inlet];

  const messageInlets = nodeClass.inlets.filter((candidate) => candidate.type === 'message');

  return messageInlets.length === 1 ? messageInlets[0] : undefined;
};
