import { writable } from 'svelte/store';
import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';

/**
 * DOM-renderer node types that get auto-frozen when surface goes fullscreen.
 * These render to their own canvas elements and are occluded by the overlay.
 */
const DOM_RENDERER_TYPES = new Set(['p5', 'canvas.dom', 'textmode.dom', 'three.dom']);

/**
 * Svelte store — true when a surface node is in fullscreen mode.
 * Bind `display: none` on the XYFlow wrapper to this store.
 */
export const isFullscreenActive = writable(false);

export class SurfaceOverlay {
  private static _instance: SurfaceOverlay | null = null;

  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;
  private _activeNodeId: string | null = null;
  private _frozenNodeIds: string[] = [];
  private _badge: HTMLDivElement | null = null;
  private _onEscape: (e: KeyboardEvent) => void;
  private _onExit: (() => void) | null = null;

  static getInstance(): SurfaceOverlay {
    if (!SurfaceOverlay._instance) {
      SurfaceOverlay._instance = new SurfaceOverlay();
    }
    return SurfaceOverlay._instance;
  }

  private constructor() {
    this._canvas = document.createElement('canvas');
    this._canvas.style.cssText =
      'position: fixed; inset: 0; display: none; z-index: 50; pointer-events: none;';
    document.body.appendChild(this._canvas);

    this._ctx = this._canvas.getContext('2d')!;
    this._resize();

    window.addEventListener('resize', this._resize.bind(this));

    this._onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && e.shiftKey && this._activeNodeId) {
        this.deactivate(this._activeNodeId);
      }
    };
    window.addEventListener('keydown', this._onEscape);
  }

  get canvas(): HTMLCanvasElement {
    return this._canvas;
  }

  get ctx(): CanvasRenderingContext2D {
    return this._ctx;
  }

  get width(): number {
    return this._canvas.width;
  }

  get height(): number {
    return this._canvas.height;
  }

  get activeNodeId(): string | null {
    return this._activeNodeId;
  }

  private _resize() {
    this._canvas.width = window.innerWidth;
    this._canvas.height = window.innerHeight;
    this._canvas.style.width = '100vw';
    this._canvas.style.height = '100vh';
  }

  /**
   * Activate fullscreen mode for a surface node.
   * @param nodeId - The surface node's ID
   * @param nodes - All current patch nodes (to find DOM-renderer nodes to freeze)
   * @param onExit - Callback invoked when user exits via Escape or badge
   */
  activate(nodeId: string, nodes: { id: string; type?: string }[], onExit: () => void): void {
    // Last activated wins — displace previous
    if (this._activeNodeId && this._activeNodeId !== nodeId) {
      this._deactivateInternal(this._activeNodeId, false);
    }

    this._activeNodeId = nodeId;

    // Show canvas + enable pointer events
    this._canvas.style.display = 'block';
    this._canvas.style.pointerEvents = 'all';

    // Freeze DOM-renderer nodes (not the surface node itself)
    const eventBus = PatchiesEventBus.getInstance();
    this._frozenNodeIds = [];
    for (const node of nodes) {
      if (node.type && DOM_RENDERER_TYPES.has(node.type) && node.id !== nodeId) {
        eventBus.dispatch({ type: 'nodeSetPaused', nodeId: node.id, paused: true });
        this._frozenNodeIds.push(node.id);
      }
    }

    this._onExit = onExit;
    isFullscreenActive.set(true);
    this._showBadge(onExit);
  }

  /**
   * Deactivate fullscreen mode for a surface node.
   * No-op if this node isn't the active one.
   */
  deactivate(nodeId: string): void {
    if (this._activeNodeId !== nodeId) return;
    this._deactivateInternal(nodeId, true);
  }

  private _deactivateInternal(nodeId: string, unfreeze: boolean): void {
    if (this._activeNodeId !== nodeId) return;
    this._activeNodeId = null;

    this._canvas.style.display = 'none';
    this._canvas.style.pointerEvents = 'none';

    if (unfreeze) {
      const eventBus = PatchiesEventBus.getInstance();
      for (const id of this._frozenNodeIds) {
        eventBus.dispatch({ type: 'nodeSetPaused', nodeId: id, paused: false });
      }
      this._frozenNodeIds = [];
    }

    isFullscreenActive.set(false);
    this._removeBadge();
    const onExit = this._onExit;
    this._onExit = null;
    onExit?.();
  }

  private _showBadge(onExit: () => void): void {
    this._removeBadge();

    const badge = document.createElement('div');
    badge.style.cssText = `
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 51;
      background: rgba(0,0,0,0.5);
      color: rgba(255,255,255,0.6);
      font-family: ui-monospace, monospace;
      font-size: 12px;
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
      border: 1px solid rgba(255,255,255,0.15);
      transition: color 0.15s, background 0.15s;
      user-select: none;
    `;
    badge.textContent = 'Exit surface (Shift+Esc)';
    badge.addEventListener('mouseenter', () => {
      badge.style.color = 'rgba(255,255,255,0.9)';
      badge.style.background = 'rgba(0,0,0,0.75)';
    });
    badge.addEventListener('mouseleave', () => {
      badge.style.color = 'rgba(255,255,255,0.6)';
      badge.style.background = 'rgba(0,0,0,0.5)';
    });
    badge.addEventListener('click', () => {
      onExit();
    });

    document.body.appendChild(badge);
    this._badge = badge;
  }

  private _removeBadge(): void {
    if (this._badge) {
      this._badge.remove();
      this._badge = null;
    }
  }
}
