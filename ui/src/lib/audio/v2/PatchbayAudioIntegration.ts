import type { Edge } from '@xyflow/svelte';

import type { AudioNodeV2 } from './interfaces/audio-nodes';
import { PatchbayAudioEndpoint } from '$objects/patchbay/PatchbayAudioEndpointNode';
import { AudioRegistry } from '$lib/registry/AudioRegistry';

type PatchbayAudioIntegrationOptions = {
  getAudioContext: () => AudioContext;
  nodesById: Map<string, AudioNodeV2>;
  removeNodeById: (nodeId: string) => void;
  onEdgesChanged: () => void;
  createVirtualAudioNode?: (nodeId: string, type: string) => AudioNodeV2;
};

type VirtualAudioNodeSpec = {
  nodeId: string;
  type: string;
  params: unknown[];
};

export class PatchbayAudioIntegration {
  private registry = AudioRegistry.getInstance();

  private edges = new Map<string, Edge>();

  private virtualAudioNodeIds = new Map<string, string>();
  private virtualAudioNodeTypes = new Map<string, string>();

  constructor(private options: PatchbayAudioIntegrationOptions) {}

  registerEdge(routeId: string, edge: Edge): void {
    this.edges.set(routeId, edge);
    this.options.onEdgesChanged();
  }

  unregisterEdge(routeId: string): void {
    this.edges.delete(routeId);
    this.options.onEdgesChanged();
  }

  registerVirtualAudioNode(routeId: string, spec: VirtualAudioNodeSpec): void {
    const previousNodeId = this.virtualAudioNodeIds.get(routeId);
    const previousType = this.virtualAudioNodeTypes.get(routeId);

    if (previousNodeId && (previousNodeId !== spec.nodeId || previousType !== spec.type)) {
      this.options.removeNodeById(previousNodeId);
    }

    this.virtualAudioNodeIds.set(routeId, spec.nodeId);
    this.virtualAudioNodeTypes.set(routeId, spec.type);

    const existingNode = this.options.nodesById.get(spec.nodeId);

    if (existingNode) {
      if (spec.type === 'expr~') {
        existingNode.send?.('expression', spec.params[1]);
      }

      this.options.onEdgesChanged();

      return;
    }

    const node =
      this.options.createVirtualAudioNode?.(spec.nodeId, spec.type) ??
      this.createVirtualAudioNode(spec.nodeId, spec.type);

    if (!node) return;

    this.options.nodesById.set(node.nodeId, node);

    Promise.resolve(node.create?.(spec.params)).finally(() => {
      const activeNodeId = this.virtualAudioNodeIds.get(routeId);
      const activeType = this.virtualAudioNodeTypes.get(routeId);
      const activeNode = this.options.nodesById.get(spec.nodeId);

      if (activeNodeId !== spec.nodeId || activeType !== spec.type || activeNode !== node) {
        node.destroy?.();
        return;
      }

      this.options.onEdgesChanged();
    });
  }

  unregisterVirtualAudioNode(routeId: string): void {
    const nodeId = this.virtualAudioNodeIds.get(routeId);
    if (!nodeId) return;

    this.options.removeNodeById(nodeId);
    this.virtualAudioNodeIds.delete(routeId);
    this.virtualAudioNodeTypes.delete(routeId);
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

  private createVirtualAudioNode(nodeId: string, type: string): AudioNodeV2 | null {
    const NodeClass = this.registry.get(type);
    if (!NodeClass) return null;

    return new NodeClass(nodeId, this.options.getAudioContext());
  }
}
