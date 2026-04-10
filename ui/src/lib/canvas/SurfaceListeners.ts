import { handleCodeError } from '$lib/js-runner/handleCodeError';

export type PointerEvent_ = {
  x: number;
  y: number;
  pressure: number;
  buttons: number;
  down: boolean;
  type: string;
};

export type TouchPoint = {
  id: number;
  x: number;
  y: number;
  pressure: number;
};

export interface SurfaceListenersOptions {
  onPointer: (e: PointerEvent_) => void;
  onTouch: ((touches: TouchPoint[]) => void) | null;
  /** Called when pointer leaves the canvas */
  onLeave: () => void;
  /** For error reporting */
  code: string;
  nodeId: string;
  customConsole: ReturnType<typeof import('$lib/utils/createCustomConsole').createCustomConsole>;
  wrapperOffset: number;
}

export class SurfaceListeners {
  private cleanup: (() => void) | null = null;

  attach(canvas: HTMLCanvasElement, opts: SurfaceListenersOptions): void {
    this.detach();

    const normalize = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) / rect.width,
        y: (clientY - rect.top) / rect.height
      };
    };

    const normalizeTouches = (e: TouchEvent): TouchPoint[] => {
      const rect = canvas.getBoundingClientRect();
      return Array.from(e.touches).map((t) => ({
        id: t.identifier,
        x: (t.clientX - rect.left) / rect.width,
        y: (t.clientY - rect.top) / rect.height,
        pressure: t.force ?? 0
      }));
    };

    const fireTouches = (e: TouchEvent) => {
      e.preventDefault();
      if (!opts.onTouch) return;
      try {
        opts.onTouch(normalizeTouches(e));
      } catch (err) {
        handleCodeError(err, opts.code, opts.nodeId, opts.customConsole, opts.wrapperOffset);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const { x, y } = normalize(e.clientX, e.clientY);
      opts.onPointer({ x, y, pressure: 0, buttons: e.buttons, down: e.buttons > 0, type: 'move' });
    };
    const onPointerDown = (e: PointerEvent) => {
      const { x, y } = normalize(e.clientX, e.clientY);
      opts.onPointer({ x, y, pressure: 0, buttons: e.buttons || 1, down: true, type: 'down' });
    };
    const onPointerUp = (e: PointerEvent) => {
      const { x, y } = normalize(e.clientX, e.clientY);
      opts.onPointer({ x, y, pressure: 0, buttons: 0, down: false, type: 'up' });
    };
    const onPointerLeave = () => opts.onLeave();

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('touchstart', fireTouches, { passive: false });
    canvas.addEventListener('touchmove', fireTouches, { passive: false });
    canvas.addEventListener('touchend', fireTouches, { passive: false });

    this.cleanup = () => {
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('touchstart', fireTouches);
      canvas.removeEventListener('touchmove', fireTouches);
      canvas.removeEventListener('touchend', fireTouches);
    };
  }

  detach(): void {
    this.cleanup?.();
    this.cleanup = null;
  }
}
