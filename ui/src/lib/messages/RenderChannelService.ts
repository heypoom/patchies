/**
 * RenderChannelService manages direct MessageChannel connections between
 * worker-based nodes and the render worker, bypassing the main thread.
 *
 * Any worker-based node system (WorkerNodeSystem, future WasmNodeSystem, etc.)
 * can register their workers with this service to enable direct messaging
 * to render nodes (canvas, three, hydra, textmode).
 */

import { GLSystem } from '$lib/canvas/GLSystem';

export interface RenderConnection {
  outlet: number;
  targetNodeId: string;
  inlet: number;
  inletKey?: string;
}

/** Render node types that live in the render worker */
const RENDER_NODE_TYPES = new Set(['canvas', 'three', 'hydra', 'textmode']);

export class RenderChannelService {
  private static instance: RenderChannelService;

  /** Registered workers that can use direct channels */
  private registeredWorkers = new Map<string, Worker>();

  /** Workers that have active render channels */
  private workersWithChannels = new Set<string>();

  /** Current edge state for computing connections */
  private edges: Array<{
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }> = [];

  /** Node type lookup (populated from flow graph) */
  private nodeTypes = new Map<string, string>();

  static getInstance(): RenderChannelService {
    if (!this.instance) {
      this.instance = new RenderChannelService();
    }
    return this.instance;
  }

  /**
   * Register a worker-based node. Called by any node system that manages workers.
   */
  registerWorker(nodeId: string, worker: Worker): void {
    this.registeredWorkers.set(nodeId, worker);

    // Check if this worker already has render connections
    if (this.hasRenderConnections(nodeId)) {
      this.setupChannel(nodeId);
      this.syncConnectionsToWorker(nodeId);
    }
  }

  /**
   * Unregister a worker node. Cleans up channels.
   */
  unregisterWorker(nodeId: string): void {
    this.registeredWorkers.delete(nodeId);

    if (this.workersWithChannels.has(nodeId)) {
      this.workersWithChannels.delete(nodeId);
      GLSystem.getInstance().unregisterWorkerRenderPort(nodeId);
    }
  }

  /**
   * Update node types from flow graph.
   */
  updateNodeTypes(nodes: Array<{ id: string; type: string }>): void {
    this.nodeTypes.clear();
    for (const node of nodes) {
      this.nodeTypes.set(node.id, node.type);
    }
  }

  /**
   * Update edges and sync connections to all affected workers.
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

    // For each registered worker, check if it needs a channel or connection update
    for (const nodeId of this.registeredWorkers.keys()) {
      const hasRenderConns = this.hasRenderConnections(nodeId);

      if (hasRenderConns && !this.workersWithChannels.has(nodeId)) {
        // New render connection - set up channel
        this.setupChannel(nodeId);
      }

      if (hasRenderConns) {
        // Sync current connections
        this.syncConnectionsToWorker(nodeId);
      } else if (this.workersWithChannels.has(nodeId)) {
        // No render connections anymore - send empty connections
        // (keep channel alive for potential reconnection)
        this.syncConnectionsToWorker(nodeId);
      }
    }
  }

  private hasRenderConnections(nodeId: string): boolean {
    return this.edges.some((edge) => {
      if (edge.source !== nodeId) return false;
      const targetType = this.nodeTypes.get(edge.target);
      return targetType !== undefined && RENDER_NODE_TYPES.has(targetType);
    });
  }

  private setupChannel(nodeId: string): void {
    const worker = this.registeredWorkers.get(nodeId);
    if (!worker || this.workersWithChannels.has(nodeId)) return;

    const channel = new MessageChannel();

    // Transfer port1 to source worker
    worker.postMessage({ type: 'setRenderPort', nodeId }, [channel.port1]);

    // Transfer port2 to render worker
    GLSystem.getInstance().registerWorkerRenderPort(nodeId, channel.port2);

    this.workersWithChannels.add(nodeId);
  }

  private syncConnectionsToWorker(nodeId: string): void {
    const worker = this.registeredWorkers.get(nodeId);
    if (!worker) return;

    const connections: RenderConnection[] = [];

    for (const edge of this.edges) {
      if (edge.source !== nodeId) continue;

      const targetType = this.nodeTypes.get(edge.target);
      if (!targetType || !RENDER_NODE_TYPES.has(targetType)) continue;

      // Parse outlet from sourceHandle (e.g., "message-out-0" → 0)
      const outlet = this.parseHandleIndex(edge.sourceHandle);
      const inlet = this.parseHandleIndex(edge.targetHandle);

      connections.push({
        outlet,
        targetNodeId: edge.target,
        inlet,
        inletKey: edge.targetHandle ?? undefined
      });
    }

    worker.postMessage({
      type: 'updateRenderConnections',
      nodeId,
      connections
    });
  }

  private parseHandleIndex(handle?: string | null): number {
    if (!handle) return 0;
    // Extract number from end of handle string (e.g., "message-out-2" → 2)
    const match = handle.match(/-(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }
}
