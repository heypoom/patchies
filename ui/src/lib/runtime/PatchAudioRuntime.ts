import type { Edge } from '@xyflow/svelte';
import { hash } from 'ohash';
import { getAudioObjectNames } from '$lib/audio/v2/audio-helpers';
import type { AudioNodeV2 } from '$lib/audio/v2/interfaces/audio-nodes';

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
  private audioObjectIds = new Set<string>();
  private audioObjectSyncKeys = new Map<string, string>();
  private suppressedAudioObjectSyncs = new Set<string>();

  constructor(options: PatchAudioRuntimeOptions = {}) {
    this.audioService = options.audioService;

    this.isAudioObject =
      options.isAudioObject ?? ((objectType) => getAudioObjectNames().includes(objectType));
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

    audioService.removeNodeById(nodeId);
    audioService.createNode(nodeId, objectType, params);
    audioService.updateEdges(edges);

    this.audioObjectIds.add(nodeId);
    this.audioObjectSyncKeys.set(nodeId, this.getAudioObjectSyncKey(objectType, params));
    this.suppressedAudioObjectSyncs.delete(nodeId);
  }

  destroyAudioObject(nodeId: string): void {
    this.getAudioService().removeNodeById(nodeId);

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
}
