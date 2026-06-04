export type PatchbayVideoRuntime = {
  registerRoute(routeId: string, from: string, to: string): void;
  unregisterRoute(routeId: string): void;
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
  }
};

let runtime: PatchbayVideoRuntime = glSystemRuntime;

export function getPatchbayVideoRuntime(): PatchbayVideoRuntime {
  return runtime;
}

export function setPatchbayVideoRuntime(nextRuntime: PatchbayVideoRuntime): () => void {
  runtime = nextRuntime;

  return () => {
    runtime = glSystemRuntime;
  };
}
