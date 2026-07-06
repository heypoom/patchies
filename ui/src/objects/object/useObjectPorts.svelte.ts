import type { ObjectInlet, ObjectOutlet, ObjectMetadata } from '$lib/objects/v2/object-metadata';
import { getPatchRuntime } from '$lib/runtime/patch-runtime-context';

type ObjectPortsOptions = {
  nodeId: string;
  getObjectMeta: () => ObjectMetadata | null | undefined;
  getObjectInstanceVersion: () => number;
};

export function useObjectPorts(options: ObjectPortsOptions) {
  const patchRuntime = getPatchRuntime();

  const inlets = $derived.by((): ObjectInlet[] => {
    options.getObjectInstanceVersion();
    patchRuntime?.getObjectRevision(options.nodeId);

    return patchRuntime?.getObjectPorts(options.nodeId, options.getObjectMeta()).inlets ?? [];
  });

  const outlets = $derived.by((): ObjectOutlet[] => {
    options.getObjectInstanceVersion();
    patchRuntime?.getObjectRevision(options.nodeId);

    return patchRuntime?.getObjectPorts(options.nodeId, options.getObjectMeta()).outlets ?? [];
  });

  const hasDynamicOutlets = $derived.by(() => {
    options.getObjectInstanceVersion();
    patchRuntime?.getObjectRevision(options.nodeId);

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
