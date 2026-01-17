import type { Migration } from '../types';

/**
 * Migration 001: MessageNode inlet handle IDs
 *
 * Before: MessageNode had various formats:
 *   - message-in (original single inlet)
 *   - message-in-1 (brief 1-based indexing period)
 *
 * After: MessageNode uses consistent 0-based indexing:
 *   - message-in-0 (hot inlet, bang or $1)
 *   - message-in-1 ($2 inlet, cold) - only if $2 exists
 *   - etc.
 *
 * This migration converts old handle formats to 0-based indexing.
 */
export const migration001: Migration = {
	version: 1,
	name: 'message-node-inlet-indexing',

	migrate(patch) {
		if (!patch.nodes || !patch.edges) return patch;

		const messageNodeIds = new Set(
			patch.nodes.filter((node) => node.type === 'msg').map((node) => node.id)
		);

		const migratedEdges = patch.edges.map((edge) => {
			if (!messageNodeIds.has(edge.target)) return edge;

			// Convert message-in -> message-in-0
			if (edge.targetHandle === 'message-in') {
				return {
					...edge,
					targetHandle: 'message-in-0',
					id: edge.id.replace('message-in', 'message-in-0')
				};
			}

			// Convert 1-based to 0-based: message-in-1 -> message-in-0, message-in-2 -> message-in-1, etc.
			const match = edge.targetHandle?.match(/^message-in-(\d+)$/);

			if (match) {
				const oldIndex = parseInt(match[1], 10);
				const newIndex = oldIndex - 1;

				if (newIndex >= 0) {
					return {
						...edge,
						targetHandle: `message-in-${newIndex}`,
						id: edge.id.replace(`message-in-${oldIndex}`, `message-in-${newIndex}`)
					};
				}
			}

			return edge;
		});

		return { ...patch, edges: migratedEdges };
	}
};
