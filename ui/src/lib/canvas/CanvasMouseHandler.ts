import { GLSystem } from './GLSystem';

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
  private glSystem: GLSystem;
  private config: MouseHandlerConfig;
  private isMouseDown = false;
  private mouseState = { x: 0, y: 0, z: -1, w: -1 };
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
    const handleLocalMouseMove = (event: MouseEvent) => {
      const rect = config.canvas.getBoundingClientRect();

      // Get position relative to canvas in screen pixels
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;

      // Map from displayed rect to actual framebuffer resolution (outputSize)
      // Hydra uses standard screen coordinates (Y-down, origin top-left)
      const x = (screenX / rect.width) * config.outputWidth;
      const y = (screenY / rect.height) * config.outputHeight;

      this.glSystem.setMouseData(config.nodeId, x, y, 0, 0);
    };

    console.log('local attached!');

    config.canvas.addEventListener('mousemove', handleLocalMouseMove);

    this.cleanupFn = () => {
      config.canvas.removeEventListener('mousemove', handleLocalMouseMove);
    };
  }

  private attachShadertoy(): void {
    const config = this.config as ShadertoyMouseConfig;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = config.canvas.getBoundingClientRect();

      // Get position relative to canvas in screen pixels
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;

      // Map from displayed rect to actual framebuffer resolution (outputSize)
      // Y is flipped because gl_FragCoord has origin at bottom, but mouse events have origin at top
      const x = (screenX / rect.width) * config.outputWidth;
      const y = config.outputHeight - (screenY / rect.height) * config.outputHeight;

      this.mouseState.x = x;
      this.mouseState.y = y;

      // Shadertoy spec: positive zw when mouse down (ongoing drag), negative when up (released)
      const z = this.isMouseDown ? Math.abs(this.mouseState.z) : -Math.abs(this.mouseState.z);
      const w = this.isMouseDown ? Math.abs(this.mouseState.w) : -Math.abs(this.mouseState.w);

      this.glSystem.setMouseData(config.nodeId, this.mouseState.x, this.mouseState.y, z, w);
    };

    const handleMouseDown = (event: MouseEvent) => {
      const rect = config.canvas.getBoundingClientRect();

      // Get position relative to canvas in screen pixels
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;

      // Map from displayed rect to actual framebuffer resolution (outputSize)
      // Y is flipped because gl_FragCoord has origin at bottom, but mouse events have origin at top
      const x = (screenX / rect.width) * config.outputWidth;
      const y = config.outputHeight - (screenY / rect.height) * config.outputHeight;

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
        this.mouseState.w
      );
    };

    const handleMouseUp = () => {
      this.isMouseDown = false;

      // Send negative values since mouse is now up (released)
      this.glSystem.setMouseData(
        config.nodeId,
        this.mouseState.x,
        this.mouseState.y,
        -Math.abs(this.mouseState.z),
        -Math.abs(this.mouseState.w)
      );
    };

    config.canvas.addEventListener('mousemove', handleMouseMove);
    config.canvas.addEventListener('mousedown', handleMouseDown);
    config.canvas.addEventListener('mouseup', handleMouseUp);
    config.canvas.addEventListener('mouseleave', handleMouseUp);

    this.cleanupFn = () => {
      config.canvas.removeEventListener('mousemove', handleMouseMove);
      config.canvas.removeEventListener('mousedown', handleMouseDown);
      config.canvas.removeEventListener('mouseup', handleMouseUp);
      config.canvas.removeEventListener('mouseleave', handleMouseUp);
    };
  }
}
