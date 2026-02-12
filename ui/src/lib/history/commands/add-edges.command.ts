import type { Edge } from '@xyflow/svelte';
import type { Command, CanvasStateAccessors } from '../types';

/**
 * Command to add multiple edges at once.
 */
export class AddEdgesCommand implements Command {
  readonly description: string;

  constructor(
    private edges: Edge[],
    private accessors: CanvasStateAccessors
  ) {
    this.description = `Add ${edges.length} connection${edges.length === 1 ? '' : 's'}`;
  }

  execute(): void {
    this.accessors.setEdges([...this.accessors.getEdges(), ...this.edges]);
  }

  undo(): void {
    const edgeIds = new Set(this.edges.map((e) => e.id));
    this.accessors.setEdges(this.accessors.getEdges().filter((e) => !edgeIds.has(e.id)));
  }
}
