export type { RuntimeAudioObjectDescriptor } from './types/audio-adapter';

export type {
  RuntimeConnectionSpec,
  RuntimeGraphSpec,
  RuntimeObjectDescriptor,
  RuntimeObjectSpec
} from './types/runtime-object';

export type {
  RuntimeDependencies as PatchRuntimeDependencies,
  PatchRuntimeDependencyOverrides,
  PatchRuntimeOptions
} from './types/patch-runtime';

export { PatchRuntime } from './services/PatchRuntime';
export { createPatchRuntime, createDefaultRuntimeDependencies } from './utils/runtime-dependencies';
export type { CreatePatchRuntimeOptions } from './utils/runtime-dependencies';

export { useNodeViewMessageContext } from './editor/useNodeViewMessageContext.svelte';

export {
  setPatchRuntime,
  getPatchRuntime,
  getPatchRuntimeViewRevisionTracker
} from './utils/patch-runtime-context';

export { setRuntimeGraphFromEditorGraph } from './editor/editor-reconciler';
