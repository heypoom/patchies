import { writable } from 'svelte/store';
import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import { GLSystem } from '$lib/canvas/GLSystem';
import { outputSize as outputSizeStore } from '../../stores/renderer.store';
import { isSidebarOpen } from '../../stores/ui.store';

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

export type SurfacePresentationMode = 'main' | 'secondary';
export type SurfaceOverlayContentMode = 'canvas' | 'custom';

export type SurfaceOverlayActivateOptions = {
  presentation?: SurfacePresentationMode;
  content?: SurfaceOverlayContentMode;
};

export class SurfaceOverlay {
  private static _instance: SurfaceOverlay | null = null;

  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;
  private _customHost: HTMLDivElement;
  private _activeNodeId: string | null = null;
  private _frozenNodeIds: string[] = [];
  private _badge: HTMLButtonElement | null = null;
  private _secondarySurfaceVisible = false;
  private _contentMode: SurfaceOverlayContentMode = 'canvas';

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
      'position: fixed; inset: 0; display: none; z-index: 50; pointer-events: none; width: 100vw; height: 100vh; object-fit: cover;';

    document.body.appendChild(this._canvas);

    this._customHost = document.createElement('div');
    this._customHost.style.cssText =
      'position: fixed; inset: 0; display: none; z-index: 50; pointer-events: none; width: 100vw; height: 100vh; overflow: hidden;';

    document.body.appendChild(this._customHost);

    this._ctx = this._canvas.getContext('2d')!;
    this._resize();

    window.addEventListener('resize', this._resize.bind(this));
    outputSizeStore.subscribe(() => this._resize());

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

  get customHost(): HTMLDivElement {
    return this._customHost;
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
    const [outputWidth, outputHeight] = GLSystem.getInstance().outputSize;

    this._canvas.width = outputWidth;
    this._canvas.height = outputHeight;
  }

  /**
   * Activate fullscreen mode for a surface node.
   * @param nodeId - The surface node's ID
   * @param nodes - All current patch nodes (to find DOM-renderer nodes to freeze)
   * @param onExit - Callback invoked when user exits via Escape or badge
   */
  activate(
    nodeId: string,
    nodes: { id: string; type?: string }[],
    onExit: () => void,
    options: SurfaceOverlayActivateOptions = {}
  ): void {
    const presentation = options.presentation ?? 'main';
    const content = options.content ?? 'canvas';
    this._secondarySurfaceVisible = false;
    this._contentMode = content;

    // Last activated wins — displace previous
    if (this._activeNodeId && this._activeNodeId !== nodeId) {
      this._deactivateInternal(this._activeNodeId, false);
    }

    this._activeNodeId = nodeId;

    // Main presentation shows the overlay in this window. Secondary presentation keeps the
    // canvas as a hidden drawing target while the /output window owns the visible surface.
    const showInMainWindow = presentation === 'main';
    this._canvas.style.display = showInMainWindow && content === 'canvas' ? 'block' : 'none';
    this._canvas.style.pointerEvents = showInMainWindow && content === 'canvas' ? 'all' : 'none';
    this._customHost.style.display = showInMainWindow && content === 'custom' ? 'block' : 'none';
    this._customHost.style.pointerEvents =
      showInMainWindow && content === 'custom' ? 'all' : 'none';

    this._frozenNodeIds = [];

    // Freeze DOM-renderer nodes (not the surface node itself)
    if (presentation === 'main') {
      const eventBus = PatchiesEventBus.getInstance();

      for (const node of nodes) {
        if (node.type && DOM_RENDERER_TYPES.has(node.type) && node.id !== nodeId) {
          eventBus.dispatch({ type: 'nodeSetPaused', nodeId: node.id, paused: true });
          this._frozenNodeIds.push(node.id);
        }
      }
    }

    this._onExit = onExit;

    if (presentation === 'main') {
      isFullscreenActive.set(true);
      isSidebarOpen.set(false);

      this._showBadge(onExit);
    } else {
      isFullscreenActive.set(false);
      this._showSecondaryToggleButton();
    }
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
    this._secondarySurfaceVisible = false;
    this._contentMode = 'canvas';

    this._canvas.style.display = 'none';
    this._canvas.style.pointerEvents = 'none';

    this._customHost.style.display = 'none';
    this._customHost.style.pointerEvents = 'none';

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

    const badge = document.createElement('button');

    badge.type = 'button';

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

  private _showSecondaryToggleButton(): void {
    this._removeBadge();

    const button = document.createElement('button');

    button.type = 'button';

    button.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 51;
      background: rgba(0,0,0,0.55);
      color: rgba(255,255,255,0.72);
      font-family: ui-monospace, monospace;
      font-size: 12px;
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
      border: 1px solid rgba(255,255,255,0.16);
      transition: color 0.15s, background 0.15s;
      user-select: none;
    `;

    const syncButton = () => {
      button.textContent = this._secondarySurfaceVisible ? 'Hide surface' : 'Show surface';
    };

    button.addEventListener('mouseenter', () => {
      button.style.color = 'rgba(255,255,255,0.95)';
      button.style.background = 'rgba(0,0,0,0.78)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.color = 'rgba(255,255,255,0.72)';
      button.style.background = 'rgba(0,0,0,0.55)';
    });

    button.addEventListener('click', () => {
      this._secondarySurfaceVisible = !this._secondarySurfaceVisible;

      const display = this._secondarySurfaceVisible ? 'block' : 'none';
      const pointerEvents = this._secondarySurfaceVisible ? 'all' : 'none';
      const target = this._contentMode === 'custom' ? this._customHost : this._canvas;

      target.style.display = display;
      target.style.pointerEvents = pointerEvents;

      syncButton();
    });

    syncButton();
    document.body.appendChild(button);

    this._badge = button;
  }

  hideBadge(): void {
    if (this._badge) {
      this._badge.style.display = 'none';
    }
  }

  private _removeBadge(): void {
    if (this._badge) {
      this._badge.remove();
      this._badge = null;
    }
  }
}
