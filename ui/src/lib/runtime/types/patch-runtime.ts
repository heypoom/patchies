import type { AudioService } from '$lib/audio';
import type { GLSystem } from '$lib/canvas/GLSystem';
import type { WorkerNodeSystem } from '$lib/js-runner';
import type { MediaPipeNodeSystem } from '$lib/mediapipe';
import type { MessageSystem } from '$lib/messages';
import type { DirectChannelService } from '$lib/messages';
import type { ObjectService } from '$lib/objects';
import type { PatchiesEventBus } from '$lib/eventbus';
import type { ProfilerCoordinator } from '$lib/profiler';
import type { AudioAnalysisSystem, WorkletDirectChannelService } from '$lib/audio';

import type { RuntimeObjectDescriptor, RuntimeObjectSpec } from './runtime-object';

export type RuntimeObjectDescriptorOrSpec = RuntimeObjectDescriptor | RuntimeObjectSpec;

export interface PatchRuntimeOptions {
  services: RuntimeServices;

  isAudioObject?: (objectType: string) => boolean;

  onObjectParamsChange?: (nodeId: string, params: unknown[]) => void;
  onObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;
  onAudioObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;
}

export type RuntimeServices = {
  glSystem: GLSystem;
  audioService: AudioService;

  objectService: ObjectService;
  eventBus: PatchiesEventBus;
  messageSystem: MessageSystem;
  profilerCoordinator: ProfilerCoordinator;

  audioAnalysisSystem: Pick<AudioAnalysisSystem, 'updateEdges'>;
  workerNodeSystem: Pick<WorkerNodeSystem, 'updateEdges'>;
  mediaPipeNodeSystem: Pick<MediaPipeNodeSystem, 'updateEdges' | 'unregister'>;
  directChannelService: Pick<DirectChannelService, 'updateEdges' | 'updateNodeTypes'>;
  workletDirectChannelService: Pick<WorkletDirectChannelService, 'updateEdges'>;
};

export type PatchRuntimeServiceOverrides = Partial<RuntimeServices>;
