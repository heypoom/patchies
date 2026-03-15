import type { Node, Edge, Viewport } from '@xyflow/svelte';
import { toast } from 'svelte-sonner';
import type { CanvasContext } from './CanvasContext';
import type { NodeOperationsService } from './NodeOperationsService';
import type { AiObjectNode, SimplifiedEdge } from '$lib/ai/types';
import {
  AddNodeCommand,
  AddNodesCommand,
  AddEdgesCommand,
  DeleteEdgesCommand,
  DeleteNodesCommand,
  BatchCommand,
  ReplaceNodeDataCommand
} from '$lib/history/commands';

export interface MultiObjectInsertParams {
  objectNodes: AiObjectNode[];
  simplifiedEdges: SimplifiedEdge[];
}

/**
 * AiOperationsService handles AI-related node operations (insert, edit).
 * Instantiated per-component to support future headless/multi-canvas scenarios.
 */
export class AiOperationsService {
  constructor(
    private ctx: CanvasContext,
    private nodeOps: NodeOperationsService
  ) {}

  /**
   * Insert a single AI-generated object at the specified position.
   */
  insertSingleObject(type: string, data: unknown, position: { x: number; y: number }): string {
    return this.nodeOps.createNode(type, position, data);
  }

  /**
   * Insert multiple AI-generated objects with edges.
   * Returns a promise that resolves when all nodes and edges are inserted.
   *
   * @param params Object nodes and edges to insert
   * @param basePosition Center position for the group
   * @param viewport Current viewport for layout calculations
   * @param onNodesAdded Callback after nodes are added (for tick/DOM sync)
   */
  async insertMultipleObjects(
    params: MultiObjectInsertParams,
    basePosition: { x: number; y: number },
    viewport: Viewport,
    onNodesAdded: () => Promise<void>
  ): Promise<{ newNodes: Node[]; newEdges: Edge[]; invalidEdgeCount: number }> {
    const { handleMultiObjectInsert } = await import('$lib/ai/handle-multi-object-insert');

    const result = await handleMultiObjectInsert({
      objectNodes: params.objectNodes,
      simplifiedEdges: params.simplifiedEdges,
      basePosition,
      nodeIdCounter: this.ctx.nodeIdCounter,
      edgeIdCounter: this.ctx.edgeIdCounter,
      viewport
    });

    // Update counters
    this.ctx.setNodeIdCounter(result.nextNodeIdCounter);
    this.ctx.setEdgeIdCounter(result.nextEdgeIdCounter);

    // Add all new nodes first
    this.ctx.nodes = [...this.ctx.nodes, ...result.newNodes];

    // Wait for DOM to update
    await onNodesAdded();

    // Add all new edges after nodes are rendered
    this.ctx.edges = [...this.ctx.edges, ...result.newEdges];

    // Wait one more tick
    await onNodesAdded();

    // Record as a single undoable batch (mutations already applied above)
    this.ctx.historyManager.record(
      new BatchCommand(
        [
          new AddNodesCommand(result.newNodes, this.ctx.canvasAccessors),
          new AddEdgesCommand(result.newEdges, this.ctx.canvasAccessors)
        ],
        `AI insert ${result.newNodes.length} objects`
      )
    );

    if (result.invalidEdges.length > 0) {
      const n = result.invalidEdges.length;
      toast.warning(
        `${n} edge${n === 1 ? '' : 's'} had invalid handles and ${n === 1 ? 'was' : 'were'} skipped`,
        { description: 'You may need to connect some edges manually.' }
      );
    }

    return {
      newNodes: result.newNodes,
      newEdges: result.newEdges,
      invalidEdgeCount: result.invalidEdges.length
    };
  }

