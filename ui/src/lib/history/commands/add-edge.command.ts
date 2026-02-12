import type { Edge } from '@xyflow/svelte';
import type { Command, CanvasStateAccessors } from '../types';

/**
 * Command to add a single edge (connection) to the canvas.
 */
export class AddEdgeCommand implements Command {
  readonly description: string;

  constructor(
    private edge: Edge,
    private accessors: CanvasStateAccessors
  ) {
    this.description = `Connect`;
  }

  execute(): void {
    this.accessors.setEdges([...this.accessors.getEdges(), this.edge]);
  }

  undo(): void {
    this.accessors.setEdges(this.accessors.getEdges().filter((e) => e.id !== this.edge.id));
  }
}
