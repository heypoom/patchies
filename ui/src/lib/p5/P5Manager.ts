import type Sketch from 'p5';
import { GLSystem } from '$lib/canvas/GLSystem';
import type { UserFnRunContext } from '$lib/messages/MessageContext';
import { JSRunner } from '$lib/js-runner/JSRunner';
import { deleteAfterComment } from '$lib/js-runner/js-module-utils';
import { revokeObjectUrls } from '$lib/vfs';
import { profiler } from '$lib/profiler';
import type { SettingsAPI } from '$lib/settings';
import type { SurfaceMouseForwardingRules } from '$lib/canvas/surfaceMouseForwarding';
import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import type { PrimaryButton } from '$lib/eventbus/events';

interface P5SketchConfig {
  code: string;
  messageContext?: UserFnRunContext;

  setHidePorts?: (hide: boolean) => void;

  settings?: SettingsAPI;

  /**
   * The P5CanvasNode component is being mounted and the playing state is PAUSED,
   * so we must noLoop() the sketch on mount.
   **/
  pauseOnMount?: boolean;

  /**
   * Custom console for redirecting console.* calls to VirtualConsole.
   * If not provided, uses the global console.
   */
  customConsole?: {
    log: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
  };

  /**
   * Callback for runtime errors in draw(), setup(), etc.
   * Used for error line highlighting.
   */
  onRuntimeError?: (error: Error) => void;

  onPreserveFrame?: (snapshot: P5CanvasSnapshot) => void;
  onFrameReady?: (dimensions: { width: number; height: number }) => void;
  getSurfaceCanvasSize?: () => { width: number; height: number };

  onSurfaceModeChange?: (enabled: boolean) => void;
  onSurfaceCanvasCreated?: (canvas: HTMLCanvasElement) => void;
  onSurfaceFrame?: (canvas: HTMLCanvasElement) => void;
  onSurfacePointer?: (x: number, y: number, buttons: number, type: string) => void;

  onCanvasCreated?: (
    canvas: HTMLCanvasElement,
    dimensions: { width: number; height: number }
  ) => void;

  onSurfaceWheel?: (event: {
    x: number;
    y: number;
    deltaX: number;
    deltaY: number;
    deltaMode: number;
  }) => void;

  hideExitButton?: () => void;
  setMouseForwarding?: (rules?: SurfaceMouseForwardingRules) => void;
  expandSurface?: () => void;
  collapseSurface?: () => void;
  normalizeInlineMouseCoordinates?: boolean;
}

interface P5CanvasSnapshot {
  canvas: HTMLCanvasElement;
  displayWidth: number;
  displayHeight: number;
}

type P5PointerSketch = {
  _hasMouseInteracted?: boolean;
  _updatePointerCoords?: (this: P5PointerSketch, event: PointerEvent) => void;
  canvas?: HTMLCanvasElement;
  mouseX: number;
  mouseY: number;
  pmouseX: number;
  pmouseY: number;
};

/**
 * Correct p5's pointer coordinates when the canvas is scaled by XYFlow.
 *
 * p5 measures pointer offsets against the untransformed layout width. Hooking
 * its update method means its per-frame pmouse bookkeeping sees normalized
 * coordinates, rather than repeatedly transforming a previous-frame value.
 */
export function installInlinePointerCoordinateNormalization(pointerSketch: P5PointerSketch) {
  const updatePointerCoords = pointerSketch._updatePointerCoords;

  if (!updatePointerCoords) return;

  pointerSketch._updatePointerCoords = function (event: PointerEvent) {
    const isFirstPointerUpdate = !this._hasMouseInteracted;
    updatePointerCoords.call(this, event);

    const canvas = this.canvas;
    if (!canvas) return;

    const bounds = canvas.getBoundingClientRect();
    const scaleX = canvas.scrollWidth / bounds.width;
    const scaleY = canvas.scrollHeight / bounds.height;

    if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY)) return;

    this.mouseX *= scaleX;
    this.mouseY *= scaleY;

    // p5 initializes pmouse from mouse during its first pointer update. On
    // following events it is already the previous normalized frame value.
    if (isFirstPointerUpdate) {
      this.pmouseX *= scaleX;
      this.pmouseY *= scaleY;
    }
  };
}

export class P5Manager {
  public p5: Sketch | null = null;
  public glSystem = GLSystem.getInstance();
  public jsRunner = JSRunner.getInstance();
  public nodeId: string;

