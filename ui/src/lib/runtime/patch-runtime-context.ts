import { getContext, setContext } from 'svelte';
import type { PatchRuntime } from './PatchRuntime';

const PATCH_RUNTIME_KEY = Symbol('patch-runtime');

export const setPatchRuntime = (runtime: PatchRuntime) => setContext(PATCH_RUNTIME_KEY, runtime);

export const getPatchRuntime = (): PatchRuntime | null =>
  getContext<PatchRuntime | null>(PATCH_RUNTIME_KEY) ?? null;
