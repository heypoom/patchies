import type { Edge } from '@xyflow/svelte';
import type { AudioNodeV2 } from '$lib/audio/v2/interfaces/audio-nodes';
import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
import type { ObjectMetadata } from '$lib/objects/v2/object-metadata';

import {
  PatchAudioRuntime,
  type PatchAudioObjectSpec,
  type PatchRuntimeAudioService
} from './PatchAudioRuntime';

import {
  PatchMessageRuntime,
  type RuntimeObjectPorts,
  type PatchRuntimeObjectService,
  type PatchRuntimeObjectSpec
} from './PatchMessageRuntime';

export type { PatchRuntimeAudioService } from './PatchAudioRuntime';
export type { PatchAudioObjectSpec } from './PatchAudioRuntime';
export type { PatchRuntimeObjectService, PatchRuntimeObjectSpec } from './PatchMessageRuntime';

export type PatchRuntimeOptions = {
  objectService: PatchRuntimeObjectService;
  audioService?: PatchRuntimeAudioService;
  isAudioObject?: (objectType: string) => boolean;
  onObjectParamsChange?: (nodeId: string, params: unknown[]) => void;
};

export class PatchRuntime {
  private message: PatchMessageRuntime;
  private audio: PatchAudioRuntime;

  constructor(options: PatchRuntimeOptions) {
    this.message = new PatchMessageRuntime({
      objectService: options.objectService,
      onObjectParamsChange: options.onObjectParamsChange
    });

    this.audio = new PatchAudioRuntime({
      audioService: options.audioService,
      isAudioObject: options.isAudioObject
    });
  }

  isObjectInRegistry(objectType: string): boolean {
    return (
      this.message.isObjectInRegistry(objectType) || this.audio.canCreateAudioObject(objectType)
    );
  }

  async createObject(spec: PatchRuntimeObjectSpec): Promise<void> {
    await this.message.createObject(spec);
  }

  async updateObject(nodeId: string, spec: PatchRuntimeObjectSpec): Promise<void> {
    await this.message.updateObject(nodeId, spec);
  }

  destroyObject(nodeId: string): void {
    this.message.destroyObject(nodeId);
  }

  subscribeObjectMessages(nodeId: string, callback: MessageCallbackFn): (() => void) | null {
    return this.message.subscribeObjectMessages(nodeId, callback);
  }

  getObjectPorts(
    nodeId: string,
    objectMeta: Pick<ObjectMetadata, 'inlets' | 'outlets'> | null | undefined
  ): RuntimeObjectPorts {
    return this.message.getObjectPorts(nodeId, objectMeta);
  }

  getObjectViewRevision(nodeId: string): number {
    return this.message.getObjectViewRevision(nodeId);
  }

  canCreateAudioObject(objectType: string): boolean {
    return this.audio.canCreateAudioObject(objectType);
  }

  syncAudioObject(spec: PatchAudioObjectSpec): boolean {
    return this.audio.syncAudioObject(spec);
  }

  suppressNextAudioObjectSync(nodeId: string): void {
    this.audio.suppressNextAudioObjectSync(nodeId);
  }

  createOrUpdateAudioObject(
    nodeId: string,
    objectType: string,
    params: unknown[],
    edges: Edge[]
  ): void {
    this.audio.createOrUpdateAudioObject(nodeId, objectType, params, edges);
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