  /**
   * Edit an existing node with AI-generated data.
   * Preserves internal state fields and triggers code execution if code changed.
   */
  editNode(nodeId: string, data: Record<string, unknown>): void {
    // Define fields that should NOT be overwritten (internal state)
    const preservedFields = new Set([
      'name', // Internal node name, different from user-facing title
      'executeCode', // Internal execution trigger flag (timestamp)
      'initialized' // Internal initialization state
    ]);

    const existingNode = this.ctx.nodes.find((n) => n.id === nodeId);
    if (!existingNode) return;

    const oldData = { ...existingNode.data };

    // Start with existing data
    const updatedData = { ...existingNode.data };

    // Merge all fields from AI response except preserved ones
    // Also skip any fields starting with __ (internal convention)
    for (const [key, value] of Object.entries(data)) {
      if (!preservedFields.has(key) && !key.startsWith('__')) {
        updatedData[key] = value;
      }
    }

    // Add execution trigger if code was updated
    if (data.code !== undefined && data.code !== existingNode.data.code) {
      updatedData.executeCode = Date.now();
    }

    this.ctx.nodes = this.ctx.nodes.map((node) =>
      node.id === nodeId ? { ...node, data: updatedData } : node
    );

    this.ctx.historyManager.record(
      new ReplaceNodeDataCommand(nodeId, oldData, updatedData, this.ctx.canvasAccessors)
    );
  }

  /**
   * Replace an existing node with a new type and data at the same position.
   * Attempts to re-connect edges whose handle IDs still exist on the new node (best-effort).
   * Recorded as a single atomic undo/redo entry.
   */
  replaceNode(nodeId: string, newType: string, newData: Record<string, unknown>): void {
    const existingNode = this.ctx.nodes.find((n) => n.id === nodeId);
    if (!existingNode) return;

    const position = existingNode.position;

    // Capture connected edges BEFORE deletion
    const connectedEdges = this.ctx.edges.filter((e) => e.source === nodeId || e.target === nodeId);

    // Build delete command — also captures connected edges internally for undo
    const deleteCmd = new DeleteNodesCommand([existingNode], this.ctx.canvasAccessors);

    // Build new node
    const newNodeId = this.ctx.nextNodeId(newType);
    const newNode: Node = {
      id: newNodeId,
      type: newType,
      position,
      data: newData
    };
    const addNodeCmd = new AddNodeCommand(newNode, this.ctx.canvasAccessors);

    // Execute delete + create (mutations applied directly, not recorded separately)
    deleteCmd.execute();
    addNodeCmd.execute();

    // Re-add reconnected edges pointing to the new node
    const reconnectedEdges = connectedEdges.map((e) => ({
      ...e,
      id: `${e.id}-reconnected-${Date.now()}`,
      source: e.source === nodeId ? newNodeId : e.source,
      target: e.target === nodeId ? newNodeId : e.target
    }));

    const addEdgesCmd = new AddEdgesCommand(reconnectedEdges, this.ctx.canvasAccessors);
    if (reconnectedEdges.length > 0) {
      addEdgesCmd.execute();
    }

    // Record as one atomic batch
    this.ctx.historyManager.record(
      new BatchCommand([deleteCmd, addNodeCmd, addEdgesCmd], `Replace with ${newType}`)
    );
  }

  /**
   * Connect existing nodes by adding edges.
   * Recorded as a single undoable entry.
   */
  connectEdges(edges: Edge[]): void {
    if (edges.length === 0) return;

    this.ctx.edges = [...this.ctx.edges, ...edges];

    this.ctx.historyManager.record(new AddEdgesCommand(edges, this.ctx.canvasAccessors));
  }

  /**
   * Disconnect edges by removing them from the canvas.
   * Recorded as a single undoable entry.
   */
  disconnectEdges(edgeIds: string[]): void {
    if (edgeIds.length === 0) return;

    const idSet = new Set(edgeIds);
    const edgesToRemove = this.ctx.edges.filter((e) => idSet.has(e.id));
    if (edgesToRemove.length === 0) return;

    this.ctx.edges = this.ctx.edges.filter((e) => !idSet.has(e.id));

    this.ctx.historyManager.record(new DeleteEdgesCommand(edgesToRemove, this.ctx.canvasAccessors));
  }

  /**
   * Check if Gemini API key exists in localStorage.
   */
  hasApiKey(): boolean {
    return !!localStorage.getItem('gemini-api-key');
  }
}
