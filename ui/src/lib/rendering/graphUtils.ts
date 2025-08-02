import { type Edge as XYEdge } from '@xyflow/svelte';

// Utilities for building and analyzing render graphs

import type { RenderNode, RenderEdge, RenderGraph } from './types.js';
import { isFBOCompatible } from './types.js';

export type RNode = {
	id: string;
	type: string;
	data: Record<string, unknown>;
};

export type REdge = Pick<XYEdge, 'id' | 'source' | 'target'>;

/**
 * Filter nodes and edges to only include FBO-compatible nodes
 */
export function filterFBOCompatibleGraph(
	nodes: RNode[],
	edges: REdge[]
): { nodes: RenderNode[]; edges: RenderEdge[] } {
	// Filter to only GLSL nodes for now
	const compatibleNodes = nodes
		.filter((node) => isFBOCompatible(node.type))
		.map(
			(node): RenderNode => ({
				id: node.id,
				type: node.type,
				inputs: [],
				outputs: [],
				data: node.data as { code: string }
			})
		);

	const nodeIds = new Set(compatibleNodes.map((n) => n.id));

	// Filter edges to only connect compatible nodes
	const compatibleEdges = edges
		.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
		.map((edge) => ({
			id: edge.id,
			source: edge.source,
			target: edge.target
		}));

	// Build input/output relationships
	const nodeMap = new Map(compatibleNodes.map((n) => [n.id, n]));

	for (const edge of compatibleEdges) {
		const sourceNode = nodeMap.get(edge.source);
		const targetNode = nodeMap.get(edge.target);

		if (sourceNode && targetNode) {
			sourceNode.outputs.push(edge.target);
			targetNode.inputs.push(edge.source);
		}
	}

	return { nodes: compatibleNodes, edges: compatibleEdges };
}

/**
 * Topological sort of nodes to determine render order
 */
export function topologicalSort(nodes: RenderNode[]): string[] {
	const visited = new Set<string>();
	const visiting = new Set<string>();
	const result: string[] = [];
	const nodeMap = new Map(nodes.map((n) => [n.id, n]));

	function visit(nodeId: string): void {
		if (visiting.has(nodeId)) {
			throw new Error(`Circular dependency detected involving node ${nodeId}`);
		}

		if (visited.has(nodeId)) {
			return;
		}

		visiting.add(nodeId);

		const node = nodeMap.get(nodeId);
		if (node) {
			// Visit all input nodes first
			for (const inputId of node.inputs) {
				visit(inputId);
			}
		}

		visiting.delete(nodeId);
		visited.add(nodeId);
		result.push(nodeId);
	}

	// Visit all nodes
	for (const node of nodes) {
		if (!visited.has(node.id)) {
			visit(node.id);
		}
	}

	return result;
}

/**
 * Build a complete render graph from XYFlow nodes and edges
 */
export function buildRenderGraph(nodes: RNode[], edges: REdge[]): RenderGraph {
	const outputNodeId = findOutputNode(nodes, edges);

	const { nodes: renderNodes, edges: renderEdges } = filterFBOCompatibleGraph(nodes, edges);

	try {
		const sortedNodes = topologicalSort(renderNodes);

		return {
			nodes: renderNodes,
			edges: renderEdges,
			sortedNodes,
			outputNodeId
		};
	} catch (error) {
		return { nodes: [], edges: [], sortedNodes: [], outputNodeId: null };
	}
}

/**
 * Find nodes that need preview rendering (visible in UI)
 */
export function findPreviewNodes(renderGraph: RenderGraph): string[] {
	// For now, return all nodes - later we'll add visibility culling
	return renderGraph.nodes.map((n) => n.id);
}

/**
 * Find the output node (connected to bg.out)
 */
export function findOutputNode(nodes: RNode[], edges: REdge[]): string | null {
	// Find bg.out node
	const bgOutNode = nodes.find((node) => node.type === 'bg.out');
	if (!bgOutNode) return null;

	// Find edge connecting to bg.out
	const inputEdge = edges.find((edge) => edge.target === bgOutNode.id);
	if (!inputEdge) return null;

	return inputEdge.source;
}
