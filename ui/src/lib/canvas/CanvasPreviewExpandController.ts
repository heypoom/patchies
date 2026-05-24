import type { Node } from '@xyflow/svelte';
import type { SurfaceListenersOptions } from './SurfaceListeners';

type ExpandOverlay = {
  canvas: HTMLCanvasElement;

  activate: (nodeId: string, nodes: { id: string; type?: string }[], onExit: () => void) => void;
  deactivate: (nodeId: string) => void;
};

type ExpandForwarder = {
  setForwardingRules: (rules?: {
    enabled?: boolean;
    only?: readonly string[];
    except?: readonly string[];
  }) => void;

  forwardWheel: (event: {
    x: number;
    y: number;
    deltaX: number;
    deltaY: number;
    deltaMode: number;
  }) => void;

  forward: (x: number, y: number, buttons: number, type: string) => void;
  dispose: () => void;
};

type ExpandListeners = {
  attach: (canvas: HTMLCanvasElement, opts: SurfaceListenersOptions) => void;
  detach: () => void;
};

const fallbackConsole: SurfaceListenersOptions['customConsole'] = {
  log: (...args: unknown[]) => console.log(...args),
  error: (...args: unknown[]) => console.error(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  debug: (...args: unknown[]) => console.debug(...args),
  info: (...args: unknown[]) => console.info(...args)
};

export type CanvasPreviewExpandControllerOptions = {
  nodeId: string;
  getNodes: () => Node[];
  getOverrideOutputNode: () => string | null;
  setOverrideOutputNode: (nodeId: string | null) => void;
  overlay: ExpandOverlay;
  createForwarder: () => ExpandForwarder;
  createListeners: () => ExpandListeners;
  customConsole?: SurfaceListenersOptions['customConsole'];
  onActiveChange?: (active: boolean) => void;
};

export class CanvasPreviewExpandController {
  private active = false;
  private previousOverrideNodeId: string | null = null;
  private forwarder: ExpandForwarder | null = null;
  private listeners: ExpandListeners | null = null;
  private lastPointer = { x: 0, y: 0 };

  constructor(private options: CanvasPreviewExpandControllerOptions) {}

  get isActive(): boolean {
    return this.active;
  }

  enter(): void {
    if (this.active) return;

    const previousOverrideNodeId = this.options.getOverrideOutputNode();
    let forwarder: ExpandForwarder | null = null;
    let listeners: ExpandListeners | null = null;
    let overlayActivated = false;

    try {
      forwarder = this.options.createForwarder();
      listeners = this.options.createListeners();

      this.forwarder = forwarder;
      this.listeners = listeners;

      forwarder.setForwardingRules({ only: [this.options.nodeId] });
      this.options.setOverrideOutputNode(this.options.nodeId);

      this.options.overlay.activate(this.options.nodeId, this.getOverlayNodes(), () => this.exit());
      overlayActivated = true;

      listeners.attach(this.options.overlay.canvas, this.createListenerOptions());
      this.previousOverrideNodeId = previousOverrideNodeId;

      this.active = true;
      this.options.onActiveChange?.(true);
    } catch (error) {
      listeners?.detach();

      if (overlayActivated) {
        this.options.overlay.deactivate(this.options.nodeId);
      }

      forwarder?.dispose();
      this.options.setOverrideOutputNode(previousOverrideNodeId);

      this.previousOverrideNodeId = null;
      this.listeners = null;
      this.forwarder = null;
      this.active = false;
      this.options.onActiveChange?.(false);

      throw error;
    }
  }

  exit(): void {
    if (!this.active) return;

    const previousOverrideNodeId = this.previousOverrideNodeId;
    const listeners = this.listeners;
    const forwarder = this.forwarder;

    this.active = false;
    this.previousOverrideNodeId = null;
    this.listeners = null;
    this.forwarder = null;
    this.options.onActiveChange?.(false);

    listeners?.detach();
    this.options.overlay.deactivate(this.options.nodeId);

    forwarder?.dispose();
    this.options.setOverrideOutputNode(previousOverrideNodeId);
  }

  private createListenerOptions(): SurfaceListenersOptions {
    return {
      onPointer: (event) => {
        this.lastPointer = { x: event.x, y: event.y };
        this.forwarder?.forward(event.x, event.y, event.buttons, event.type);
      },
      onWheel: (event) => {
        this.forwarder?.forwardWheel(event);
      },
      onTouch: null,
      onLeave: () => {
        this.forwarder?.forward(this.lastPointer.x, this.lastPointer.y, 0, 'up');
      },
      code: '',
      nodeId: this.options.nodeId,
      customConsole: this.options.customConsole ?? fallbackConsole,
      wrapperOffset: 0
    };
  }

  private getOverlayNodes(): { id: string; type?: string }[] {
    return this.options.getNodes().map((node) => ({ id: node.id, type: node.type }));
  }
}
