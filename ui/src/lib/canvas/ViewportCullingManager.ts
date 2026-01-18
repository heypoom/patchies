import type { Node } from '@xyflow/svelte';
import { FBO_COMPATIBLE_TYPES, type RenderNode } from '$lib/rendering/types';

export interface ViewportBounds {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

export interface ViewportCullingConfig {
	/** Extra padding in pixels around viewport to avoid flickering at edges */
	margin: number;

	/** Throttle interval in ms for viewport change updates */
	throttleMs: number;

	/** Default width for nodes without measured dimensions */
	defaultNodeWidth: number;

	/** Default height for nodes without measured dimensions */
	defaultNodeHeight: number;
}

const DEFAULT_CONFIG: ViewportCullingConfig = {
	margin: 100,
	throttleMs: 100,
	defaultNodeWidth: 300,
	defaultNodeHeight: 200
};

const fboCompatibleTypes = new Set(FBO_COMPATIBLE_TYPES);

export class ViewportCullingManager {
	private config: ViewportCullingConfig;
	private lastUpdateTime = 0;
	private cachedVisibleNodes: Set<string> = new Set();

	public onVisibleNodesChange?: (nodeIds: Set<string>) => void;

	constructor(config: Partial<ViewportCullingConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * Calculate viewport bounds in flow coordinates from XYFlow viewport
	 */
	calculateViewportBounds(
		viewport: { x: number; y: number; zoom: number },
		screenWidth: number,
		screenHeight: number
	): ViewportBounds {
		const { x, y, zoom } = viewport;
		const { margin } = this.config;

		// Convert screen dimensions to flow coordinates and add margin
		const left = -x / zoom - margin / zoom;
		const top = -y / zoom - margin / zoom;
		const right = (-x + screenWidth) / zoom + margin / zoom;
		const bottom = (-y + screenHeight) / zoom + margin / zoom;

		return { left, top, right, bottom };
	}

	/**
	 * Check if a node intersects with viewport bounds
	 */
	isNodeVisible(node: Node, bounds: ViewportBounds): boolean {
		const { defaultNodeWidth, defaultNodeHeight } = this.config;

		// Use measured dimensions or fallback to defaults
		const nodeWidth = node.measured?.width ?? node.width ?? defaultNodeWidth;
		const nodeHeight = node.measured?.height ?? node.height ?? defaultNodeHeight;

		const nodeLeft = node.position.x;
		const nodeTop = node.position.y;
		const nodeRight = nodeLeft + nodeWidth;
		const nodeBottom = nodeTop + nodeHeight;

		// AABB intersection test
		return !(
			nodeRight < bounds.left ||
			nodeLeft > bounds.right ||
			nodeBottom < bounds.top ||
			nodeTop > bounds.bottom
		);
	}

	/**
	 * Update visible nodes based on current viewport and node positions.
	 * Throttled to avoid excessive updates during pan/zoom.
	 *
	 * @returns The set of visible nodes, or null if throttled (use cached)
	 */
	updateVisibleNodes(
		viewport: { x: number; y: number; zoom: number },
		nodes: Node[],
		screenWidth: number,
		screenHeight: number
	): Set<string> | null {
		const now = performance.now();

		// Throttle updates
		if (now - this.lastUpdateTime < this.config.throttleMs) {
			return null;
		}

		this.lastUpdateTime = now;

		const bounds = this.calculateViewportBounds(viewport, screenWidth, screenHeight);
		const visibleNodes = new Set<string>();

		for (const node of nodes) {
			// Only consider FBO-compatible node types for culling
			if (!node.type || !fboCompatibleTypes.has(node.type as RenderNode['type'])) {
				continue;
			}

			if (this.isNodeVisible(node, bounds)) {
				visibleNodes.add(node.id);
			}
		}

		// Check if visible nodes changed
		if (!this.setsEqual(visibleNodes, this.cachedVisibleNodes)) {
			this.cachedVisibleNodes = visibleNodes;
			this.onVisibleNodesChange?.(visibleNodes);
		}

		return visibleNodes;
	}

	private setsEqual(a: Set<string>, b: Set<string>): boolean {
		if (a.size !== b.size) return false;

		for (const item of a) {
			if (!b.has(item)) return false;
		}

		return true;
	}

	getVisibleNodes(): Set<string> {
		return this.cachedVisibleNodes;
	}

	destroy() {
		this.onVisibleNodesChange = undefined;
		this.cachedVisibleNodes.clear();
	}
}
