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

    /**
     * Compute the content rect for a canvas, accounting for object-fit: cover.
     * For a cover-fit canvas, the content may overflow the CSS box.
     * For a normal canvas, this returns the bounding rect as-is.
     */
    const getContentRect = () => {
      const box = canvas.getBoundingClientRect();
      const style = getComputedStyle(canvas);

      if (style.objectFit !== 'cover') {
        return { left: box.left, top: box.top, width: box.width, height: box.height };
      }

      const scale = Math.max(box.width / canvas.width, box.height / canvas.height);
      const contentWidth = canvas.width * scale;
      const contentHeight = canvas.height * scale;

      return {
        left: box.left + (box.width - contentWidth) / 2,
        top: box.top + (box.height - contentHeight) / 2,
        width: contentWidth,
        height: contentHeight
      };
    };

    const normalize = (clientX: number, clientY: number) => {
      const rect = getContentRect();
      return {
        x: (clientX - rect.left) / rect.width,
        y: (clientY - rect.top) / rect.height
      };
    };

    const normalizeTouches = (e: TouchEvent): TouchPoint[] => {
      const rect = getContentRect();
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
      try {
        opts.onPointer({
          x,
          y,
          pressure: 0,
          buttons: e.buttons,
          down: e.buttons > 0,
          type: 'move'
        });
      } catch (err) {
        handleCodeError(err, opts.code, opts.nodeId, opts.customConsole, opts.wrapperOffset);
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      const { x, y } = normalize(e.clientX, e.clientY);
      try {
        opts.onPointer({ x, y, pressure: 0, buttons: e.buttons || 1, down: true, type: 'down' });
      } catch (err) {
        handleCodeError(err, opts.code, opts.nodeId, opts.customConsole, opts.wrapperOffset);
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      const { x, y } = normalize(e.clientX, e.clientY);
      try {
        opts.onPointer({ x, y, pressure: 0, buttons: 0, down: false, type: 'up' });
      } catch (err) {
        handleCodeError(err, opts.code, opts.nodeId, opts.customConsole, opts.wrapperOffset);
      }
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
