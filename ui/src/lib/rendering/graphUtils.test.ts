import { describe, it, expect } from 'vitest';
import { filterFBOCompatibleGraph, topologicalSort, buildRenderGraph } from './graphUtils.js';
import type { RenderNode } from './types.js';

function makeNode(id: string, inputs: string[], outputs: string[]): RenderNode {
  return {
    id,
    type: 'glsl',
    inputs,
    outputs,
    inletMap: new Map(),
    backEdgeInlets: new Set(),
    data: { code: '', glUniformDefs: [] }
  };
}

describe('Graph Utils', () => {
  it('should filter FBO-compatible nodes', () => {
    const nodes = [
      { id: 'n1', type: 'glsl', data: { code: 'test' } },
      { id: 'n2', type: 'p5', data: { code: 'test' } },
      { id: 'n3', type: 'glsl', data: { code: 'test2' } }
    ];

    const edges = [
      { id: 'e1', source: 'n1', target: 'n3' },
      { id: 'e2', source: 'n2', target: 'n3' }
    ];

    const result = filterFBOCompatibleGraph(nodes, edges);

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes.map((n) => n.id)).toEqual(['n1', 'n3']);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].source).toBe('n1');
    expect(result.edges[0].target).toBe('n3');
  });

  it('should topologically sort nodes', () => {
    const nodes: RenderNode[] = [
      makeNode('n1', [], ['n2']),
      makeNode('n2', ['n1'], ['n3']),
      makeNode('n3', ['n2'], [])
    ];

    const { sortedNodes } = topologicalSort(nodes, []);
    expect(sortedNodes).toEqual(['n1', 'n2', 'n3']);
  });

  it('should handle feedback cycles with back-edges instead of throwing', () => {
    // n1 → n2 → n1 (cycle)
    const nodes: RenderNode[] = [makeNode('n1', ['n2'], ['n2']), makeNode('n2', ['n1'], ['n1'])];

    const edges = [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n1' }
    ];

    // Should not throw — cycles are handled as feedback loops
    const { sortedNodes, backEdgeIds, feedbackNodeIds } = topologicalSort(nodes, edges);

    expect(sortedNodes).toHaveLength(2);
    expect(backEdgeIds.size).toBe(1); // one back-edge breaks the cycle
    expect(feedbackNodeIds.size).toBe(1); // one node needs double-buffering
  });

  it('should build complete render graph', () => {
    const nodes = [
      { id: 'n1', type: 'glsl', data: { code: 'test' } },
      { id: 'n2', type: 'p5', data: { code: 'test' } },
      { id: 'n3', type: 'glsl', data: { code: 'test2' } }
    ];

    const edges = [{ id: 'e1', source: 'n1', target: 'n3' }];

    const graph = buildRenderGraph(nodes, edges);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.sortedNodes).toEqual(['n1', 'n3']);
    expect(graph.backEdges.size).toBe(0);
    expect(graph.feedbackNodes.size).toBe(0);
  });

  it('should annotate backEdgeInlets on feedback target nodes', () => {
    // A → B → C → A (cycle): C→A is the back-edge when visiting from A
    // Render order: DFS from A visits B (via A's input C... wait)
    // Simpler: A produces for B, B produces for A (cycle)
    // A.inputs=['B'], B.inputs=['A']
    // A.inletMap={0: 'B'}, B.inletMap={0: 'A'}
    const nodeA: RenderNode = {
      id: 'A',
      type: 'glsl',
      inputs: ['B'],
      outputs: ['B'],
      inletMap: new Map([[0, 'B']]),
      backEdgeInlets: new Set(),
      data: { code: '', glUniformDefs: [] }
    };

    const nodeB: RenderNode = {
      id: 'B',
      type: 'glsl',
      inputs: ['A'],
      outputs: ['A'],
      inletMap: new Map([[0, 'A']]),
      backEdgeInlets: new Set(),
      data: { code: '', glUniformDefs: [] }
    };

    const edges = [
      { id: 'e-AB', source: 'A', target: 'B' },
      { id: 'e-BA', source: 'B', target: 'A' }
    ];

    topologicalSort([nodeA, nodeB], edges);

    // Exactly one of the two nodes should have inlet 0 marked as a back-edge
    const totalBackEdgeInlets = nodeA.backEdgeInlets.size + nodeB.backEdgeInlets.size;
    expect(totalBackEdgeInlets).toBe(1);
  });
});
