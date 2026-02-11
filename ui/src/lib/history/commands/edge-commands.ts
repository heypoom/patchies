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

/**
 * Command to delete edges from the canvas.
 */
export class DeleteEdgesCommand implements Command {
  readonly description: string;

  constructor(
    private edges: Edge[],
    private accessors: CanvasStateAccessors
  ) {
    this.description = `Delete ${edges.length} connection${edges.length === 1 ? '' : 's'}`;
  }

  execute(): void {
    const edgeIds = new Set(this.edges.map((e) => e.id));
    this.accessors.setEdges(this.accessors.getEdges().filter((e) => !edgeIds.has(e.id)));
  }

  undo(): void {
    this.accessors.setEdges([...this.accessors.getEdges(), ...this.edges]);
  }
}
