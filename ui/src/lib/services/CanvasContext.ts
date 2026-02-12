import type { Node, Edge } from '@xyflow/svelte';
import { HistoryManager, type CanvasStateAccessors } from '$lib/history';

export interface NodeAccessor {
  get: () => Node[];
  set: (nodes: Node[]) => void;
}

export interface EdgeAccessor {
  get: () => Edge[];
  set: (edges: Edge[]) => void;
}

/**
 * CanvasContext holds shared state and utilities for a single canvas instance.
 * This is instantiated per-component (not a singleton) to support future
 * headless API and multi-canvas scenarios.
 */
export class CanvasContext {
  private _nodeIdCounter = 0;
  private _edgeIdCounter = 0;

  readonly historyManager: HistoryManager;
  readonly canvasAccessors: CanvasStateAccessors;

  constructor(
    private nodeAccessor: NodeAccessor,
    private edgeAccessor: EdgeAccessor,
    historyManager?: HistoryManager
  ) {
    // For now, use singleton HistoryManager for backwards compatibility
    // In the future, this could be instantiated per-context
    this.historyManager = historyManager ?? HistoryManager.getInstance();

    // Create canvas accessors that delegate to our accessors
    this.canvasAccessors = {
      getNodes: () => this.nodes,
      setNodes: (nodes) => {
        this.nodes = nodes;
      },
      getEdges: () => this.edges,
      setEdges: (edges) => {
        this.edges = edges;
      }
    };
  }

  // --- Node/Edge Access ---

  get nodes(): Node[] {
    return this.nodeAccessor.get();
  }

  set nodes(newNodes: Node[]) {
    this.nodeAccessor.set(newNodes);
  }

  get edges(): Edge[] {
    return this.edgeAccessor.get();
  }

  set edges(newEdges: Edge[]) {
    this.edgeAccessor.set(newEdges);
  }

  // --- ID Generation ---

  nextNodeId(type: string): string {
    return `${type}-${this._nodeIdCounter++}`;
  }

  nextEdgeId(): string {
    return `edge-${this._edgeIdCounter++}`;
  }

  get nodeIdCounter(): number {
    return this._nodeIdCounter;
  }

  get edgeIdCounter(): number {
    return this._edgeIdCounter;
  }

  setNodeIdCounter(value: number): void {
    this._nodeIdCounter = value;
  }

  setEdgeIdCounter(value: number): void {
    this._edgeIdCounter = value;
  }

  /**
   * Parse node ID counter from saved nodes.
   * Used when restoring a patch to continue from the correct counter.
   */
  setNodeIdCounterFromNodes(nodes: Node[]): void {
    if (nodes.length === 0) {
      this._nodeIdCounter = 1;
      return;
    }

    const lastNodeId = parseInt(nodes.at(-1)?.id.match(/.*-(\d+)$/)?.[1] ?? '');
    if (isNaN(lastNodeId)) {
      throw new Error('corrupted save - cannot get last node id');
    }

    this._nodeIdCounter = lastNodeId + 1;
  }
}
