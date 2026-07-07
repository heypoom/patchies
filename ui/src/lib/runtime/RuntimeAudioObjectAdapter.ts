import type { Edge } from '@xyflow/svelte';
import { hash } from 'ohash';
import { getAudioObjectNames } from '$lib/audio/v2/audio-helpers';
import type { AudioNodeClass, AudioNodeV2 } from '$lib/audio/v2/interfaces/audio-nodes';
import { MessageContext } from '$lib/messages/MessageContext';
import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
import { AudioRegistry } from '$lib/registry/AudioRegistry';

export interface RuntimeAudioObjectService {
  removeNodeById(nodeId: string): void;
  createNode(nodeId: string, objectType: string, params: unknown[]): void;
  updateEdges(edges: Edge[]): void;
  send(nodeId: string, key: string, message: unknown): void;
  getNodeById(nodeId: string): AudioNodeV2 | null;
}

export interface RuntimeAudioObjectAdapterOptions {
  audioService?: RuntimeAudioObjectService;
  isAudioObject?: (objectType: string) => boolean;
  onAudioObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;
}

export type RuntimeAudioObjectSpec = {
  id: string;
  objectType: string;
  params: unknown[];
  edges: Edge[];
};

export class RuntimeAudioObjectAdapter {
  private audioService?: RuntimeAudioObjectService;

  private isAudioObject: (objectType: string) => boolean;
  private onAudioObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;

  /** Node ids for audio objects created by this adapter, used for runtime-owned cleanup. */
  private audioObjectIds = new Set<string>();

  /** Last synced object type and params per node id, used to avoid unnecessary audio recreates. */
  private audioObjectSyncKeys = new Map<string, string>();

  /** Runtime-owned message contexts that keep audio object messages alive without a mounted view. */
  private audioObjectMessageContexts = new Map<string, MessageContext>();

  /** Node ids whose next editor-state sync should be ignored because runtime messaging already applied it. */
  private suppressedAudioObjectSyncs = new Set<string>();

  constructor(options: RuntimeAudioObjectAdapterOptions = {}) {
    this.audioService = options.audioService;

    this.isAudioObject =
      options.isAudioObject ?? ((objectType) => getAudioObjectNames().includes(objectType));

    this.onAudioObjectDataChange = options.onAudioObjectDataChange;
  }

  canCreateAudioObject(objectType: string): boolean {
    return this.isAudioObject(objectType);
  }

  syncAudioObject(spec: RuntimeAudioObjectSpec): boolean {
    if (!this.canCreateAudioObject(spec.objectType)) {
      // The same editor node may stop being an audio object after its text changes.
      // If this adapter previously created audio runtime state for it, tear that down.
      this.suppressedAudioObjectSyncs.delete(spec.id);
      if (!this.audioObjectSyncKeys.has(spec.id)) return false;

      this.destroyAudioObject(spec.id);

      return true;
    }

    const syncKey = this.getAudioObjectSyncKey(spec.objectType, spec.params);

    if (this.audioObjectSyncKeys.get(spec.id) === syncKey) {
      // The editor state still describes the same audio object. Usually this is a no-op,
      // but delete/undo or graph cleanup can remove the AudioService node while leaving
      // this adapter's sync cache warm. Recreate when the service node is missing.
      if (!this.audioObjectIds.has(spec.id) || this.getAudioObject(spec.id)) return false;

      this.createOrUpdateAudioObject(spec.id, spec.objectType, spec.params, spec.edges);

      return true;
    }

    if (this.suppressedAudioObjectSyncs.delete(spec.id)) {
      // Runtime-owned message contexts can update both the live audio node and editor
      // node data. When that data change loops back through reconciliation, skip the
      // recreate because the audio node already received the setting message.
      if (this.audioObjectIds.has(spec.id)) {
        this.audioObjectSyncKeys.set(spec.id, syncKey);
      } else {
        this.audioObjectSyncKeys.delete(spec.id);
      }

      return false;
    }

    this.createOrUpdateAudioObject(spec.id, spec.objectType, spec.params, spec.edges);

    return true;
  }

  suppressNextAudioObjectSync(nodeId: string): void {
    this.suppressedAudioObjectSyncs.add(nodeId);
  }

  createOrUpdateAudioObject(
    nodeId: string,
    objectType: string,
    params: unknown[],
    edges: Edge[]
  ): void {
    const audioService = this.getAudioService();

    // cleanup existing nodes
    this.removeAudioObjectMessageContext(nodeId, false);
    audioService.removeNodeById(nodeId);

    // insert new nodes
    audioService.createNode(nodeId, objectType, params);
    this.createAudioObjectMessageContext(nodeId, objectType);
    audioService.updateEdges(edges);

    // sync ids and keys
    this.audioObjectIds.add(nodeId);
    this.audioObjectSyncKeys.set(nodeId, this.getAudioObjectSyncKey(objectType, params));
    this.suppressedAudioObjectSyncs.delete(nodeId);
  }

  destroyAudioObject(nodeId: string): void {
    this.getAudioService().removeNodeById(nodeId);
    this.removeAudioObjectMessageContext(nodeId, true);

    // sync ids and keys
    this.audioObjectIds.delete(nodeId);
    this.audioObjectSyncKeys.delete(nodeId);
    this.suppressedAudioObjectSyncs.delete(nodeId);
  }

  sendAudioObjectMessage(nodeId: string, key: string, message: unknown): void {
    this.getAudioService().send(nodeId, key, message);
  }

  getAudioObject(nodeId: string): AudioNodeV2 | null {
    return this.getAudioService().getNodeById(nodeId);
  }

  destroy(): void {
    for (const nodeId of [...this.audioObjectIds]) {
      this.destroyAudioObject(nodeId);
    }
  }

  private getAudioService(): RuntimeAudioObjectService {
    if (!this.audioService) {
      throw new Error('RuntimeAudioObjectAdapter operations require an audioService');
    }

    return this.audioService;
  }

  private getAudioObjectSyncKey(objectType: string, params: unknown[]): string {
    return hash([objectType, params]);
  }

  private createAudioObjectMessageContext(nodeId: string, objectType: string): void {
    const nodeClass = AudioRegistry.getInstance().get(objectType);
    const messageContext = new MessageContext(nodeId);
    const callback = this.createAudioObjectMessageCallback(nodeId, nodeClass);

    messageContext.queue.addCallback(callback);

    this.audioObjectMessageContexts.set(nodeId, messageContext);
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

      const inletName = nodeClass?.inlets?.[inlet]?.name;
      if (!inletName) return;

      this.sendAudioObjectMessage(nodeId, inletName, message);
    };
  }

  private removeAudioObjectMessageContext(nodeId: string, unregisterMessageNode: boolean): void {
    const messageContext = this.audioObjectMessageContexts.get(nodeId);
    if (!messageContext) return;

    messageContext.destroy({ unregisterNode: unregisterMessageNode });

    this.audioObjectMessageContexts.delete(nodeId);
  }
}
