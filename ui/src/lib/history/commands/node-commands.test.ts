import { describe, test, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/svelte';
import type { CanvasStateAccessors } from '../types';
import { AddNodeCommand } from './add-node.command';
import { AddNodesCommand } from './add-nodes.command';
import { DeleteNodesCommand } from './delete-nodes.command';
import { MoveNodesCommand } from './move-nodes.command';

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

function createNode(id: string, x = 0, y = 0): Node {
  return { id, type: 'js', position: { x, y }, data: {} };
}

function createEdge(id: string, source: string, target: string): Edge {
  return { id, source, target };
}

describe('AddNodeCommand', () => {
  test('execute adds node, undo removes it', () => {
    const accessors = createMockAccessors();
    const node = createNode('1');
    const cmd = new AddNodeCommand(node, accessors);

    cmd.execute();
    expect(accessors.getNodes()).toHaveLength(1);
    expect(accessors.getNodes()[0].id).toBe('1');

    cmd.undo();
    expect(accessors.getNodes()).toHaveLength(0);
  });
});

describe('AddNodesCommand', () => {
  test('execute adds multiple nodes, undo removes them', () => {
    const accessors = createMockAccessors();
    const nodes = [createNode('1'), createNode('2'), createNode('3')];
    const cmd = new AddNodesCommand(nodes, accessors);

    cmd.execute();
    expect(accessors.getNodes()).toHaveLength(3);

    cmd.undo();
    expect(accessors.getNodes()).toHaveLength(0);
  });
});

describe('DeleteNodesCommand', () => {
  test('execute deletes nodes and connected edges, undo restores both', () => {
    const nodes = [createNode('1'), createNode('2')];
    const edges = [createEdge('e1', '1', '2')];
    const accessors = createMockAccessors(nodes, edges);

    const cmd = new DeleteNodesCommand([nodes[0]], accessors);

    cmd.execute();
    expect(accessors.getNodes()).toHaveLength(1);
    expect(accessors.getNodes()[0].id).toBe('2');
    expect(accessors.getEdges()).toHaveLength(0);

    cmd.undo();
    expect(accessors.getNodes()).toHaveLength(2);
    expect(accessors.getEdges()).toHaveLength(1);
  });
});

describe('MoveNodesCommand', () => {
  test('execute moves nodes to new positions, undo restores old positions', () => {
    const nodes = [createNode('1', 0, 0), createNode('2', 10, 10)];
    const accessors = createMockAccessors(nodes);

    const oldPositions = new Map([
      ['1', { x: 0, y: 0 }],
      ['2', { x: 10, y: 10 }]
    ]);
    const newPositions = new Map([
      ['1', { x: 100, y: 100 }],
      ['2', { x: 200, y: 200 }]
    ]);

    const cmd = new MoveNodesCommand(oldPositions, newPositions, accessors);

    cmd.execute();
    expect(accessors.getNodes()[0].position).toEqual({ x: 100, y: 100 });
    expect(accessors.getNodes()[1].position).toEqual({ x: 200, y: 200 });

    cmd.undo();
    expect(accessors.getNodes()[0].position).toEqual({ x: 0, y: 0 });
    expect(accessors.getNodes()[1].position).toEqual({ x: 10, y: 10 });
  });
});
