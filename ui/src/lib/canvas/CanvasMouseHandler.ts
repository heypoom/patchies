import { GLSystem } from './GLSystem';
import { match } from 'ts-pattern';

export type MouseScope = 'local' | 'global';

export interface SimpleMouseConfig {
  type: 'simple';
  nodeId: string;
  canvas: HTMLCanvasElement;
  outputWidth: number;
  outputHeight: number;
  scope: MouseScope;
}

export interface ShadertoyMouseConfig {
  type: 'shadertoy';
  nodeId: string;
  canvas: HTMLCanvasElement;
  outputWidth: number;
  outputHeight: number;
  wheelZoom?: boolean;
  wheelTarget?: 'shaderparkOrbit' | 'threeInteraction' | 'deckglInteraction';
  flipY?: boolean;
}

export type MouseHandlerConfig = SimpleMouseConfig | ShadertoyMouseConfig;

/**
 * Handles mouse tracking for canvas-based nodes.
 *
 * Supports two modes:
 * - Simple: Only x,y tracking with local (canvas-relative) or global (screen-relative) scope
 * - Shadertoy: iMouse-style tracking with x,y position and z,w click state
 */
export class CanvasMouseHandler {
  private static readonly TOUCH_GESTURE_DELAY_MS = 50;

  private glSystem: GLSystem;
  private config: MouseHandlerConfig;
  private isMouseDown = false;
  private mouseState = { x: 0, y: 0, z: -1, w: -1 };
  private primaryTouchId: number | null = null;
  private lastPinchDistance: number | null = null;
  private isPinching = false;
  private pendingTouchTimer: ReturnType<typeof setTimeout> | null = null;
  private cleanupFn: (() => void) | null = null;

  constructor(config: MouseHandlerConfig) {
    this.config = config;
    this.glSystem = GLSystem.getInstance();

    // Initialize mouse data
    if (config.type === 'shadertoy') {
      // Shadertoy: -1 for z,w means "no click yet"
      this.glSystem.setMouseData(config.nodeId, 0, 0, -1, -1);
    }
  }

  /**
   * Start listening for mouse events based on the configuration.
   */
  attach(): void {
    this.detach();

    if (this.config.type === 'simple') {
      this.attachSimple();
    } else {
      this.attachShadertoy();
    }
  }

  /**
   * Stop listening for mouse events and clean up.
   */
  detach(): void {
    if (this.cleanupFn) {
      this.cleanupFn();
      this.cleanupFn = null;
    }

    this.primaryTouchId = null;
    this.lastPinchDistance = null;
    this.isPinching = false;

    this.clearPendingTouchTimer();
  }

  /**
   * Update configuration (e.g., when scope changes).
   */
  updateConfig(updates: Partial<MouseHandlerConfig>): void {
    this.config = { ...this.config, ...updates } as MouseHandlerConfig;
    this.attach();
  }

  /**
   * Update the mouse scope.
   */
  setScope(scope: MouseScope): void {
    if (this.config.type !== 'simple') return;

    this.config.scope = scope;
    this.attach();
  }

  /**
   * Update output dimensions (used for coordinate mapping).
   */
  setOutputSize(width: number, height: number): void {
    this.config.outputWidth = width;
    this.config.outputHeight = height;
  }

  private attachSimple(): void {
    const config = this.config as SimpleMouseConfig;

    if (config.scope === 'global') {
      this.setupSimpleGlobalMouse(config.nodeId);
    } else {
      this.setupSimpleLocalMouse(config);
    }
  }

  private setupSimpleGlobalMouse(nodeId: string): void {
    const handleGlobalMouseMove = (event: MouseEvent) => {
      // Use screen coordinates directly (entire screen)
      const x = event.screenX;
      const y = event.screenY;

      this.glSystem.setMouseData(nodeId, x, y, 0, 0);
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);

    this.cleanupFn = () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }

