import type { Command, CanvasStateAccessors } from '../types';

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
