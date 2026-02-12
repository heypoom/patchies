import type { Node } from '@xyflow/svelte';
import type { Command, CanvasStateAccessors } from '../types';

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