  private setupSimpleLocalMouse(config: SimpleMouseConfig) {
    const sendLocalPosition = (clientX: number, clientY: number) => {
      const rect = config.canvas.getBoundingClientRect();

      // Get position relative to canvas in screen pixels
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;

      // Map from displayed rect to actual framebuffer resolution (outputSize)
      // Hydra uses standard screen coordinates (Y-down, origin top-left)
      const x = (screenX / rect.width) * config.outputWidth;
      const y = (screenY / rect.height) * config.outputHeight;

      this.glSystem.setMouseData(config.nodeId, x, y, 0, 0);
    };

    const handleLocalMouseMove = (event: MouseEvent) => {
      sendLocalPosition(event.clientX, event.clientY);
    };

    const handleTouchStart = (event: TouchEvent) => {
      this.lastPinchDistance = this.getPinchDistance(event.touches);

      if (event.touches.length >= 2) {
        this.isPinching = true;
        this.primaryTouchId = null;

        return;
      }

      if (this.isPinching) return;

      const touch = this.getPrimaryTouch(event);
      if (!touch) return;

      event.preventDefault();
      sendLocalPosition(touch.clientX, touch.clientY);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (this.isPinching) return;

      const touch = this.getPrimaryTouch(event);
      if (!touch) return;

      event.preventDefault();
      sendLocalPosition(touch.clientX, touch.clientY);
    };

    const handleTouchEnd = (event: TouchEvent) => {
      this.lastPinchDistance = this.getPinchDistance(event.touches);

      if (event.touches.length === 0) {
        this.isPinching = false;
      }

      if (this.primaryTouchId === null) return;
      if (this.findTouch(event.touches, this.primaryTouchId)) return;

      this.primaryTouchId = null;
    };

    config.canvas.addEventListener('mousemove', handleLocalMouseMove);
    config.canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    config.canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    config.canvas.addEventListener('touchend', handleTouchEnd);
    config.canvas.addEventListener('touchcancel', handleTouchEnd);

    this.cleanupFn = () => {
      config.canvas.removeEventListener('mousemove', handleLocalMouseMove);
      config.canvas.removeEventListener('touchstart', handleTouchStart);
      config.canvas.removeEventListener('touchmove', handleTouchMove);
      config.canvas.removeEventListener('touchend', handleTouchEnd);
      config.canvas.removeEventListener('touchcancel', handleTouchEnd);
    };
  }

