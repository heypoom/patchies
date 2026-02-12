import { describe, test, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/svelte';
import type { CanvasStateAccessors } from '../types';
import { AddEdgeCommand } from './add-edge.command';
import { AddEdgesCommand } from './add-edges.command';
import { DeleteEdgesCommand } from './delete-edges.command';

function createMockAccessors(
  initialNodes: Node[] = [],
  initialEdges: Edge[] = []
): CanvasStateAccessors {
  let nodes = [...initialNodes];
  let edges = [...initialEdges];

  return {
    getNodes: () => nodes,
    setNodes: (n: Node[]) => {
      nodes = n;
    },
    getEdges: () => edges,
    setEdges: (e: Edge[]) => {
      edges = e;
    }
  };
}

function createEdge(id: string, source: string, target: string): Edge {
  return { id, source, target };
}

describe('AddEdgeCommand', () => {
  test('execute adds edge, undo removes it', () => {
    const accessors = createMockAccessors();
    const edge = createEdge('e1', '1', '2');
    const cmd = new AddEdgeCommand(edge, accessors);

    cmd.execute();
    expect(accessors.getEdges()).toHaveLength(1);
    expect(accessors.getEdges()[0].id).toBe('e1');

    cmd.undo();
    expect(accessors.getEdges()).toHaveLength(0);
  });
});

describe('AddEdgesCommand', () => {
  test('execute adds multiple edges, undo removes them', () => {
    const accessors = createMockAccessors();
    const edges = [createEdge('e1', '1', '2'), createEdge('e2', '2', '3')];
    const cmd = new AddEdgesCommand(edges, accessors);

    cmd.execute();
    expect(accessors.getEdges()).toHaveLength(2);

    cmd.undo();
    expect(accessors.getEdges()).toHaveLength(0);
  });
});

describe('DeleteEdgesCommand', () => {
  test('execute deletes edges, undo restores them', () => {
    const edges = [createEdge('e1', '1', '2'), createEdge('e2', '2', '3')];
    const accessors = createMockAccessors([], edges);

    const cmd = new DeleteEdgesCommand([edges[0]], accessors);

    cmd.execute();
    expect(accessors.getEdges()).toHaveLength(1);
    expect(accessors.getEdges()[0].id).toBe('e2');

    cmd.undo();
    expect(accessors.getEdges()).toHaveLength(2);
  });
});
