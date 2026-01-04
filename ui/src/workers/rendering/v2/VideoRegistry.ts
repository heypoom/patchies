import type { VideoNodeClass } from './interfaces/video-nodes';

/**
 * VideoRegistry manages the registration and lookup of video node types.
 */
export class VideoRegistry {
	private static instance: VideoRegistry | null = null;
	private registry: Map<string, VideoNodeClass> = new Map();

	private constructor() {}

	/**
	 * Register a video node class with its type.
	 */
	register(nodeClass: VideoNodeClass): void {
		this.registry.set(nodeClass.type, nodeClass);
	}

	/**
	 * Check if a node type is registered.
	 */
	isDefined(nodeType: string): boolean {
		return this.registry.has(nodeType);
	}

	/**
	 * Get a node class by type.
	 */
	get(nodeType: string): VideoNodeClass | undefined {
		return this.registry.get(nodeType);
	}

	/**
	 * Get all registered node types.
	 */
	getNodeTypes(): string[] {
		return Array.from(this.registry.keys());
	}

	/**
	 * Get the singleton instance.
	 */
	static getInstance(): VideoRegistry {
		if (VideoRegistry.instance === null) {
			VideoRegistry.instance = new VideoRegistry();
		}

		return VideoRegistry.instance;
	}
}
