import type { ObjectInlet, ObjectOutlet, ObjectMetadata } from '$lib/objects/v2/object-metadata';
import { getPatchRuntime, getPatchRuntimeViewRevisionTracker } from '$lib/runtime';

type ObjectPortsOptions = {
  nodeId: string;
  getObjectMeta: () => ObjectMetadata | null | undefined;
  trackObjectInstanceVersion: () => number;
};

export function useObjectPorts(options: ObjectPortsOptions) {
  const patchRuntime = getPatchRuntime();
  const viewRevisionTracker = getPatchRuntimeViewRevisionTracker();

  const inlets = $derived.by((): ObjectInlet[] => {
    options.trackObjectInstanceVersion();
    viewRevisionTracker?.trackObjectViewRevision(options.nodeId);

    return patchRuntime?.getObjectPorts(options.nodeId, options.getObjectMeta()).inlets ?? [];
  });

  const outlets = $derived.by((): ObjectOutlet[] => {
    options.trackObjectInstanceVersion();
    viewRevisionTracker?.trackObjectViewRevision(options.nodeId);

    return patchRuntime?.getObjectPorts(options.nodeId, options.getObjectMeta()).outlets ?? [];
  });

  const hasDynamicOutlets = $derived.by(() => {
    options.trackObjectInstanceVersion();
    viewRevisionTracker?.trackObjectViewRevision(options.nodeId);

    return (
      patchRuntime?.getObjectPorts(options.nodeId, options.getObjectMeta()).hasDynamicOutlets ??
      false
    );
  });

  return {
    get inlets() {
      return inlets;
    },
    get outlets() {
      return outlets;
    },
    get hasDynamicOutlets() {
      return hasDynamicOutlets;
    }
  };
}
