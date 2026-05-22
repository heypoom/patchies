import { handleCodeError } from '$lib/js-runner/handleCodeError';
import { match } from 'ts-pattern';

export type PointerEvent_ = {
  x: number;
  y: number;
  pressure: number;
  buttons: number;
  down: boolean;
  type: string;
};

export type SurfaceWheelEvent_ = {
  x: number;
  y: number;
  deltaX: number;
  deltaY: number;
  deltaMode: number;
};

export type TouchPoint = {
  id: number;
  x: number;
  y: number;
  pressure: number;
};

export interface SurfaceListenersOptions {
  onPointer: (e: PointerEvent_) => void;
  onWheel: (e: SurfaceWheelEvent_) => void;
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
  private static readonly TOUCH_GESTURE_DELAY_MS = 50;

  private cleanup: (() => void) | null = null;
  private primaryTouchId: number | null = null;
  private lastPinchDistance: number | null = null;
  private isPinching = false;
  private pendingTouchTimer: ReturnType<typeof setTimeout> | null = null;

  attach(canvas: HTMLCanvasElement, opts: SurfaceListenersOptions): void {
    this.detach();
    let pendingTouch: Touch | null = null;

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

    const normalizeTouch = (touch: Touch): TouchPoint => {
      const rect = getContentRect();

      return {
        id: touch.identifier,
        x: (touch.clientX - rect.left) / rect.width,
        y: (touch.clientY - rect.top) / rect.height,
        pressure: touch.force ?? 0
      };
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

    const fireTouchPointer = (event: TouchEvent, type: 'down' | 'move' | 'up') => {
      const touch = match(type)
        .with('up', () => {
          if (this.primaryTouchId === null) return null;
          if (this.findTouch(event.touches, this.primaryTouchId)) return null;

          const endedTouch = this.findTouch(event.changedTouches, this.primaryTouchId);
          this.primaryTouchId = null;

          return endedTouch;
        })
        .otherwise(() => this.getPrimaryTouch(event));

      if (!touch) return;

      const point = normalizeTouch(touch);

      try {
        opts.onPointer({
          x: point.x,
          y: point.y,
          pressure: point.pressure,
          buttons: type === 'up' ? 0 : 1,
          down: type !== 'up',
          type
        });
      } catch (err) {
        handleCodeError(err, opts.code, opts.nodeId, opts.customConsole, opts.wrapperOffset);
      }
    };

    const fireTouchPoint = (touch: Touch, type: 'down' | 'move' | 'up') => {
      const point = normalizeTouch(touch);

      try {
        opts.onPointer({
          x: point.x,
          y: point.y,
          pressure: point.pressure,
          buttons: type === 'up' ? 0 : 1,
          down: type !== 'up',
          type
        });
      } catch (err) {
        handleCodeError(err, opts.code, opts.nodeId, opts.customConsole, opts.wrapperOffset);
      }
    };

    const clearPendingTouch = () => {
      pendingTouch = null;
      this.clearPendingTouchTimer();
    };

    const flushPendingTouch = () => {
      if (!pendingTouch) return;

      const touch = pendingTouch;
      clearPendingTouch();
      fireTouchPoint(touch, 'down');
    };

    const cancelActiveTouchPointer = (event: TouchEvent) => {
      if (pendingTouch) {
        clearPendingTouch();
        this.primaryTouchId = null;

        return;
      }

      if (this.primaryTouchId === null) return;

      const touch = this.findTouch(event.touches, this.primaryTouchId);
      if (!touch) return;

      const point = normalizeTouch(touch);
      this.primaryTouchId = null;

      try {
        opts.onPointer({
          x: point.x,
          y: point.y,
          pressure: point.pressure,
          buttons: 0,
          down: false,
          type: 'up'
        });
      } catch (err) {
        handleCodeError(err, opts.code, opts.nodeId, opts.customConsole, opts.wrapperOffset);
      }
    };

    const firePinchWheel = (event: TouchEvent) => {
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
      const { x, y } = normalize(center.clientX, center.clientY);

      try {
        opts.onWheel({
          x,
          y,
          deltaX: 0,
          deltaY: previousDistance - currentDistance,
          deltaMode: 0
        });
      } catch (err) {
        handleCodeError(err, opts.code, opts.nodeId, opts.customConsole, opts.wrapperOffset);
      }

      return true;
    };

    const onTouchStart = (event: TouchEvent) => {
      fireTouches(event);

      this.lastPinchDistance = this.getPinchDistance(event.touches);

      if (event.touches.length >= 2) {
        cancelActiveTouchPointer(event);
        this.isPinching = true;
        return;
      }

      if (this.isPinching) return;

      const touch = this.getPrimaryTouch(event);
      if (!touch) return;

      pendingTouch = touch;
      this.clearPendingTouchTimer();
      this.pendingTouchTimer = setTimeout(
        flushPendingTouch,
        SurfaceListeners.TOUCH_GESTURE_DELAY_MS
      );
    };

    const onTouchMove = (event: TouchEvent) => {
      fireTouches(event);
      if (this.isPinching || event.touches.length >= 2) {
        clearPendingTouch();
        this.isPinching = true;
        firePinchWheel(event);
        return;
      }

      flushPendingTouch();
      fireTouchPointer(event, 'move');
    };

    const onTouchEnd = (event: TouchEvent) => {
      fireTouches(event);

      this.lastPinchDistance = this.getPinchDistance(event.touches);

      if (this.isPinching) {
        if (event.touches.length === 0) {
          this.isPinching = false;
        }

        return;
      }

      flushPendingTouch();
      fireTouchPointer(event, 'up');
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;

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
      if (e.pointerType === 'touch') return;

      const { x, y } = normalize(e.clientX, e.clientY);

      try {
        opts.onPointer({ x, y, pressure: 0, buttons: e.buttons || 1, down: true, type: 'down' });
      } catch (err) {
        handleCodeError(err, opts.code, opts.nodeId, opts.customConsole, opts.wrapperOffset);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;

      const { x, y } = normalize(e.clientX, e.clientY);

      try {
        opts.onPointer({ x, y, pressure: 0, buttons: 0, down: false, type: 'up' });
      } catch (err) {
        handleCodeError(err, opts.code, opts.nodeId, opts.customConsole, opts.wrapperOffset);
      }
    };

    const onPointerLeave = () => opts.onLeave();

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const { x, y } = normalize(e.clientX, e.clientY);

      try {
        opts.onWheel({
          x,
          y,
          deltaX: e.deltaX,
          deltaY: e.deltaY,
          deltaMode: e.deltaMode
        });
      } catch (err) {
        handleCodeError(err, opts.code, opts.nodeId, opts.customConsole, opts.wrapperOffset);
      }
    };

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

    this.cleanup = () => {
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);

      clearPendingTouch();
    };
  }

  detach(): void {
    this.cleanup?.();
    this.cleanup = null;
    this.primaryTouchId = null;
    this.lastPinchDistance = null;
    this.isPinching = false;
    this.clearPendingTouchTimer();
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
