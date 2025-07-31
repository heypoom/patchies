import { describe, it, expect } from 'vitest';
import { filterFBOCompatibleGraph, topologicalSort, buildRenderGraph } from './graphUtils.js';

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
		const nodes = [
			{ id: 'n1', type: 'glsl', inputs: [], outputs: ['n2'], data: {} },
			{ id: 'n2', type: 'glsl', inputs: ['n1'], outputs: ['n3'], data: {} },
			{ id: 'n3', type: 'glsl', inputs: ['n2'], outputs: [], data: {} }
		];

		const sorted = topologicalSort(nodes);
		expect(sorted).toEqual(['n1', 'n2', 'n3']);
	});

	it('should detect circular dependencies', () => {
		const nodes = [
			{ id: 'n1', type: 'glsl', inputs: ['n2'], outputs: ['n2'], data: {} },
			{ id: 'n2', type: 'glsl', inputs: ['n1'], outputs: ['n1'], data: {} }
		];

		expect(() => topologicalSort(nodes)).toThrow('Circular dependency');
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
	});
});
