import type { Edge } from '@xyflow/svelte';

export type PatchbayVideoRuntime = {
  registerRoute(routeId: string, from: string, to: string): void;
  unregisterRoute(routeId: string): void;
  registerEdge(routeId: string, edge: Edge): void;
  unregisterEdge(routeId: string): void;
};

const glSystemRuntime: PatchbayVideoRuntime = {
  registerRoute(routeId, from, to) {
    void import('$lib/canvas/GLSystem').then(({ GLSystem }) => {
      GLSystem.getInstance().registerPatchbayVideoRoute(routeId, from, to);
    });
  },
  unregisterRoute(routeId) {
    void import('$lib/canvas/GLSystem').then(({ GLSystem }) => {
      GLSystem.getInstance().unregisterPatchbayVideoRoute(routeId);
    });
  },
  registerEdge(routeId, edge) {
    void import('$lib/canvas/GLSystem').then(({ GLSystem }) => {
      GLSystem.getInstance().registerPatchbayVideoEdge(routeId, edge);
    });
  },
  unregisterEdge(routeId) {
    void import('$lib/canvas/GLSystem').then(({ GLSystem }) => {
      GLSystem.getInstance().unregisterPatchbayVideoEdge(routeId);
    });
  }
};

let runtime: PatchbayVideoRuntime = glSystemRuntime;

export function getPatchbayVideoRuntime(): PatchbayVideoRuntime {
  return runtime;
}

export function setPatchbayVideoRuntime(nextRuntime: PatchbayVideoRuntime): () => void {
  const previousRuntime = runtime;
  runtime = nextRuntime;

  return () => {
    runtime = previousRuntime;
  };
}