  public shouldSendBitmap = true;

  private container: HTMLElement | null = null;
  private onSurfaceFrame: ((canvas: HTMLCanvasElement) => void) | null = null;

  private static compatLibsLoaded = false;

  constructor(nodeId: string, container: HTMLElement) {
    this.nodeId = nodeId;
    this.container = container;

    // @ts-expect-error -- expose for debugging
    window[nodeId] = this;
  }

  setContainer(container: HTMLElement | null) {
    this.container = container;
  }

  async updateCode(config: P5SketchConfig) {
    this.onSurfaceFrame = config.onSurfaceFrame ?? null;

    if (this.p5) {
      // @ts-expect-error -- p5 exposes the live canvas at runtime.
      const canvas: HTMLCanvasElement | undefined = this.p5.canvas;

      const displayWidth = canvas?.clientWidth || parseFloat(canvas?.style.width ?? '') || 0;
      const displayHeight = canvas?.clientHeight || parseFloat(canvas?.style.height ?? '') || 0;

      this.p5.remove();
      this.p5 = null;

      if (canvas && displayWidth > 0 && displayHeight > 0) {
        config.onPreserveFrame?.({ canvas, displayWidth, displayHeight });
      }
    }

    if (!this.container) return;

    const { default: P5 } = await import('p5');

    // Load P5.js v2 compatibility libraries (only once)
    if (!P5Manager.compatLibsLoaded) {
      await this.loadCompatibilityLibraries(P5);
      P5Manager.compatLibsLoaded = true;
    }

    const delimiter = '// [!!PATCHIES_DELETE!!]';

    // HACK: prevent rollup from tree-shaking unused functions.
    // We'll delete everything after the delimiter, so these functions will not actually be called at runtime.
    // It's just to trick and bamboozle rollup into thinking that these functions are used.
    const codeWithTemplate = `
			${config.code}

			${delimiter}

			setup(); draw(); preload(); mousePressed(); mouseReleased(); mouseClicked(); mouseMoved(); mouseDragged();
			mouseWheel(); doubleClicked(); keyPressed(); keyReleased(); keyTyped(); touchStarted(); touchMoved();
			touchEnded(); windowResized(); deviceMoved(); deviceTurned(); deviceShaken();
		`;

    let processedCode = await this.jsRunner.preprocessCode(codeWithTemplate, {
      nodeId: this.nodeId
    });

    if (processedCode !== null) {
      processedCode = deleteAfterComment(processedCode, delimiter).trim();
    }

    const sketch = async (p: Sketch) => {
      const onRuntimeError = config.onRuntimeError;

      let frameReady = false;

      const signalFrameReady = () => {
        if (frameReady) return;

        frameReady = true;
        config.onFrameReady?.({ width: p.width, height: p.height });
      };

      try {
        const sketchConfig: P5SketchConfig = {
          ...config,
          code: processedCode ?? config.code
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let userCode: any;
        try {
          userCode = await this.executeUserCode(p, sketchConfig, P5);
        } catch (error) {
          // Catch syntax errors during code compilation
          if (error instanceof Error) {
            onRuntimeError?.(error);
          }
          return;
        }

        try {
          await userCode?.preload?.call(p);
          await userCode?.setup?.call(p);

          if (!userCode?.draw) {
            requestAnimationFrame(signalFrameReady);
          }
        } catch (error) {
          if (error instanceof Error) {
            onRuntimeError?.(error);
          }
          return;
        }

        const sendBitmap = this.sendBitmap.bind(this);

        p.setup = function () {
          try {
            userCode?.setup?.call(p);

            const canvas = (p as unknown as { canvas?: unknown }).canvas;

            if (canvas instanceof HTMLCanvasElement) {
              config.onCanvasCreated?.(canvas, { width: p.width, height: p.height });
            }

            if (!userCode?.draw) {
              requestAnimationFrame(signalFrameReady);
            }
          } catch (error) {
            if (error instanceof Error) {
              onRuntimeError?.(error);
            }
          }
        };

        const nodeId = this.nodeId;

        p.draw = function () {
          profiler.measure(nodeId, 'draw', () => {
            try {
              userCode?.draw?.call(p);

              signalFrameReady();
              sendBitmap();
            } catch (error) {
              if (error instanceof Error) {
                p.background(220, 100, 100);
                p.fill(255);
                onRuntimeError?.(error);
              }
              // Stop the loop to prevent error spam
              p.noLoop();
            }
          });
        };

        // @ts-expect-error -- compatibility layer for P5.js version 1
        p.preload = function () {
          userCode?.preload?.call(p);
        };

        if (config.normalizeInlineMouseCoordinates !== false) {
          installInlinePointerCoordinateNormalization(p as unknown as P5PointerSketch);
        }

        // Guard: only dispatch mouse events that originate within the canvas bounds.
        // P5.js v2 listens on the window, so events outside the canvas still fire.
        const isMouseInCanvas = () =>
          p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;

        const dispatchSurfacePointer = (buttons: number, type: string) => {
          if (!isMouseInCanvas() || p.width <= 0 || p.height <= 0) return;

          config.onSurfacePointer?.(p.mouseX / p.width, p.mouseY / p.height, buttons, type);
        };

        const dispatchSurfaceWheel = (event: WheelEvent) => {
          if (!isMouseInCanvas() || p.width <= 0 || p.height <= 0) return;

          config.onSurfaceWheel?.({
            x: p.mouseX / p.width,
            y: p.mouseY / p.height,
            deltaX: event.deltaX,
            deltaY: event.deltaY,
            deltaMode: event.deltaMode
          });
        };

        p.mousePressed = function (event: MouseEvent) {
          if (isMouseInCanvas()) {
            userCode?.mousePressed?.call(p, event);
            dispatchSurfacePointer(event.buttons || 1, 'down');
          }
        };

        p.mouseReleased = function (event: MouseEvent) {
          if (isMouseInCanvas()) {
            userCode?.mouseReleased?.call(p, event);
            dispatchSurfacePointer(0, 'up');
          }
        };

        p.mouseClicked = function (event: MouseEvent) {
          if (isMouseInCanvas()) {
            userCode?.mouseClicked?.call(p, event);
          }
        };

        p.mouseMoved = function (event: MouseEvent) {
          if (isMouseInCanvas()) {
            userCode?.mouseMoved?.call(p, event);
            dispatchSurfacePointer(event.buttons, 'move');
          }
        };

        p.mouseDragged = function (event: MouseEvent) {
          if (isMouseInCanvas()) {
            userCode?.mouseDragged?.call(p, event);
            dispatchSurfacePointer(event.buttons, 'move');
          }
        };

        p.mouseWheel = function (event: WheelEvent) {
          if (isMouseInCanvas()) {
            userCode?.mouseWheel?.call(p, event);
            dispatchSurfaceWheel(event);
          }
        };

        p.doubleClicked = function (event: MouseEvent) {
          if (isMouseInCanvas()) {
            userCode?.doubleClicked?.call(p, event);
          }
        };

        p.keyPressed = function (event: KeyboardEvent) {
          userCode?.keyPressed?.call(p, event);
        };

        p.keyReleased = function (event: KeyboardEvent) {
          userCode?.keyReleased?.call(p, event);
        };

        p.keyTyped = function (event: KeyboardEvent) {
          userCode?.keyTyped?.call(p, event);
        };

        // @ts-expect-error -- not typed
        p.touchStarted = function (event: TouchEvent) {
          userCode?.touchStarted?.call(p, event);
        };

        // @ts-expect-error -- not typed
        p.touchMoved = function (event: TouchEvent) {
          userCode?.touchMoved?.call(p, event);
        };

        // @ts-expect-error -- not typed
        p.touchEnded = function (event: TouchEvent) {
          userCode?.touchEnded?.call(p, event);
        };

        p.windowResized = function () {
          userCode?.windowResized?.call(p);
        };

        p.deviceMoved = function () {
          userCode?.deviceMoved?.call(p);
        };

        p.deviceTurned = function () {
          userCode?.deviceTurned?.call(p);
        };

        p.deviceShaken = function () {
          userCode?.deviceShaken?.call(p);
        };
      } catch (error) {
        // Catch any P5.js internal errors (e.g., renderer not ready)
        if (error instanceof Error) {
          onRuntimeError?.(error);
        }
      }
    };

    this.p5 = new P5(sketch, this.container);

    // The component are being mounted and the playing state is PAUSED,
    // so we must noLoop() the sketch on mount.
    if (config.pauseOnMount) {
      this.p5.noLoop();
    }
  }

  private executeUserCode(sketch: Sketch, config: P5SketchConfig, P5Constructor: unknown) {
    for (const key in sketch) {
      // @ts-expect-error -- no-op
      if (typeof sketch[key] === 'function') {
        // @ts-expect-error -- no-op
        sketch[key] = sketch[key].bind(sketch);
      }
    }

    (sketch as unknown as Record<string, unknown>)['p5'] = P5Constructor;

    const createSurfaceCanvas = (...args: unknown[]) => {
      config.onSurfaceModeChange?.(true);

      const { width, height } = config.getSurfaceCanvasSize?.() ?? {
        width: window.innerWidth,
        height: window.innerHeight
      };

      const renderer = (
        sketch as unknown as { createCanvas: (...args: unknown[]) => unknown }
      ).createCanvas(width, height, ...args) as
        | { canvas?: HTMLCanvasElement; elt?: HTMLCanvasElement }
        | undefined;

      const canvas = renderer?.canvas ?? renderer?.elt;

      if (canvas) {
        config.onSurfaceCanvasCreated?.(canvas);
      }

      return renderer;
    };

    // P5.js wrapper code that returns the functions
    const codeWithWrapper = `
			var setup, draw, preload, mousePressed, mouseReleased, mouseClicked, mouseMoved, mouseDragged, mouseWheel, doubleClicked, keyPressed, keyReleased, keyTyped, touchStarted, touchMoved, touchEnded, windowResized, deviceMoved, deviceTurned, deviceShaken;

			with (sketch) {
				${config.code}

				return { setup, draw, preload, mousePressed, mouseReleased, mouseClicked, mouseMoved, mouseDragged, mouseWheel, doubleClicked, keyPressed, keyReleased, keyTyped, touchStarted, touchMoved, touchEnded, windowResized, deviceMoved, deviceTurned, deviceShaken };
			}
		`;

    // Execute using JSRunner with P5-specific extra context
    return this.jsRunner.executeJavaScript(this.nodeId, codeWithWrapper, {
      customConsole: config.customConsole ?? console,
      setPortCount: config.messageContext?.setPortCount,
      setTitle: config.messageContext?.setTitle,
      extraContext: {
        sketch,
        noDrag: config.messageContext?.noDrag,
        noPan: config.messageContext?.noPan,
        noWheel: config.messageContext?.noWheel,
        noInteract: config.messageContext?.noInteract,
        noBorder: config.messageContext?.noBorder,
        noOutput: config.messageContext?.noOutput,
        setHidePorts: config.setHidePorts,
        settings: config.settings,
        createSurfaceCanvas,
        hideExitButton: config.hideExitButton,
        setMouseForwarding: config.setMouseForwarding,
        expandSurface: config.expandSurface,
        collapseSurface: config.collapseSurface,
        setPrimaryButton: (primaryButton: PrimaryButton) => {
          PatchiesEventBus.getInstance().dispatch({
            type: 'nodePrimaryButtonUpdate',
            nodeId: this.nodeId,
            primaryButton
          });
        }
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async loadCompatibilityLibraries(P5: any) {
    // Load P5.js v1 compatibility add-ons for P5.js v2
    // These preserve v1 APIs: preload(), bezierVertex(), curveVertex(), data structures, etc.
    const compatLibs = [
      { path: '/lib/p5/compat/preload.js', fn: 'addPreloadCompat' },
      { path: '/lib/p5/compat/shapes.js', fn: 'addShapesCompat' },
      { path: '/lib/p5/compat/data.js', fn: 'addDataCompat' }
    ];

    for (const lib of compatLibs) {
      // Load the script
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = lib.path;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${lib.path}`));
        document.head.appendChild(script);
      });

      // Call the compatibility function with P5 constructor
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const compatFn = (window as any)[lib.fn];
      if (compatFn) {
        compatFn(P5);
        // Clean up the global function
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (window as any)[lib.fn];
      }
    }
  }

  destroy() {
    if (this.p5) {
      this.p5.remove();
      this.p5 = null;
    }
    this.container = null;

    // Clean up JSRunner resources for this node
    this.jsRunner.destroy(this.nodeId);

    // Clean up VFS object URLs
    revokeObjectUrls(this.nodeId);
  }

  async sendBitmap() {
    // @ts-expect-error -- do not capture if bitmap is missing
    const canvas: HTMLCanvasElement = this.p5?.canvas;
    if (!canvas) return;

    this.onSurfaceFrame?.(canvas);

    if (!this.shouldSendBitmap) return;
    if (!this.glSystem.hasOutgoingVideoConnections(this.nodeId)) return;

    await this.glSystem.setBitmapSource(this.nodeId, canvas);
  }
}
