import type { Node } from '@xyflow/svelte';
import type { CanvasStateAccessors, Command } from '../types';

/**
 * Command to atomically replace the canvas node list.
 * Useful for structural edits such as grouping that update parent/child relationships.
 */
export class ReplaceNodesCommand implements Command {
  constructor(
    private oldNodes: Node[],
    private newNodes: Node[],
    private accessors: CanvasStateAccessors,
    readonly description: string
  ) {}

  execute(): void {
    this.accessors.setNodes(this.newNodes);
  }

  undo(): void {
    this.accessors.setNodes(this.oldNodes);
  }
}
