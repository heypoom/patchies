import type { Node } from '@xyflow/svelte';
import type { SurfaceOverlay } from './SurfaceOverlay';

type CanvasDomExpandOverlay = Pick<SurfaceOverlay, 'activate' | 'deactivate'>;

export type CanvasDomExpandControllerOptions = {
  nodeId: string;
  getNodes: () => Node[];
  overlay: CanvasDomExpandOverlay;
  onActiveChange: (active: boolean) => void;
  focusCanvas: () => void;
};

/**
 * Presents the live canvas.dom element in SurfaceOverlay's custom-content host.
 *
 * Unlike render-node expansion, this never replaces the canvas with a bitmap or
 * routes input through the render graph. The DOM canvas keeps its own listeners.
 */
export class CanvasDomExpandController {
  private active = false;

  constructor(private options: CanvasDomExpandControllerOptions) {}

  get isActive(): boolean {
    return this.active;
  }

  enter(): void {
    if (this.active) return;

    const nodes = this.options.getNodes().map((node) => ({
      id: node.id,
      type: node.type
    }));

    this.options.overlay.activate(this.options.nodeId, nodes, () => this.exit(), {
      content: 'custom'
    });

    this.active = true;
    this.options.onActiveChange(true);

    requestAnimationFrame(() => {
      if (this.active) {
        this.options.focusCanvas();
      }
    });
  }

  exit(): void {
    if (!this.active) return;

    this.active = false;
    this.options.onActiveChange(false);
    this.options.overlay.deactivate(this.options.nodeId);
  }
}
