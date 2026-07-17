import type { AudioService } from '$lib/audio';
import type { AudioAnalysisSystem, WorkletDirectChannelService } from '$lib/audio';
import type { GLSystem } from '$lib/canvas/GLSystem';
import type { WorkerNodeSystem } from '$lib/js-runner';
import type { MediaPipeNodeSystem } from '$lib/mediapipe';
import type { MessageSystem } from '$lib/messages';
import type { DirectChannelService } from '$lib/messages';
import type { ObjectService } from '$lib/objects';
import type { ProfilerCoordinator } from '$lib/profiler';

import type { RuntimeObjectDescriptor, RuntimeObjectSpec } from './runtime-object';

export type RuntimeObjectDescriptorOrSpec = RuntimeObjectDescriptor | RuntimeObjectSpec;

export type RuntimeConnectionServices = {
  glSystem: Pick<GLSystem, 'updateEdges'>;
  audioAnalysisSystem: Pick<AudioAnalysisSystem, 'updateEdges'>;
  workerNodeSystem: Pick<WorkerNodeSystem, 'updateEdges'>;
  mediaPipeNodeSystem: Pick<MediaPipeNodeSystem, 'updateEdges' | 'unregister'>;
  directChannelService: Pick<DirectChannelService, 'updateEdges' | 'updateNodeTypes'>;
  workletDirectChannelService: Pick<WorkletDirectChannelService, 'updateEdges'>;
};

export interface PatchRuntimeOptions {
  audioService: AudioService;
  objectService: ObjectService;
  connectionServices?: Partial<RuntimeConnectionServices>;
  messageSystem?: Pick<MessageSystem, 'unregisterNode'>;
  profilerCoordinator?: Pick<ProfilerCoordinator, 'unregister'>;

  isAudioObject?: (objectType: string) => boolean;

  onObjectParamsChange?: (nodeId: string, params: unknown[]) => void;
  onObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;
  onAudioObjectDataChange?: (nodeId: string, updates: Record<string, unknown>) => void;
}
