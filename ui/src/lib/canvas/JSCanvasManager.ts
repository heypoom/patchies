import type { UserFnRunContext } from '$lib/messages/MessageContext';
import { GLSystem } from './GLSystem';

export interface JSCanvasConfig {
	code: string;
	messageContext?: UserFnRunContext;
}

export class JSCanvasManager {
	public nodeId: string;
	public glSystem = GLSystem.getInstance();

	constructor(nodeId: string) {
		this.nodeId = nodeId;
	}

	updateSketch(options: JSCanvasConfig) {
		try {
			const { code } = options;
			const isUpdated = this.glSystem.upsertNode(this.nodeId, 'canvas', { code });

			if (!isUpdated) {
				this.glSystem.send('updateCanvas', { nodeId: this.nodeId });
			}
		} catch (error) {
			console.error('Error updating canvas code:', error);
			throw error;
		}
	}

	destroy() {
		// Canvas is now managed by the worker thread, cleanup happens in GLSystem
		this.glSystem.removeNode(this.nodeId);
	}
}
