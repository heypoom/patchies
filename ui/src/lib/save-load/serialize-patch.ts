import type { Edge, Node } from '@xyflow/svelte';

export const PATCH_VERSION = '1.2';

export type PatchSaveFormat = {
	name: string;
	version: string;
	timestamp: number;
	nodes: Node[];
	edges: Edge[];
};

export function serializePatch({
	name,
	nodes,
	edges
}: {
	name: string;
	nodes: Node[];
	edges: Edge[];
}) {
	const patch: PatchSaveFormat = {
		name,
		version: PATCH_VERSION,
		timestamp: Date.now(),
		nodes: nodes.map((node) => ({
			id: node.id,
			type: node.type,
			position: node.position,
			data: node.data || {}
		})),
		edges: edges.map((edge) => ({
			id: edge.id,
			source: edge.source,
			target: edge.target,
			sourceHandle: edge.sourceHandle,
			targetHandle: edge.targetHandle
		}))
	};

	return JSON.stringify(patch);
}
