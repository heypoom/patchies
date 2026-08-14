import type { Node } from '@xyflow/svelte';
import type { SurfaceOverlay } from './SurfaceOverlay';

type LivePreviewExpandOverlay = Pick<SurfaceOverlay, 'activate' | 'deactivate'>;

export type LivePreviewExpandControllerOptions = {
  nodeId: string;
  getNodes: () => Node[];
  overlay: LivePreviewExpandOverlay;
  onActiveChange: (active: boolean) => void;
  focusPreview: () => void;
};

/**
 * Presents a live DOM preview in SurfaceOverlay's custom-content host.
 *
 * The preview keeps its native event listeners and application state; no render
 * output override or synthetic pointer forwarding is involved.
 */
export class LivePreviewExpandController {
  private active = false;

  constructor(private options: LivePreviewExpandControllerOptions) {}

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
        this.options.focusPreview();
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
