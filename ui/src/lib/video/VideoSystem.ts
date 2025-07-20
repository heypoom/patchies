/**
 * VideoSystem manages MediaStream connections between video nodes
 * for the visual chaining feature.
 */
export class VideoSystem {
	private static instance: VideoSystem;
	private videoConnections = new Map<string, string[]>(); // sourceNodeId -> [targetNodeIds]
	private videoStreams = new Map<string, MediaStream>(); // nodeId -> MediaStream
	private videoCallbacks = new Map<string, ((streams: MediaStream[]) => void)[]>(); // nodeId -> callbacks

	private constructor() {}

	static getInstance(): VideoSystem {
		if (!VideoSystem.instance) {
			VideoSystem.instance = new VideoSystem();
		}
		return VideoSystem.instance;
	}

	/**
	 * Register a node's canvas for video streaming
	 */
	registerVideoSource(nodeId: string, canvas: HTMLCanvasElement): void {
		try {
			// Create MediaStream from canvas at 60fps
			const stream = canvas.captureStream(60);
			this.videoStreams.set(nodeId, stream);

			// Notify connected targets
			this.notifyTargets(nodeId);
		} catch (error) {
			console.warn(`Failed to capture stream from canvas in node ${nodeId}:`, error);
		}
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
	 * Subscribe to video streams for a target node
	 */
	onVideoStreams(nodeId: string, callback: (streams: MediaStream[]) => void): void {
		const callbacks = this.videoCallbacks.get(nodeId) || [];
		callbacks.push(callback);
		this.videoCallbacks.set(nodeId, callbacks);

		// Immediately notify with current streams
		const streams = this.getVideoStreamsForNode(nodeId);
		if (streams.length > 0) {
			callback(streams);
		}
	}

	/**
	 * Unregister a node when it's destroyed
	 */
	unregisterNode(nodeId: string): void {
		this.videoStreams.delete(nodeId);
		this.videoCallbacks.delete(nodeId);

		// Remove from connections
		this.videoConnections.delete(nodeId);
		for (const [sourceId, targets] of this.videoConnections) {
			const newTargets = targets.filter((id) => id !== nodeId);
			this.videoConnections.set(sourceId, newTargets);
		}
	}

	/**
	 * Get video streams for a target node
	 */
	private getVideoStreamsForNode(nodeId: string): MediaStream[] {
		const streams: MediaStream[] = [];

		for (const [sourceId, targets] of this.videoConnections) {
			if (targets.includes(nodeId)) {
				const stream = this.videoStreams.get(sourceId);
				if (stream) {
					streams.push(stream);
				}
			}
		}

		return streams;
	}

	/**
	 * Notify target nodes of stream updates
	 */
	private notifyTargets(sourceId: string): void {
		const targets = this.videoConnections.get(sourceId) || [];

		for (const targetId of targets) {
			const callbacks = this.videoCallbacks.get(targetId) || [];
			const streams = this.getVideoStreamsForNode(targetId);

			for (const callback of callbacks) {
				callback(streams);
			}
		}
	}
}
