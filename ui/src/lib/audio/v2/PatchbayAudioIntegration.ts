import type { Edge } from '@xyflow/svelte';

import type { AudioNodeV2 } from './interfaces/audio-nodes';
import { PatchbayAudioEndpoint } from './nodes/PatchbayAudioEndpointNode';

type PatchbayAudioIntegrationOptions = {
  getAudioContext: () => AudioContext;
  nodesById: Map<string, AudioNodeV2>;
  removeNodeById: (nodeId: string) => void;
  onEdgesChanged: () => void;
};

export class PatchbayAudioIntegration {
  private edges = new Map<string, Edge>();

  constructor(private options: PatchbayAudioIntegrationOptions) {}

  registerEdge(routeId: string, edge: Edge): void {
    this.edges.set(routeId, edge);
    this.options.onEdgesChanged();
  }

  unregisterEdge(routeId: string): void {
    this.edges.delete(routeId);
    this.options.onEdgesChanged();
  }

  getEdges(): Edge[] {
    return [...this.edges.values()];
  }

  ensureEndpoint(nodeId: string): void {
    if (!this.isEndpointId(nodeId) || this.options.nodesById.has(nodeId)) return;

    const endpoint = new PatchbayAudioEndpoint(nodeId, this.options.getAudioContext());

    this.options.nodesById.set(nodeId, endpoint);
  }

  cleanupStaleEndpoints(edges: Edge[]): void {
    const referencedNodeIds = new Set(edges.flatMap((edge) => [edge.source, edge.target]));

    for (const nodeId of this.options.nodesById.keys()) {
      if (this.isEndpointId(nodeId) && !referencedNodeIds.has(nodeId)) {
        this.options.removeNodeById(nodeId);
      }
    }
  }

  isEndpointId(nodeId: string): boolean {
    return nodeId.includes(':audio-recv:') || nodeId.includes(':audio-send:');
  }
}
