import type { Node, Edge } from '@xyflow/svelte';
import { match } from 'ts-pattern';
import { toast } from 'svelte-sonner';
import { AddNodesCommand, AddEdgesCommand, BatchCommand, type Command } from '$lib/history';
import type { CanvasContext } from './CanvasContext';

interface CopiedNodeData {
  originalId: string;
  type: string;
  data: Record<string, unknown>;
  relativePosition: { x: number; y: number };
}

interface CopiedEdgeData {
  sourceIdx: number;
  targetIdx: number;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface CopiedData {
  nodes: CopiedNodeData[];
  edges: CopiedEdgeData[];
}

export interface CopyResult {
  nodeCount: number;
  edgeCount: number;
}

export interface PasteResult {
  nodeCount: number;
  edgeCount: number;
  newNodeIds: string[];
}

/**
 * ClipboardManager handles copy/paste operations for canvas nodes and edges.
 * Instantiated per-component to support future headless/multi-canvas scenarios.
 */
export class ClipboardManager {
  private copiedData: CopiedData | null = null;

  constructor(private ctx: CanvasContext) {}

  /**
   * Copy selected nodes and their connecting edges to clipboard.
   * @param selectedNodeIds IDs of nodes to copy
   * @returns Copy result with counts, or null if nothing to copy
   */
  copy(selectedNodeIds: string[]): CopyResult | null {
    if (selectedNodeIds.length === 0) return null;

    const nodes = this.ctx.nodes;
    const edges = this.ctx.edges;

    const selectedNodes = nodes.filter((node) => selectedNodeIds.includes(node.id) && node.type);
    if (selectedNodes.length === 0) return null;

    // Calculate the center point of all selected nodes
    const centerX =
      selectedNodes.reduce((sum, node) => sum + node.position.x, 0) / selectedNodes.length;
    const centerY =
      selectedNodes.reduce((sum, node) => sum + node.position.y, 0) / selectedNodes.length;

    // Create a map of node ID to index for edge remapping
    const nodeIdToIdx = new Map(selectedNodes.map((node, idx) => [node.id, idx]));

    // Store nodes with their relative positions from the center
    const copiedNodes: CopiedNodeData[] = selectedNodes.map((node) => ({
      originalId: node.id,
      type: node.type!,
      data: { ...node.data } as Record<string, unknown>,
      relativePosition: {
        x: node.position.x - centerX,
        y: node.position.y - centerY
      }
    }));

    // Find edges where both source and target are in the selection
    const copiedEdges: CopiedEdgeData[] = edges
      .filter((edge) => nodeIdToIdx.has(edge.source) && nodeIdToIdx.has(edge.target))
      .map((edge) => ({
        sourceIdx: nodeIdToIdx.get(edge.source)!,
        targetIdx: nodeIdToIdx.get(edge.target)!,
        sourceHandle: edge.sourceHandle ?? undefined,
        targetHandle: edge.targetHandle ?? undefined
      }));

    this.copiedData = { nodes: copiedNodes, edges: copiedEdges };

    const result = { nodeCount: copiedNodes.length, edgeCount: copiedEdges.length };

    // Show toast
    const edgeText =
      result.edgeCount > 0
        ? ` and ${result.edgeCount} edge${result.edgeCount === 1 ? '' : 's'}`
        : '';
    toast.success(`Copied ${result.nodeCount} node${result.nodeCount === 1 ? '' : 's'}${edgeText}`);

    return result;
  }

  /**
   * Paste copied nodes at the specified position.
   * @param position Flow coordinates where center of pasted nodes will be placed
   * @param source Whether paste was triggered by keyboard or button (affects position calculation)
   * @returns Paste result with counts and new node IDs, or null if nothing to paste
   */
  paste(
    screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number },
    source: 'keyboard' | 'button',
    mousePosition: { x: number; y: number }
  ): PasteResult | null {
    if (!this.copiedData || this.copiedData.nodes.length === 0) return null;

    // Get the paste position (where the center of the copied nodes will be placed)
    const pastePosition = match(source)
      .with('keyboard', () => screenToFlowPosition(mousePosition))
      .with('button', () => {
        const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 500;
        const centerY = typeof window !== 'undefined' ? window.innerHeight / 2 : 300;
        return screenToFlowPosition({ x: centerX, y: centerY });
      })
      .exhaustive();

    // Build all new nodes first
    const newNodes: Node[] = [];
    const newNodeIds: string[] = [];

    for (const nodeData of this.copiedData.nodes) {
      const id = this.ctx.nextNodeId(nodeData.type);
      const position = {
        x: pastePosition.x + nodeData.relativePosition.x,
        y: pastePosition.y + nodeData.relativePosition.y
      };

      newNodes.push({
        id,
        type: nodeData.type,
        position,
        data: { ...nodeData.data }
      });
      newNodeIds.push(id);
    }

    // Build all new edges
    const newEdges: Edge[] = this.copiedData.edges.map((edgeData) => ({
      id: this.ctx.nextEdgeId(),
      source: newNodeIds[edgeData.sourceIdx],
      target: newNodeIds[edgeData.targetIdx],
      sourceHandle: edgeData.sourceHandle,
      targetHandle: edgeData.targetHandle
    }));

    // Execute as a single batch command
    const commands: Command[] = [];
    if (newNodes.length > 0) {
      commands.push(new AddNodesCommand(newNodes, this.ctx.canvasAccessors));
    }
    if (newEdges.length > 0) {
      commands.push(new AddEdgesCommand(newEdges, this.ctx.canvasAccessors));
    }

    const nodeCount = newNodes.length;
    const edgeCount = newEdges.length;
    const description = `Paste ${nodeCount} node${nodeCount === 1 ? '' : 's'}`;

    if (commands.length === 1) {
      this.ctx.historyManager.execute(commands[0]);
    } else {
      this.ctx.historyManager.execute(new BatchCommand(commands, description));
    }

    // Show toast
    const edgeText = edgeCount > 0 ? ` and ${edgeCount} edge${edgeCount === 1 ? '' : 's'}` : '';
    toast.success(`Pasted ${nodeCount} node${nodeCount === 1 ? '' : 's'}${edgeText}`);

    return { nodeCount, edgeCount, newNodeIds };
  }

  /**
   * Check if there's data available to paste.
   */
  hasCopiedData(): boolean {
    return this.copiedData !== null && this.copiedData.nodes.length > 0;
  }

  /**
   * Get the current copied data (for UI display purposes).
   */
  getCopiedData(): CopiedData | null {
    return this.copiedData;
  }
}
