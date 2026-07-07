import type { Edge } from '@xyflow/svelte';
import { hash } from 'ohash';
import { getAudioObjectNames } from '$lib/audio/v2/audio-helpers';
import type { AudioNodeClass, AudioNodeV2 } from '$lib/audio/v2/interfaces/audio-nodes';
import { MessageContext } from '$lib/messages/MessageContext';
import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
import { AudioRegistry } from '$lib/registry/AudioRegistry';

export type PatchRuntimeAudioService = {
  removeNodeById(nodeId: string): void;
  createNode(nodeId: string, objectType: string, params: unknown[]): void;
  updateEdges(edges: Edge[]): void;
  send(nodeId: string, key: string, message: unknown): void;
  getNodeById(nodeId: string): AudioNodeV2 | null;
};

export type PatchAudioRuntimeOptions = {
  audioService?: PatchRuntimeAudioService;
  isAudioObject?: (objectType: string) => boolean;
  onAudioObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;
};

export type PatchAudioObjectSpec = {
  id: string;
  objectType: string;
  params: unknown[];
  edges: Edge[];
};

export class PatchAudioRuntime {
  private audioService?: PatchRuntimeAudioService;
  private isAudioObject: (objectType: string) => boolean;
  private onAudioObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;
  private audioObjectIds = new Set<string>();
  private audioObjectSyncKeys = new Map<string, string>();
  private audioObjectMessageContexts = new Map<string, MessageContext>();
  private suppressedAudioObjectSyncs = new Set<string>();

  constructor(options: PatchAudioRuntimeOptions = {}) {
    this.audioService = options.audioService;

    this.isAudioObject =
      options.isAudioObject ?? ((objectType) => getAudioObjectNames().includes(objectType));
    this.onAudioObjectDataChange = options.onAudioObjectDataChange;
  }

  canCreateAudioObject(objectType: string): boolean {
    return this.isAudioObject(objectType);
  }

  syncAudioObject(spec: PatchAudioObjectSpec): boolean {
    if (!this.canCreateAudioObject(spec.objectType)) {
      this.suppressedAudioObjectSyncs.delete(spec.id);
      if (!this.audioObjectSyncKeys.has(spec.id)) return false;

      this.destroyAudioObject(spec.id);

      return true;
    }

    const syncKey = this.getAudioObjectSyncKey(spec.objectType, spec.params);
    if (this.audioObjectSyncKeys.get(spec.id) === syncKey) return false;

    if (this.suppressedAudioObjectSyncs.delete(spec.id)) {
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

    this.removeAudioObjectMessageContext(nodeId, false);
    audioService.removeNodeById(nodeId);
    audioService.createNode(nodeId, objectType, params);
    this.createAudioObjectMessageContext(nodeId, objectType);
    audioService.updateEdges(edges);

    this.audioObjectIds.add(nodeId);
    this.audioObjectSyncKeys.set(nodeId, this.getAudioObjectSyncKey(objectType, params));
    this.suppressedAudioObjectSyncs.delete(nodeId);
  }

  destroyAudioObject(nodeId: string): void {
    this.getAudioService().removeNodeById(nodeId);
    this.removeAudioObjectMessageContext(nodeId, true);

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

  private getAudioService(): PatchRuntimeAudioService {
    if (!this.audioService) {
      throw new Error('PatchAudioRuntime operations require an audioService');
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
