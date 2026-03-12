import type { Node, Edge, Viewport } from '@xyflow/svelte';
import type { CanvasContext } from './CanvasContext';
import type { NodeOperationsService } from './NodeOperationsService';
import type { AiObjectNode, SimplifiedEdge } from '$lib/ai/types';

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
  ): Promise<{ newNodes: Node[]; newEdges: Edge[] }> {
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

    return { newNodes: result.newNodes, newEdges: result.newEdges };
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

    this.ctx.nodes = this.ctx.nodes.map((node) => {
      if (node.id !== nodeId) return node;

      // Start with existing data
      const updatedData = { ...node.data };

      // Merge all fields from AI response except preserved ones
      // Also skip any fields starting with __ (internal convention)
      for (const [key, value] of Object.entries(data)) {
        if (!preservedFields.has(key) && !key.startsWith('__')) {
          updatedData[key] = value;
        }
      }

      // Add execution trigger if code was updated
      if (data.code !== undefined && data.code !== node.data.code) {
        updatedData.executeCode = Date.now();
      }

      return { ...node, data: updatedData };
    });
  }

  /**
   * Replace an existing node with a new type and data at the same position.
   * Attempts to re-connect edges whose handle IDs still exist on the new node (best-effort).
   */
  replaceNode(nodeId: string, newType: string, newData: Record<string, unknown>): void {
    const existingNode = this.ctx.nodes.find((n) => n.id === nodeId);
    if (!existingNode) return;

    // Capture position and connected edges before deletion
    const position = existingNode.position;
    const connectedEdges = this.ctx.edges.filter((e) => e.source === nodeId || e.target === nodeId);

    // Delete old node (also removes its connected edges via command system)
    this.nodeOps.deleteSelectedElements([nodeId], []);

    // Insert new node at same position
    const newNodeId = this.insertSingleObject(newType, newData, position);

    // Re-add edges with updated source/target pointing to new node
    const reconnectedEdges = connectedEdges.map((e) => ({
      ...e,
      id: `${e.id}-reconnected-${Date.now()}`,
      source: e.source === nodeId ? newNodeId : e.source,
      target: e.target === nodeId ? newNodeId : e.target
    }));

    this.ctx.edges = [...this.ctx.edges, ...reconnectedEdges];
  }

  /**
   * Check if Gemini API key exists in localStorage.
   */
  hasApiKey(): boolean {
    return !!localStorage.getItem('gemini-api-key');
  }
}
