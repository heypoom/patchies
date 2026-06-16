import type { Edge } from '@xyflow/svelte';

export type PatchbayAudioRuntime = {
  registerEdge(routeId: string, edge: Edge): void;
  unregisterEdge(routeId: string): void;
  registerVirtualAudioNode?(
    routeId: string,
    node: { nodeId: string; type: string; params: unknown[] }
  ): void;
  unregisterVirtualAudioNode?(routeId: string): void;
};

const getService = () =>
  import('$lib/audio/v2/AudioService').then(({ AudioService }) => AudioService.getInstance());

const audioServiceRuntime: PatchbayAudioRuntime = {
  registerEdge(routeId, edge) {
    getService().then((audio) => audio.registerPatchbayAudioEdge(routeId, edge));
  },
  unregisterEdge(routeId) {
    getService().then((audio) => audio.unregisterPatchbayAudioEdge(routeId));
  },
  registerVirtualAudioNode(routeId, node) {
    getService().then((audio) => audio.registerPatchbayVirtualAudioNode(routeId, node));
  },
  unregisterVirtualAudioNode(routeId) {
    getService().then((audio) => audio.unregisterPatchbayVirtualAudioNode(routeId));
  }
};

let runtime: PatchbayAudioRuntime = audioServiceRuntime;

export const getPatchbayAudioRuntime = (): PatchbayAudioRuntime => runtime;

export function setPatchbayAudioRuntime(nextRuntime: PatchbayAudioRuntime): () => void {
  const previousRuntime = runtime;

  runtime = nextRuntime;

  return () => {
    runtime = previousRuntime;
  };
}
