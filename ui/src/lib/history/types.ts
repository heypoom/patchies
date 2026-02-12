import type { Node, Edge } from '@xyflow/svelte';

/**
 * A reversible command that can be executed and undone.
 */
export interface Command {
  /** Human-readable description for debugging */
  readonly description: string;

  /** Execute the command (also used for redo) */
  execute(): void;

  /** Reverse the command */
  undo(): void;
}

/**
 * Accessor functions for reading and writing canvas state.
 * Commands use these instead of direct state references since
 * nodes/edges are $state.raw in the component.
 */
export interface CanvasStateAccessors {
  getNodes: () => Node[];
  setNodes: (nodes: Node[]) => void;
  getEdges: () => Edge[];
  setEdges: (edges: Edge[]) => void;
}
