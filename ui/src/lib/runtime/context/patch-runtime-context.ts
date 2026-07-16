import { getContext, onDestroy, setContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import type { PatchRuntime } from '../PatchRuntime';

const PATCH_RUNTIME_KEY = Symbol('patch-runtime');
const PATCH_RUNTIME_VIEW_REVISIONS_KEY = Symbol('patch-runtime-view-revisions');

type PatchRuntimeViewRevisionTracker = {
  trackObjectViewRevision(nodeId: string): number;
};

export const setPatchRuntime = (runtime: PatchRuntime) => {
  const revisions = new SvelteMap<string, number>();

  const unsubscribe = runtime.subscribeObjectViewRevisions((nodeId: string) => {
    revisions.set(nodeId, runtime.trackObjectViewRevision(nodeId));
  });

  setContext(PATCH_RUNTIME_KEY, runtime);

  setContext(PATCH_RUNTIME_VIEW_REVISIONS_KEY, {
    trackObjectViewRevision(nodeId: string) {
      return revisions.get(nodeId) ?? runtime.trackObjectViewRevision(nodeId);
    }
  } satisfies PatchRuntimeViewRevisionTracker);

  onDestroy(unsubscribe);
};

export const getPatchRuntime = (): PatchRuntime | null =>
  getContext<PatchRuntime | null>(PATCH_RUNTIME_KEY) ?? null;

export const getPatchRuntimeViewRevisionTracker = (): PatchRuntimeViewRevisionTracker | null =>
  getContext<PatchRuntimeViewRevisionTracker | null>(PATCH_RUNTIME_VIEW_REVISIONS_KEY) ?? null;
