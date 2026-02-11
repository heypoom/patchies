import type { Node, Edge } from '@xyflow/svelte';
import type { Command, CanvasStateAccessors } from '../types';

/**
 * Command to add a single node to the canvas.
 */
export class AddNodeCommand implements Command {
  readonly description: string;

  constructor(
    private node: Node,
    private accessors: CanvasStateAccessors
  ) {
    this.description = `Add ${node.type}`;
  }

  execute(): void {
    this.accessors.setNodes([...this.accessors.getNodes(), this.node]);
  }

  undo(): void {
    this.accessors.setNodes(this.accessors.getNodes().filter((n) => n.id !== this.node.id));
  }
}

/**
 * Command to add multiple nodes at once.
 */
export class AddNodesCommand implements Command {
  readonly description: string;

  constructor(
    private nodes: Node[],
    private accessors: CanvasStateAccessors
  ) {
    this.description = `Add ${nodes.length} node${nodes.length === 1 ? '' : 's'}`;
  }

  execute(): void {
    this.accessors.setNodes([...this.accessors.getNodes(), ...this.nodes]);
  }

  undo(): void {
    const nodeIds = new Set(this.nodes.map((n) => n.id));
    this.accessors.setNodes(this.accessors.getNodes().filter((n) => !nodeIds.has(n.id)));
  }
}

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

/**
 * Command to move nodes to new positions.
 * Used after drag operations complete.
 */
export class MoveNodesCommand implements Command {
  readonly description: string;

  constructor(
    private oldPositions: Map<string, { x: number; y: number }>,
    private newPositions: Map<string, { x: number; y: number }>,
    private accessors: CanvasStateAccessors
  ) {
    const count = oldPositions.size;
    this.description = `Move ${count} node${count === 1 ? '' : 's'}`;
  }

  execute(): void {
    this.accessors.setNodes(
      this.accessors.getNodes().map((node) => {
        const newPos = this.newPositions.get(node.id);
        return newPos ? { ...node, position: newPos } : node;
      })
    );
  }

  undo(): void {
    this.accessors.setNodes(
      this.accessors.getNodes().map((node) => {
        const oldPos = this.oldPositions.get(node.id);
        return oldPos ? { ...node, position: oldPos } : node;
      })
    );
  }
}
