import type { Node } from '@xyflow/svelte';
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
