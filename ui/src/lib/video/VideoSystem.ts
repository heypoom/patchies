/**
 * VideoSystem manages HTMLCanvasElement connections between video nodes
 * for the visual chaining feature.
 */
export class VideoSystem {
	private static instance: VideoSystem;

	// sourceNodeId -> [targetNodeIds]
	private videoConnections = new Map<string, string[]>();

	// nodeId -> HTMLCanvasElement
	private canvasSources = new Map<string, HTMLCanvasElement>();

	// nodeId -> callbacks
	private canvasCallbacks = new Map<string, ((canvases: HTMLCanvasElement[]) => void)[]>();

	private constructor() {}

	static getInstance(): VideoSystem {
		if (!VideoSystem.instance) {
			VideoSystem.instance = new VideoSystem();
		}

		// @ts-expect-error -- expose globally for debugging
		window.videoSystem = VideoSystem.instance;

		return VideoSystem.instance;
	}

	/**
	 * Register a node's canvas as a video source
	 */
	registerVideoSource(nodeId: string, canvas: HTMLCanvasElement): void {
		this.canvasSources.set(nodeId, canvas);
		this.notifyTargets(nodeId);
	}

	/**
	 * Update video connections when XYFlow connections change
	 */
	updateVideoConnections(
		connections: Array<{
			source: string;
			target: string;
			sourceHandle?: string;
			targetHandle?: string;
		}>
	): void {
		// Clear existing connections
		this.videoConnections.clear();

		// Rebuild connections from video handles only
		for (const conn of connections) {
			// Only process video handle connections (identified by handle IDs starting with 'video')
			if (conn.sourceHandle?.startsWith('video') && conn.targetHandle?.startsWith('video')) {
				const sourceTargets = this.videoConnections.get(conn.source) || [];
				sourceTargets.push(conn.target);
				this.videoConnections.set(conn.source, sourceTargets);
			}
		}

		// Notify all targets of changes
		for (const [sourceId] of this.videoConnections) {
			this.notifyTargets(sourceId);
		}
	}

	/**
	 * Subscribe to video canvas sources for a target node
	 */
	onVideoCanvas(nodeId: string, callback: (canvases: HTMLCanvasElement[]) => void): void {
		const callbacks = this.canvasCallbacks.get(nodeId) || [];
		callbacks.push(callback);
		this.canvasCallbacks.set(nodeId, callbacks);

		// Immediately notify with current canvases
		const canvases = this.getCanvasesForNode(nodeId);
		if (canvases.length > 0) {
			callback(canvases);
		}
	}

	/**
	 * Unregister a node when it's destroyed
	 */
	unregisterNode(nodeId: string): void {
		this.canvasSources.delete(nodeId);
		this.canvasCallbacks.delete(nodeId);

		// Remove from connections
		this.videoConnections.delete(nodeId);
		for (const [sourceId, targets] of this.videoConnections) {
			const newTargets = targets.filter((id) => id !== nodeId);
			this.videoConnections.set(sourceId, newTargets);
		}
	}

	/**
	 * Get canvas sources for a target node
	 */
	private getCanvasesForNode(nodeId: string): HTMLCanvasElement[] {
		const canvases: HTMLCanvasElement[] = [];

		for (const [sourceId, targets] of this.videoConnections) {
			if (targets.includes(nodeId)) {
				const canvas = this.canvasSources.get(sourceId);
				if (canvas) {
					canvases.push(canvas);
				}
			}
		}

		return canvases;
	}

	/**
	 * Notify target nodes of canvas updates
	 */
	private notifyTargets(sourceId: string): void {
		const targets = this.videoConnections.get(sourceId) || [];

		for (const targetId of targets) {
			const callbacks = this.canvasCallbacks.get(targetId) || [];
			const canvases = this.getCanvasesForNode(targetId);

			for (const callback of callbacks) {
				callback(canvases);
			}
		}
	}
}
