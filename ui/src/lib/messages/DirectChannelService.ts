/**
 * DirectChannelService manages direct MessageChannel connections between
 * worker-based nodes, bypassing the main thread for message routing.
 *
 * Supports:
 * - Worker → Render Worker (canvas, three, hydra, textmode)
 * - Worker → Worker (direct peer-to-peer)
 *
 * Any worker-based node system (WorkerNodeSystem, future WasmNodeSystem, etc.)
 * can register their workers with this service.
 */

import { GLSystem } from '$lib/canvas/GLSystem';

export interface DirectConnection {
  outlet: number;
  targetNodeId: string;
  inlet: number;
  inletKey?: string;
}

/** Render node types that live in the render worker */
const RENDER_NODE_TYPES = new Set(['canvas', 'three', 'hydra', 'textmode']);

/** Worker node types that have their own Web Worker */
const WORKER_NODE_TYPES = new Set(['worker', 'ruby']);

export class DirectChannelService {
  private static instance: DirectChannelService;

  /** Registered workers that can use direct channels */
  private registeredWorkers = new Map<string, Worker>();

  /** Workers that have active render channels */
  private workersWithRenderChannels = new Set<string>();

  /** Worker-to-worker channels: Map<"sourceId->targetId", true> */
  private workerToWorkerChannels = new Set<string>();

  /** Current edge state for computing connections */
  private edges: Array<{
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }> = [];

  /** Node type lookup (populated from flow graph) */
  private nodeTypes = new Map<string, string>();

  static getInstance(): DirectChannelService {
    if (!this.instance) {
      this.instance = new DirectChannelService();
    }

    return this.instance;
  }

  /**
   * Register a worker-based node. Called by any node system that manages workers.
   */
  registerWorker(nodeId: string, worker: Worker): void {
    this.registeredWorkers.set(nodeId, worker);

    // Check if this worker already has connections
    this.setupChannelsForWorker(nodeId);
    this.syncConnectionsToWorker(nodeId);
  }

  /**
   * Unregister a worker node. Cleans up channels.
   */
  unregisterWorker(nodeId: string): void {
    this.registeredWorkers.delete(nodeId);

    // Clean up render channel
    if (this.workersWithRenderChannels.has(nodeId)) {
      this.workersWithRenderChannels.delete(nodeId);
      GLSystem.getInstance().unregisterWorkerRenderPort(nodeId);
    }

    // Clean up worker-to-worker channels (both directions)
    for (const channelKey of this.workerToWorkerChannels) {
      if (channelKey.startsWith(`${nodeId}->`) || channelKey.endsWith(`->${nodeId}`)) {
        this.workerToWorkerChannels.delete(channelKey);
      }
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

    // For each registered worker, check if it needs channels or connection updates
    for (const nodeId of this.registeredWorkers.keys()) {
      this.setupChannelsForWorker(nodeId);
      this.syncConnectionsToWorker(nodeId);
    }
  }

  /**
   * Set up all necessary channels for a worker (render and worker-to-worker).
   */
  private setupChannelsForWorker(nodeId: string): void {
    // Set up render channel if needed
    if (this.hasRenderConnections(nodeId) && !this.workersWithRenderChannels.has(nodeId)) {
      this.setupRenderChannel(nodeId);
    }

    // Set up worker-to-worker channels if needed
    const workerTargets = this.getWorkerTargets(nodeId);

    for (const targetId of workerTargets) {
      this.setupWorkerToWorkerChannel(nodeId, targetId);
    }
  }

  private hasRenderConnections(nodeId: string): boolean {
    return this.edges.some((edge) => {
      if (edge.source !== nodeId) return false;

      const targetType = this.nodeTypes.get(edge.target);

      return targetType !== undefined && RENDER_NODE_TYPES.has(targetType);
    });
  }

  private getWorkerTargets(nodeId: string): string[] {
    const targets: string[] = [];

    for (const edge of this.edges) {
      if (edge.source !== nodeId) continue;

      const targetType = this.nodeTypes.get(edge.target);

      if (targetType && WORKER_NODE_TYPES.has(targetType)) {
        if (!targets.includes(edge.target)) {
          targets.push(edge.target);
        }
      }
    }

    return targets;
  }

  private setupRenderChannel(nodeId: string): void {
    const worker = this.registeredWorkers.get(nodeId);
    if (!worker || this.workersWithRenderChannels.has(nodeId)) return;

    const channel = new MessageChannel();

    // Transfer port1 to source worker
    worker.postMessage({ type: 'setRenderPort', nodeId }, [channel.port1]);

    // Transfer port2 to render worker
    GLSystem.getInstance().registerWorkerRenderPort(nodeId, channel.port2);

    this.workersWithRenderChannels.add(nodeId);
  }

  private setupWorkerToWorkerChannel(sourceId: string, targetId: string): void {
    const channelKey = `${sourceId}->${targetId}`;

    // Already set up
    if (this.workerToWorkerChannels.has(channelKey)) return;

    const sourceWorker = this.registeredWorkers.get(sourceId);
    const targetWorker = this.registeredWorkers.get(targetId);

    // Both workers must be registered
    if (!sourceWorker || !targetWorker) return;

    const channel = new MessageChannel();

    // Send port1 to source worker (for sending to target)
    sourceWorker.postMessage({ type: 'setWorkerPort', nodeId: sourceId, targetNodeId: targetId }, [
      channel.port1
    ]);

    // Send port2 to target worker (for receiving from source)
    targetWorker.postMessage({ type: 'setWorkerPort', nodeId: targetId, sourceNodeId: sourceId }, [
      channel.port2
    ]);

    this.workerToWorkerChannels.add(channelKey);
  }

  private syncConnectionsToWorker(nodeId: string): void {
    const worker = this.registeredWorkers.get(nodeId);
    if (!worker) return;

    const renderConnections: DirectConnection[] = [];
    const workerConnections: DirectConnection[] = [];

    for (const edge of this.edges) {
      if (edge.source !== nodeId) continue;

      const targetType = this.nodeTypes.get(edge.target);
      if (!targetType) continue;

      const outlet = this.parseHandleIndex(edge.sourceHandle);
      const inlet = this.parseHandleIndex(edge.targetHandle);

      const connection: DirectConnection = {
        outlet,
        targetNodeId: edge.target,
        inlet,
        inletKey: edge.targetHandle ?? undefined
      };

      if (RENDER_NODE_TYPES.has(targetType)) {
        renderConnections.push(connection);
      } else if (WORKER_NODE_TYPES.has(targetType)) {
        workerConnections.push(connection);
      }
    }

    // Send render connections (uses single shared port to render worker)
    worker.postMessage({
      type: 'updateRenderConnections',
      nodeId,
      connections: renderConnections
    });

    // Send worker connections (uses per-target ports)
    worker.postMessage({
      type: 'updateWorkerConnections',
      nodeId,
      connections: workerConnections
    });
  }

  private parseHandleIndex(handle?: string | null): number {
    if (!handle) return 0;

    // Extract number from end of handle string (e.g., "message-out-2" → 2)
    const match = handle.match(/-(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }
}

// Re-export with old name for backwards compatibility during migration
export { DirectChannelService as RenderChannelService };
