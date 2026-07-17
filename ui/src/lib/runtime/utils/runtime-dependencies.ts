import { AudioAnalysisSystem, AudioService, WorkletDirectChannelService } from '$lib/audio';
import { GLSystem } from '$lib/canvas/GLSystem';
import { PatchiesEventBus } from '$lib/eventbus';
import { WorkerNodeSystem } from '$lib/js-runner';
import { MediaPipeNodeSystem } from '$lib/mediapipe';
import { DirectChannelService, MessageSystem } from '$lib/messages';
import { ObjectService } from '$lib/objects';
import { ProfilerCoordinator } from '$lib/profiler';

import type {
  RuntimeDependencies,
  PatchRuntimeDependencyOverrides,
  PatchRuntimeOptions
} from '../types/patch-runtime';

import { PatchRuntime } from '../services/PatchRuntime';

export type CreatePatchRuntimeOptions = Omit<PatchRuntimeOptions, 'dependencies'> & {
  dependencies?: PatchRuntimeDependencyOverrides;
};

export const createDefaultRuntimeDependencies = (
  overrides: PatchRuntimeDependencyOverrides = {}
): RuntimeDependencies => ({
  audioService: overrides.audioService ?? AudioService.getInstance(),
  objectService: overrides.objectService ?? ObjectService.getInstance(),
  eventBus: overrides.eventBus ?? PatchiesEventBus.getInstance(),
  messageSystem: overrides.messageSystem ?? MessageSystem.getInstance(),
  profilerCoordinator: overrides.profilerCoordinator ?? ProfilerCoordinator.getInstance(),
  glSystem: overrides.glSystem ?? GLSystem.getInstance(),
  audioAnalysisSystem: overrides.audioAnalysisSystem ?? AudioAnalysisSystem.getInstance(),
  workerNodeSystem: overrides.workerNodeSystem ?? WorkerNodeSystem.getInstance(),
  mediaPipeNodeSystem: overrides.mediaPipeNodeSystem ?? MediaPipeNodeSystem.getInstance(),
  directChannelService: overrides.directChannelService ?? DirectChannelService.getInstance(),
  workletDirectChannelService:
    overrides.workletDirectChannelService ?? WorkletDirectChannelService.getInstance()
});

export const createPatchRuntime = (options: CreatePatchRuntimeOptions = {}): PatchRuntime =>
  new PatchRuntime({
    ...options,
    dependencies: createDefaultRuntimeDependencies(options.dependencies)
  });
