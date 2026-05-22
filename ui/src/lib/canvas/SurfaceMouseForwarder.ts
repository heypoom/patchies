import { GLSystem } from './GLSystem';
import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import {
  getSurfaceMouseTargets,
  getSurfaceWheelTargets,
  type SurfaceMouseForwardingRules,
  type SurfaceMouseTarget,
  type SurfaceWheelTarget
} from './surfaceMouseForwarding';
import type { SurfaceMouseForwardingGraphChangedEvent } from '$lib/eventbus/events';
import type { Node } from '@xyflow/svelte';

/**
 * Forwards normalized surface mouse events to all render nodes in the graph.
 *
 * - GLSL/SWGL/REGL: Shadertoy iMouse convention (Y-flipped, z/w = click position)
 * - Hydra/Shader Park/etc.: Simple (x/y in framebuffer space, no z/w)
 */
export class SurfaceMouseForwarder {
  private glSystem = GLSystem.getInstance();
  private eventBus = PatchiesEventBus.getInstance();

  private isMouseDown = false;
  private clickX = 0;
  private clickY = 0;
  private forwardingRules: SurfaceMouseForwardingRules | undefined;
  private mouseTargets: SurfaceMouseTarget[] = [];
  private wheelTargets: SurfaceWheelTarget[] = [];

  private readonly handleGraphChanged = (event: SurfaceMouseForwardingGraphChangedEvent) => {
    this.refreshForwardingTargets(event.nodes);
  };

  constructor(private getNodes: () => Node[]) {
    this.refreshForwardingTargets();
    this.eventBus.addEventListener('surfaceMouseForwardingGraphChanged', this.handleGraphChanged);
  }

  setForwardingRules(rules?: SurfaceMouseForwardingRules): void {
    this.forwardingRules = rules;
    this.refreshForwardingTargets();
  }

  refreshForwardingTargets(nodes = this.getNodes()): void {
    this.mouseTargets = getSurfaceMouseTargets(nodes, this.forwardingRules);
    this.wheelTargets = getSurfaceWheelTargets(nodes, this.forwardingRules);
  }

  dispose(): void {
    this.eventBus.removeEventListener(
      'surfaceMouseForwardingGraphChanged',
      this.handleGraphChanged
    );
  }

  /**
   * Forward a normalized (0–1) pointer event to all render nodes.
   */
  forward(x: number, y: number, _buttons: number, type: string): void {
    const renderNodes = this.mouseTargets;

    if (renderNodes.length === 0) return;

    // Use the render pipeline's output size, not the surface canvas size.
    // All render nodes share the same output dimensions from GLSystem.
    const [w, h] = this.glSystem.outputSize;

    const xFB = x * w;
    const yFBSimple = y * h;
    const yFBShadertoy = (1 - y) * h; // Y-flip for GL origin (bottom-left)

    for (const node of renderNodes) {
      if (node.type === 'three') {
        this.forwardShadertoy(node.nodeId, xFB, yFBSimple, type, _buttons);
      } else if (node.kind === 'shadertoy') {
        this.forwardShadertoy(node.nodeId, xFB, yFBShadertoy, type, _buttons);
      } else {
        this.glSystem.setMouseData(node.nodeId, xFB, yFBSimple, 0, 0);
      }
    }
  }

  forwardWheel(event: {
    x: number;
    y: number;
    deltaX: number;
    deltaY: number;
    deltaMode: number;
  }): void {
    const [w, h] = this.glSystem.outputSize;

    const xFB = event.x * w;
    const yFB = event.y * h;

    for (const target of this.wheelTargets) {
      if (target.kind === 'three') {
        this.glSystem.sendThreeWheelData(target.nodeId, {
          x: xFB,
          y: yFB,
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          deltaMode: event.deltaMode
        });
      } else {
        this.glSystem.zoomShaderParkOrbit(target.nodeId, event.deltaY);
      }
    }
  }

  /**
   * Force all Hydra nodes to a specific mouse scope.
   * Call with 'global' on surface fullscreen entry, 'local' on exit.
   */
  forceHydraScope(scope: 'global' | 'local'): void {
    const allNodes = this.getNodes();

    const nodes =
      scope === 'global'
        ? this.mouseTargets
            .filter((node) => node.kind === 'simple')
            .map((node) => allNodes.find((candidate) => candidate.id === node.nodeId))
            .filter((node): node is Node => node?.type === 'hydra')
        : allNodes.filter((node) => node.type === 'hydra');

    nodes.forEach((node) =>
      this.eventBus.dispatch({ type: 'nodeMouseScopeUpdate', nodeId: node.id, scope })
    );
  }

  private forwardShadertoy(
    nodeId: string,
    x: number,
    y: number,
    type: string,
    buttons: number
  ): void {
    if (type === 'down') {
      this.isMouseDown = true;
      this.clickX = x;
      this.clickY = y;

      this.glSystem.setMouseData(nodeId, x, y, x, y, buttons || 1);
    } else if (type === 'up') {
      this.isMouseDown = false;

      this.glSystem.setMouseData(nodeId, x, y, -Math.abs(this.clickX), -Math.abs(this.clickY), 0);
    } else {
      const z = this.isMouseDown ? Math.abs(this.clickX) : -Math.abs(this.clickX);
      const w = this.isMouseDown ? Math.abs(this.clickY) : -Math.abs(this.clickY);

      this.glSystem.setMouseData(nodeId, x, y, z, w, this.isMouseDown ? buttons : 0);
    }
  }
}
