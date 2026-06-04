import type { Edge } from '@xyflow/svelte';

export type PatchbayAudioRuntime = {
  registerEdge(routeId: string, edge: Edge): void;
  unregisterEdge(routeId: string): void;
};

const audioServiceRuntime: PatchbayAudioRuntime = {
  registerEdge(routeId, edge) {
    void import('$lib/audio/v2/AudioService').then(({ AudioService }) => {
      AudioService.getInstance().registerPatchbayAudioEdge(routeId, edge);
    });
  },
  unregisterEdge(routeId) {
    void import('$lib/audio/v2/AudioService').then(({ AudioService }) => {
      AudioService.getInstance().unregisterPatchbayAudioEdge(routeId);
    });
  }
};

let runtime: PatchbayAudioRuntime = audioServiceRuntime;

export function getPatchbayAudioRuntime(): PatchbayAudioRuntime {
  return runtime;
}

export function setPatchbayAudioRuntime(nextRuntime: PatchbayAudioRuntime): () => void {
  const previousRuntime = runtime;
  runtime = nextRuntime;

  return () => {
    runtime = previousRuntime;
  };
}
