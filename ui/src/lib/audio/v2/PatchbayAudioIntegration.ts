import type { Edge } from '@xyflow/svelte';

import type { AudioNodeV2 } from './interfaces/audio-nodes';
import { ExprNode } from './nodes/ExprNode';
import { PatchbayAudioEndpoint } from './nodes/PatchbayAudioEndpointNode';

type PatchbayAudioIntegrationOptions = {
  getAudioContext: () => AudioContext;
  nodesById: Map<string, AudioNodeV2>;
  removeNodeById: (nodeId: string) => void;
  onEdgesChanged: () => void;
  createVirtualExpressionNode?: (nodeId: string) => AudioNodeV2;
};

export class PatchbayAudioIntegration {
  private edges = new Map<string, Edge>();
  private virtualExpressionNodeIds = new Map<string, string>();

  constructor(private options: PatchbayAudioIntegrationOptions) {}

  registerEdge(routeId: string, edge: Edge): void {
    this.edges.set(routeId, edge);
    this.options.onEdgesChanged();
  }

  unregisterEdge(routeId: string): void {
    this.edges.delete(routeId);
    this.options.onEdgesChanged();
  }

  registerVirtualExpression(
    routeId: string,
    expression: { nodeId: string; expression: string }
  ): void {
    const previousNodeId = this.virtualExpressionNodeIds.get(routeId);

    if (previousNodeId && previousNodeId !== expression.nodeId) {
      this.options.removeNodeById(previousNodeId);
    }

    this.virtualExpressionNodeIds.set(routeId, expression.nodeId);

    const existingNode = this.options.nodesById.get(expression.nodeId);

    if (existingNode) {
      existingNode.send?.('expression', expression.expression);
      this.options.onEdgesChanged();
      return;
    }

    const node =
      this.options.createVirtualExpressionNode?.(expression.nodeId) ??
      new ExprNode(expression.nodeId, this.options.getAudioContext());

    this.options.nodesById.set(node.nodeId, node);

    Promise.resolve(node.create?.([null, expression.expression])).finally(() => {
      const activeNodeId = this.virtualExpressionNodeIds.get(routeId);
      const activeNode = this.options.nodesById.get(expression.nodeId);

      if (activeNodeId !== expression.nodeId || activeNode !== node) {
        node.destroy?.();
        return;
      }

      this.options.onEdgesChanged();
    });
  }

  unregisterVirtualExpression(routeId: string): void {
    const nodeId = this.virtualExpressionNodeIds.get(routeId);
    if (!nodeId) return;

    this.options.removeNodeById(nodeId);
    this.virtualExpressionNodeIds.delete(routeId);
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
