import type { Edge } from '@xyflow/svelte';

export type PatchbayVideoRuntime = {
  registerRoute(routeId: string, from: string, to: string): void;
  unregisterRoute(routeId: string): void;
  registerEdge(routeId: string, edge: Edge): void;
  unregisterEdge(routeId: string): void;
};

const getGL = () => import('$lib/canvas/GLSystem').then(({ GLSystem }) => GLSystem.getInstance());

const glSystemRuntime: PatchbayVideoRuntime = {
  registerRoute(routeId, from, to) {
    getGL().then((gl) => gl.registerPatchbayVideoRoute(routeId, from, to));
  },
  unregisterRoute(routeId) {
    getGL().then((gl) => gl.unregisterPatchbayVideoRoute(routeId));
  },
  registerEdge(routeId, edge) {
    getGL().then((gl) => gl.registerPatchbayVideoEdge(routeId, edge));
  },
  unregisterEdge(routeId) {
    getGL().then((gl) => gl.unregisterPatchbayVideoEdge(routeId));
  }
};

let runtime: PatchbayVideoRuntime = glSystemRuntime;

export const getPatchbayVideoRuntime = (): PatchbayVideoRuntime => runtime;

export function setPatchbayVideoRuntime(nextRuntime: PatchbayVideoRuntime): () => void {
  const previousRuntime = runtime;

  runtime = nextRuntime;

  return () => {
    runtime = previousRuntime;
  };
}
