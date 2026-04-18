import type { Node } from '@xyflow/svelte';
import { CULLABLE_DOM_TYPES, FBO_COMPATIBLE_TYPES, type RenderNode } from '$lib/rendering/types';

export interface ViewportBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ViewportCullingConfig {
  /** Extra padding in pixels around viewport for FBO (worker) culling. */
  fboMargin: number;

  /** Extra padding in pixels around viewport for DOM (main-thread) culling. Larger to hide resume stutter. */
  domMargin: number;

  /** Throttle interval in ms for viewport change updates */
  throttleMs: number;

  /** Default width for nodes without measured dimensions */
  defaultNodeWidth: number;

  /** Default height for nodes without measured dimensions */
  defaultNodeHeight: number;
}

const DEFAULT_CONFIG: ViewportCullingConfig = {
  fboMargin: 100,
  domMargin: 100,
  throttleMs: 100,
  defaultNodeWidth: 300,
  defaultNodeHeight: 200
};

const fboCompatibleTypes = new Set(FBO_COMPATIBLE_TYPES);
const cullableDomTypes = new Set(CULLABLE_DOM_TYPES);

export class ViewportCullingManager {
  private config: ViewportCullingConfig;
  private lastUpdateTime = 0;
  private lastViewport = { x: 0, y: 0, zoom: 1 };

  private cachedVisibleFboNodes: Set<string> = new Set();
  private cachedVisibleDomNodes: Set<string> = new Set();

  public onVisibleFboNodesChange?: (nodeIds: Set<string>) => void;

  /**
   * Fires when the set of visible DOM-backed nodes changes.
   *
   * @param visible    Node IDs currently inside the DOM-margin viewport.
   * @param liveIds    All DOM-cullable node IDs currently in the graph (for pruning ledgers).
   */
  public onVisibleDomNodesChange?: (visible: Set<string>, liveIds: Set<string>) => void;

  constructor(config: Partial<ViewportCullingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate viewport bounds in flow coordinates from XYFlow viewport
   */
  calculateViewportBounds(
    viewport: { x: number; y: number; zoom: number },
    screenWidth: number,
    screenHeight: number,
    margin: number
  ): ViewportBounds {
    const { x, y, zoom } = viewport;

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
   * @returns The set of visible FBO nodes, or null if throttled (use cached)
   */
  updateVisibleNodes(
    viewport: { x: number; y: number; zoom: number },
    nodes: Node[],
    screenWidth: number,
    screenHeight: number
  ): Set<string> | null {
    const now = performance.now();

    // Skip throttle if viewport moved (ensures correct culling after fitView/load)
    const viewportMoved =
      viewport.x !== this.lastViewport.x ||
      viewport.y !== this.lastViewport.y ||
      viewport.zoom !== this.lastViewport.zoom;

    if (!viewportMoved && now - this.lastUpdateTime < this.config.throttleMs) {
      return null;
    }

    this.lastUpdateTime = now;
    this.lastViewport = { x: viewport.x, y: viewport.y, zoom: viewport.zoom };

    const fboBounds = this.calculateViewportBounds(
      viewport,
      screenWidth,
      screenHeight,
      this.config.fboMargin
    );

    const domBounds = this.calculateViewportBounds(
      viewport,
      screenWidth,
      screenHeight,
      this.config.domMargin
    );

    const visibleFboNodes = new Set<string>();
    const visibleDomNodes = new Set<string>();
    const liveDomIds = new Set<string>();

    for (const node of nodes) {
      const nodeType = node.type;
      if (!nodeType) continue;

      const isFbo = fboCompatibleTypes.has(nodeType as RenderNode['type']);
      const isDom = cullableDomTypes.has(nodeType);

      if (!isFbo && !isDom) continue;

      if (isFbo && this.isNodeVisible(node, fboBounds)) {
        visibleFboNodes.add(node.id);
      }

      if (isDom) {
        liveDomIds.add(node.id);

        if (this.isNodeVisible(node, domBounds)) {
          visibleDomNodes.add(node.id);
        }
      }
    }

    if (!this.setsEqual(visibleFboNodes, this.cachedVisibleFboNodes)) {
      this.cachedVisibleFboNodes = visibleFboNodes;
      this.onVisibleFboNodesChange?.(visibleFboNodes);
    }

    if (!this.setsEqual(visibleDomNodes, this.cachedVisibleDomNodes)) {
      this.cachedVisibleDomNodes = visibleDomNodes;
      this.onVisibleDomNodesChange?.(visibleDomNodes, liveDomIds);
    }

    return visibleFboNodes;
  }

  private setsEqual(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;

    for (const item of a) {
      if (!b.has(item)) return false;
    }

    return true;
  }

  /** Force an update, bypassing the throttle. */
  forceUpdate(
    viewport: { x: number; y: number; zoom: number },
    nodes: Node[],
    screenWidth: number,
    screenHeight: number
  ): Set<string> | null {
    this.lastUpdateTime = -Infinity;

    return this.updateVisibleNodes(viewport, nodes, screenWidth, screenHeight);
  }

  getVisibleNodes(): Set<string> {
    return this.cachedVisibleFboNodes;
  }

  getVisibleDomNodes(): Set<string> {
    return this.cachedVisibleDomNodes;
  }

  destroy() {
    this.onVisibleFboNodesChange = undefined;
    this.onVisibleDomNodesChange = undefined;
    this.cachedVisibleFboNodes.clear();
    this.cachedVisibleDomNodes.clear();
  }
}
