import { GLSystem } from './GLSystem';
import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import type { Node } from '@xyflow/svelte';

const SHADERTOY_TYPES = new Set(['glsl', 'swgl', 'regl']);
const SIMPLE_TYPES = new Set(['hydra', 'three', 'canvas', 'textmode']);

/**
 * Forwards normalized surface mouse events to all render nodes in the graph.
 *
 * - GLSL/SWGL/REGL: Shadertoy iMouse convention (Y-flipped, z/w = click position)
 * - Hydra: Simple (x/y in framebuffer space, no z/w)
 */
export class SurfaceMouseForwarder {
  private glSystem = GLSystem.getInstance();
  private eventBus = PatchiesEventBus.getInstance();

  private isMouseDown = false;
  private clickX = 0;
  private clickY = 0;

  constructor(
    private getNodes: () => Node[],
    private getOutputWidth: () => number,
    private getOutputHeight: () => number
  ) {}

  /**
   * Forward a normalized (0–1) pointer event to all render nodes.
   */
  forward(x: number, y: number, buttons: number, type: string): void {
    const renderNodes = this.getNodes().filter(
      (n) => SHADERTOY_TYPES.has(n.type ?? '') || SIMPLE_TYPES.has(n.type ?? '')
    );

    if (renderNodes.length === 0) return;

    const w = this.getOutputWidth();
    const h = this.getOutputHeight();

    const xFB = x * w;
    const yFBSimple = y * h;
    const yFBShadertoy = (1 - y) * h; // Y-flip for GL origin (bottom-left)

    for (const node of renderNodes) {
      const nodeType = node.type ?? '';

      if (SHADERTOY_TYPES.has(nodeType)) {
        this.forwardShadertoy(node.id, xFB, yFBShadertoy, type);
      } else if (SIMPLE_TYPES.has(nodeType)) {
        this.glSystem.setMouseData(node.id, xFB, yFBSimple, 0, 0);
      }
    }
  }

  /**
   * Force all Hydra nodes to a specific mouse scope.
   * Call with 'global' on surface fullscreen entry, 'local' on exit.
   */
  forceHydraScope(scope: 'global' | 'local'): void {
    this.getNodes()
      .filter((n) => n.type === 'hydra')
      .forEach((n) =>
        this.eventBus.dispatch({ type: 'nodeMouseScopeUpdate', nodeId: n.id, scope })
      );
  }

  private forwardShadertoy(nodeId: string, x: number, y: number, type: string): void {
    if (type === 'down') {
      this.isMouseDown = true;
      this.clickX = x;
      this.clickY = y;
      this.glSystem.setMouseData(nodeId, x, y, x, y);
    } else if (type === 'up') {
      this.isMouseDown = false;
      this.glSystem.setMouseData(nodeId, x, y, -Math.abs(this.clickX), -Math.abs(this.clickY));
    } else {
      // move
      const z = this.isMouseDown ? Math.abs(this.clickX) : -Math.abs(this.clickX);
      const w = this.isMouseDown ? Math.abs(this.clickY) : -Math.abs(this.clickY);
      this.glSystem.setMouseData(nodeId, x, y, z, w);
    }
  }
}
