import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
import {
  getPatchRuntime,
  getPatchRuntimeViewRevisionTracker
} from '$lib/runtime/patch-runtime-context';

type ObjectRuntimeViewOptions = {
  nodeId: string;
  onMessage: MessageCallbackFn;
  updateNodeInternals: (nodeId: string) => void;
};

export function useObjectRuntimeView(options: ObjectRuntimeViewOptions) {
  const patchRuntime = getPatchRuntime();
  const viewRevisionTracker = getPatchRuntimeViewRevisionTracker();

  $effect(() => {
    return patchRuntime?.subscribeObjectMessages(options.nodeId, options.onMessage) ?? undefined;
  });

  $effect(() => {
    viewRevisionTracker?.trackObjectViewRevision(options.nodeId);
    options.updateNodeInternals(options.nodeId);
  });
}
