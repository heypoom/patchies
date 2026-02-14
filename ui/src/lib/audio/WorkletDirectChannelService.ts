/**
 * WorkletDirectChannelService — main-thread service for managing direct
 * message channels between AudioWorklet processors.
 *
 * Tracks which nodes are worklet-based, computes worklet-to-worklet
 * connections from edges, and sends connection updates to processors.
 *
 * Mirrors the pattern of DirectChannelService (for Web Workers).
 */

export interface WorkletDirectConnection {
  outlet: number;
  targetNodeId: string;
  inlet: number;
}

export class WorkletDirectChannelService {
  private static instance: WorkletDirectChannelService;

  /** Registered worklet ports: nodeId → MessagePort */
  private registeredPorts = new Map<string, MessagePort>();

  /** Current edge state */
  private edges: Array<{
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }> = [];

  static getInstance(): WorkletDirectChannelService {
    if (!this.instance) {
      this.instance = new WorkletDirectChannelService();
    }
    return this.instance;
  }

  /**
   * Register a worklet node's port. Called when an AudioWorkletNode is created.
   */
  registerWorklet(nodeId: string, port: MessagePort): void {
    this.registeredPorts.set(nodeId, port);
    this.syncConnectionsForNode(nodeId);
  }

  /**
   * Unregister a worklet node. Called on destroy.
   */
  unregisterWorklet(nodeId: string): void {
    this.registeredPorts.delete(nodeId);

    // Recompute connections for nodes that were connected to this one
    for (const edge of this.edges) {
      if (edge.target === nodeId && this.registeredPorts.has(edge.source)) {
        this.syncConnectionsForNode(edge.source);
      }
    }
  }

  /**
   * Update edges and recompute all direct connections.
   */
  updateEdges(
    edges: Array<{
      source: string;
      target: string;
      sourceHandle?: string | null;
      targetHandle?: string | null;
    }>
  ): void {
    this.edges = edges;

    for (const nodeId of this.registeredPorts.keys()) {
      this.syncConnectionsForNode(nodeId);
    }
  }

  /**
   * Compute and send direct connections for a source worklet node.
   */
  private syncConnectionsForNode(sourceNodeId: string): void {
    const port = this.registeredPorts.get(sourceNodeId);
    if (!port) return;

    const connections: WorkletDirectConnection[] = [];

    for (const edge of this.edges) {
      if (edge.source !== sourceNodeId) continue;

      // Only include connections where target is also a registered worklet
      if (!this.registeredPorts.has(edge.target)) continue;

      // Skip audio and video edges
      if (
        edge.sourceHandle &&
        (edge.sourceHandle.startsWith('video-') || edge.sourceHandle.startsWith('audio-'))
      ) {
        continue;
      }

      const outlet = this.parseHandleIndex(edge.sourceHandle);
      const inlet = this.parseHandleIndex(edge.targetHandle);

      connections.push({
        outlet,
        targetNodeId: edge.target,
        inlet
      });
    }

    port.postMessage({
      type: 'update-direct-connections',
      connections
    });
  }

  private parseHandleIndex(handle?: string | null): number {
    if (!handle) return 0;

    const match = handle.match(/-(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }
}