  private attachShadertoy(): void {
    const config = this.config as ShadertoyMouseConfig;
    let pendingTouch: Touch | null = null;

    const getFramebufferPosition = (clientX: number, clientY: number) => {
      const rect = config.canvas.getBoundingClientRect();

      // Get position relative to canvas in screen pixels
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;

      // Map from displayed rect to actual framebuffer resolution (outputSize)
      // Y is flipped because gl_FragCoord has origin at bottom, but mouse events have origin at top
      const x = (screenX / rect.width) * config.outputWidth;
      const y = this.mapY(screenY, rect.height, config);

      return { x, y };
    };

    const moveMouse = (clientX: number, clientY: number, buttons: number) => {
      const { x, y } = getFramebufferPosition(clientX, clientY);

      this.mouseState.x = x;
      this.mouseState.y = y;

      // Shadertoy spec: positive zw when mouse down (ongoing drag), negative when up (released)
      const z = this.isMouseDown ? Math.abs(this.mouseState.z) : -Math.abs(this.mouseState.z);
      const w = this.isMouseDown ? Math.abs(this.mouseState.w) : -Math.abs(this.mouseState.w);

      this.glSystem.setMouseData(
        config.nodeId,
        this.mouseState.x,
        this.mouseState.y,
        z,
        w,
        buttons
      );
    };

    const downMouse = (clientX: number, clientY: number, buttons: number) => {
      const { x, y } = getFramebufferPosition(clientX, clientY);

      this.isMouseDown = true;
      this.mouseState.z = x;
      this.mouseState.w = y;
      this.mouseState.x = x;
      this.mouseState.y = y;

      // Send positive values since mouse is now down (ongoing drag)
      this.glSystem.setMouseData(
        config.nodeId,
        this.mouseState.x,
        this.mouseState.y,
        this.mouseState.z,
        this.mouseState.w,
        buttons || 1
      );
    };

    const upMouse = () => {
      this.isMouseDown = false;

      // Send negative values since mouse is now up (released)
      this.glSystem.setMouseData(
        config.nodeId,
        this.mouseState.x,
        this.mouseState.y,
        -Math.abs(this.mouseState.z),
        -Math.abs(this.mouseState.w),
        0
      );
    };

    const handleMouseMove = (event: MouseEvent) => {
      moveMouse(event.clientX, event.clientY, event.buttons);
    };

    const handleMouseDown = (event: MouseEvent) => {
      downMouse(event.clientX, event.clientY, event.buttons || 1);
    };

    const handleMouseUp = () => {
      upMouse();
    };

    const clearPendingTouch = () => {
      pendingTouch = null;
      this.clearPendingTouchTimer();
    };

    const flushPendingTouch = () => {
      if (!pendingTouch) return;

      const touch = pendingTouch;
      clearPendingTouch();

      downMouse(touch.clientX, touch.clientY, 1);
    };

    const handleTouchStart = (event: TouchEvent) => {
      this.lastPinchDistance = this.getPinchDistance(event.touches);

      if (event.touches.length >= 2) {
        clearPendingTouch();

        if (this.isMouseDown) {
          upMouse();
        }

        this.isPinching = true;
        this.primaryTouchId = null;

        return;
      }

      if (this.isPinching) return;

      const touch = this.getPrimaryTouch(event);
      if (!touch) return;

      event.preventDefault();
      pendingTouch = touch;
      this.clearPendingTouchTimer();
      this.pendingTouchTimer = setTimeout(
        flushPendingTouch,
        CanvasMouseHandler.TOUCH_GESTURE_DELAY_MS
      );
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (this.isPinching || event.touches.length >= 2) {
        clearPendingTouch();
        this.isPinching = true;
        this.forwardPinchWheel(event, config, getFramebufferPosition);
        return;
      }

      const touch = this.getPrimaryTouch(event);
      if (!touch) return;

      event.preventDefault();
      flushPendingTouch();
      moveMouse(touch.clientX, touch.clientY, 1);
    };

    const handleTouchEnd = (event: TouchEvent) => {
      this.lastPinchDistance = this.getPinchDistance(event.touches);

      if (this.isPinching) {
        if (event.touches.length === 0) {
          this.isPinching = false;
        }

        return;
      }

      flushPendingTouch();

      if (this.primaryTouchId === null) return;
      if (this.findTouch(event.touches, this.primaryTouchId)) return;

      this.primaryTouchId = null;
      upMouse();
    };

    const handleWheel = (event: WheelEvent) => {
      if (!config.wheelZoom) return;

      event.preventDefault();

      match(config.wheelTarget ?? 'shaderparkOrbit')
        .with('threeInteraction', () => {
          const rect = config.canvas.getBoundingClientRect();
          const screenX = event.clientX - rect.left;
          const screenY = event.clientY - rect.top;

          this.glSystem.sendThreeWheelData(config.nodeId, {
            x: (screenX / rect.width) * config.outputWidth,
            y: this.mapY(screenY, rect.height, config),

            deltaX: event.deltaX,
            deltaY: event.deltaY,
            deltaMode: event.deltaMode
          });
        })
        .with('deckglInteraction', () => {
          const rect = config.canvas.getBoundingClientRect();
          const screenX = event.clientX - rect.left;
          const screenY = event.clientY - rect.top;

          this.glSystem.sendThreeWheelData(config.nodeId, {
            x: (screenX / rect.width) * config.outputWidth,
            y: this.mapY(screenY, rect.height, config),
            deltaX: event.deltaX,
            deltaY: event.deltaY,
            deltaMode: event.deltaMode
          });
        })
        .with('shaderparkOrbit', () =>
          this.glSystem.zoomShaderParkOrbit(config.nodeId, event.deltaY)
        )
        .exhaustive();
    };

    config.canvas.addEventListener('mousemove', handleMouseMove);
    config.canvas.addEventListener('mousedown', handleMouseDown);
    config.canvas.addEventListener('mouseup', handleMouseUp);
    config.canvas.addEventListener('mouseleave', handleMouseUp);
    config.canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    config.canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    config.canvas.addEventListener('touchend', handleTouchEnd);
    config.canvas.addEventListener('touchcancel', handleTouchEnd);
    config.canvas.addEventListener('wheel', handleWheel, { passive: false });

    this.cleanupFn = () => {
      config.canvas.removeEventListener('mousemove', handleMouseMove);
      config.canvas.removeEventListener('mousedown', handleMouseDown);
      config.canvas.removeEventListener('mouseup', handleMouseUp);
      config.canvas.removeEventListener('mouseleave', handleMouseUp);
      config.canvas.removeEventListener('touchstart', handleTouchStart);
      config.canvas.removeEventListener('touchmove', handleTouchMove);
      config.canvas.removeEventListener('touchend', handleTouchEnd);
      config.canvas.removeEventListener('touchcancel', handleTouchEnd);
      config.canvas.removeEventListener('wheel', handleWheel);
      clearPendingTouch();
    };
  }

