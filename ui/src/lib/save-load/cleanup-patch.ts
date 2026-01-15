import type { Node } from '@xyflow/svelte';
import { MessageSystem } from '$lib/messages/MessageSystem';
import { GLSystem } from '$lib/canvas/GLSystem';
import { AudioService } from '$lib/audio/v2/AudioService';
import { AudioAnalysisSystem } from '$lib/audio/AudioAnalysisSystem';

/**
 * Cleans up all nodes and edges from the patch systems.
 *
 * This is necessary because Svelte batches state updates, so setting
 * nodes = [] followed by nodes = newNodes won't trigger $effect cleanup.
 * We need to explicitly clean up all nodes before loading a new patch.
 */
export function cleanupPatch(nodes: Node[]) {
	const messageSystem = MessageSystem.getInstance();
	const glSystem = GLSystem.getInstance();
	const audioService = AudioService.getInstance();
	const audioAnalysisSystem = AudioAnalysisSystem.getInstance();

	// Clean up all nodes from all services
	for (const node of nodes) {
		messageSystem.unregisterNode(node.id);
		glSystem.removeNode(node.id);

		const audioNode = audioService.getNodeById(node.id);
		if (audioNode) audioService.removeNode(audioNode);
	}

	// Clear edges in all systems explicitly
	messageSystem.updateEdges([]);
	glSystem.updateEdges([]);
	audioService.updateEdges([]);
	audioAnalysisSystem.updateEdges([]);
}
