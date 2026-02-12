import type { Node, Edge } from '@xyflow/svelte';
import type { Command, CanvasStateAccessors } from '../types';

/**
 * Command to delete nodes from the canvas.
 * Also tracks edges that get deleted as a side effect.
 */
export class DeleteNodesCommand implements Command {
  readonly description: string;
  private deletedEdges: Edge[] = [];

  constructor(
    private nodes: Node[],
    private accessors: CanvasStateAccessors
  ) {
    this.description = `Delete ${nodes.length} node${nodes.length === 1 ? '' : 's'}`;

    // Capture edges that will be deleted (connected to these nodes)
    const nodeIds = new Set(nodes.map((n) => n.id));
    this.deletedEdges = accessors
      .getEdges()
      .filter((e) => nodeIds.has(e.source) || nodeIds.has(e.target));
  }

  execute(): void {
    const nodeIds = new Set(this.nodes.map((n) => n.id));

    this.accessors.setNodes(this.accessors.getNodes().filter((n) => !nodeIds.has(n.id)));
    this.accessors.setEdges(
      this.accessors.getEdges().filter((e) => !nodeIds.has(e.source) && !nodeIds.has(e.target))
    );
  }

  undo(): void {
    // Restore nodes
    this.accessors.setNodes([...this.accessors.getNodes(), ...this.nodes]);

    // Restore edges that were deleted as a side effect
    this.accessors.setEdges([...this.accessors.getEdges(), ...this.deletedEdges]);
  }
}