  private mapY(screenY: number, rectHeight: number, config: ShadertoyMouseConfig) {
    const y = (screenY / rectHeight) * config.outputHeight;

    return config.flipY === false ? y : config.outputHeight - y;
  }

  private getPrimaryTouch(event: TouchEvent): Touch | null {
    if (this.primaryTouchId !== null) {
      return this.findTouch(event.touches, this.primaryTouchId);
    }

    const touch = event.touches.item(0);
    this.primaryTouchId = touch?.identifier ?? null;

    return touch;
  }

  private findTouch(touches: TouchList, id: number): Touch | null {
    for (let index = 0; index < touches.length; index++) {
      const touch = touches.item(index);
      if (touch?.identifier === id) return touch;
    }

    return null;
  }

  private clearPendingTouchTimer(): void {
    if (!this.pendingTouchTimer) return;

    clearTimeout(this.pendingTouchTimer);
    this.pendingTouchTimer = null;
  }

  private forwardPinchWheel(
    event: TouchEvent,
    config: ShadertoyMouseConfig,
    getFramebufferPosition: (clientX: number, clientY: number) => { x: number; y: number }
  ): boolean {
    if (!config.wheelZoom) return false;

    const currentDistance = this.getPinchDistance(event.touches);

    if (currentDistance === null) {
      this.lastPinchDistance = null;

      return false;
    }

    const previousDistance = this.lastPinchDistance;
    this.lastPinchDistance = currentDistance;

    if (previousDistance === null) return true;

    event.preventDefault();

    const center = this.getPinchCenter(event.touches);
    const deltaY = previousDistance - currentDistance;

    match(config.wheelTarget ?? 'shaderparkOrbit')
      .with('threeInteraction', () => {
        const { x, y } = getFramebufferPosition(center.clientX, center.clientY);

        this.glSystem.sendThreeWheelData(config.nodeId, {
          x,
          y,
          deltaX: 0,
          deltaY,
          deltaMode: 0
        });
      })
      .with('deckglInteraction', () => {
        const { x, y } = getFramebufferPosition(center.clientX, center.clientY);

        this.glSystem.sendThreeWheelData(config.nodeId, {
          x,
          y,
          deltaX: 0,
          deltaY,
          deltaMode: 0
        });
      })
      .with('shaderparkOrbit', () => this.glSystem.zoomShaderParkOrbit(config.nodeId, deltaY))
      .exhaustive();

    return true;
  }

  private getPinchDistance(touches: TouchList): number | null {
    const first = touches.item(0);
    const second = touches.item(1);
    if (!first || !second) return null;

    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
  }

  private getPinchCenter(touches: TouchList) {
    const first = touches.item(0);
    const second = touches.item(1);

    return {
      clientX: ((first?.clientX ?? 0) + (second?.clientX ?? 0)) / 2,
      clientY: ((first?.clientY ?? 0) + (second?.clientY ?? 0)) / 2
    };
  }
}
