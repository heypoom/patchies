import type { Edge } from '@xyflow/svelte';

import { MessageSystem, type MessageCallbackFn } from '$lib/messages/MessageSystem';

export type PatchbayMessageRuntime = {
  registerEdge(routeId: string, edge: Edge): void;
  unregisterEdge(routeId: string): void;
  registerEndpoint(nodeId: string, callback: MessageCallbackFn): void;
  unregisterEndpoint(nodeId: string): void;
  sendFromEndpoint(nodeId: string, data: unknown): void;
};

const messageSystemRuntime: PatchbayMessageRuntime = {
  registerEdge(routeId, edge) {
    MessageSystem.getInstance().registerPatchbayEdge(routeId, edge);
  },
  unregisterEdge(routeId) {
    MessageSystem.getInstance().unregisterPatchbayEdge(routeId);
  },
  registerEndpoint(nodeId, callback) {
    MessageSystem.getInstance().registerNode(nodeId).addCallback(callback);
  },
  unregisterEndpoint(nodeId) {
    MessageSystem.getInstance().unregisterNode(nodeId);
  },
  sendFromEndpoint(nodeId, data) {
    MessageSystem.getInstance().sendFromPatchbayEndpoint(nodeId, data);
  }
};

let runtime: PatchbayMessageRuntime = messageSystemRuntime;

export function getPatchbayMessageRuntime(): PatchbayMessageRuntime {
  return runtime;
}

export function setPatchbayMessageRuntime(nextRuntime: PatchbayMessageRuntime): () => void {
  const previousRuntime = runtime;
  runtime = nextRuntime;

  return () => {
    runtime = previousRuntime;
  };
}
