import { AudioAnalysisSystem, AudioService, WorkletDirectChannelService } from '$lib/audio';
import { GLSystem } from '$lib/canvas/GLSystem';
import { PatchiesEventBus } from '$lib/eventbus';
import { WorkerNodeSystem } from '$lib/js-runner';
import { MediaPipeNodeSystem } from '$lib/mediapipe';
import { DirectChannelService, MessageSystem } from '$lib/messages';
import { ObjectService } from '$lib/objects';
import { ProfilerCoordinator } from '$lib/profiler';

import type {
  RuntimeServices,
  PatchRuntimeOptions,
  PatchRuntimeServiceOverrides
} from '../types/patch-runtime';

import { PatchRuntime } from '../services/PatchRuntime';

export type CreatePatchRuntimeOptions = Omit<PatchRuntimeOptions, 'services'> & {
  services?: PatchRuntimeServiceOverrides;
};

export const createDefaultRuntimeServices = (
  services: PatchRuntimeServiceOverrides = {}
): RuntimeServices => ({
  audioService: services.audioService ?? AudioService.getInstance(),
  objectService: services.objectService ?? ObjectService.getInstance(),
  eventBus: services.eventBus ?? PatchiesEventBus.getInstance(),
  messageSystem: services.messageSystem ?? MessageSystem.getInstance(),
  profilerCoordinator: services.profilerCoordinator ?? ProfilerCoordinator.getInstance(),
  glSystem: services.glSystem ?? GLSystem.getInstance(),
  audioAnalysisSystem: services.audioAnalysisSystem ?? AudioAnalysisSystem.getInstance(),
  workerNodeSystem: services.workerNodeSystem ?? WorkerNodeSystem.getInstance(),
  mediaPipeNodeSystem: services.mediaPipeNodeSystem ?? MediaPipeNodeSystem.getInstance(),
  directChannelService: services.directChannelService ?? DirectChannelService.getInstance(),
  workletDirectChannelService:
    services.workletDirectChannelService ?? WorkletDirectChannelService.getInstance()
});

export const createPatchRuntime = (options: CreatePatchRuntimeOptions = {}): PatchRuntime =>
  new PatchRuntime({ ...options, services: createDefaultRuntimeServices(options.services) });
