import type { Edge, Node } from '@xyflow/svelte';

export const PATCH_SAVE_VERSION = '1.3';

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
		version: PATCH_SAVE_VERSION,
		timestamp: Date.now(),
		nodes,
		edges
	};

	return JSON.stringify(patch);
}
