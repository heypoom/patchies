import { beforeEach, describe, expect, it, vi } from 'vitest';

const glSystemMock = vi.hoisted(() => ({
  setMouseData: vi.fn()
}));

vi.mock('./GLSystem', () => ({
  GLSystem: { getInstance: () => glSystemMock }
}));

vi.mock('$lib/js-runner/handleCodeError', () => ({
  handleCodeError: vi.fn()
}));

import { CanvasMouseHandler } from './CanvasMouseHandler';
import { SurfaceListeners, type PointerEvent_ } from './SurfaceListeners';

type Listener = (event: any) => void;

class FakeCanvas {
  width = 100;
  height = 50;
  listeners = new Map<string, Listener[]>();

  getBoundingClientRect() {
    return { left: 10, top: 20, width: 200, height: 100 };
  }

  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((candidate) => candidate !== listener)
    );
  }

  emit(type: string, event: Record<string, unknown>) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ preventDefault: vi.fn(), ...event });
    }
  }
}

function touch(identifier: number, clientX: number, clientY: number, force = 0.5) {
  return { identifier, clientX, clientY, force };
}

function touchList(...touches: ReturnType<typeof touch>[]) {
  return Object.assign(touches, {
    item(index: number) {
      return touches[index] ?? null;
    }
  });
}

describe('touch mouse forwarding', () => {
  beforeEach(() => {
    glSystemMock.setMouseData.mockClear();
    vi.stubGlobal('getComputedStyle', () => ({ objectFit: 'contain' }));
  });

  it('treats primary touch on preview canvases as a left-button drag', () => {
    const canvas = new FakeCanvas();
    const handler = new CanvasMouseHandler({
      type: 'shadertoy',
      nodeId: 'three-1',
      canvas: canvas as unknown as HTMLCanvasElement,
      outputWidth: 100,
      outputHeight: 50,
      flipY: false
    });

    handler.attach();
    glSystemMock.setMouseData.mockClear();

    canvas.emit('touchstart', {
      touches: touchList(touch(7, 60, 40)),
      changedTouches: touchList(touch(7, 60, 40))
    });

    canvas.emit('touchmove', {
      touches: touchList(touch(7, 110, 70)),
      changedTouches: touchList(touch(7, 110, 70))
    });

    canvas.emit('touchend', {
      touches: touchList(),
      changedTouches: touchList(touch(7, 110, 70))
    });

    expect(glSystemMock.setMouseData).toHaveBeenNthCalledWith(1, 'three-1', 25, 10, 25, 10, 1);
    expect(glSystemMock.setMouseData).toHaveBeenNthCalledWith(2, 'three-1', 50, 25, 25, 10, 1);
    expect(glSystemMock.setMouseData).toHaveBeenNthCalledWith(3, 'three-1', 50, 25, -25, -10, 0);

    handler.detach();
  });

  it('forwards primary surface touch as pointer down, move, and up events', () => {
    const canvas = new FakeCanvas();
    const pointerEvents: PointerEvent_[] = [];
    const listeners = new SurfaceListeners();

    listeners.attach(canvas as unknown as HTMLCanvasElement, {
      onPointer: (event) => pointerEvents.push(event),
      onWheel: vi.fn(),
      onTouch: null,
      onLeave: vi.fn(),
      code: '',
      nodeId: 'surface-1',
      customConsole: {} as never,
      wrapperOffset: 0
    });

    canvas.emit('touchstart', {
      touches: touchList(touch(2, 60, 40)),
      changedTouches: touchList(touch(2, 60, 40))
    });
    canvas.emit('touchmove', {
      touches: touchList(touch(2, 110, 70)),
      changedTouches: touchList(touch(2, 110, 70))
    });
    canvas.emit('touchend', {
      touches: touchList(),
      changedTouches: touchList(touch(2, 110, 70))
    });

    expect(pointerEvents).toEqual([
      { x: 0.25, y: 0.2, pressure: 0.5, buttons: 1, down: true, type: 'down' },
      { x: 0.5, y: 0.5, pressure: 0.5, buttons: 1, down: true, type: 'move' },
      { x: 0.5, y: 0.5, pressure: 0.5, buttons: 0, down: false, type: 'up' }
    ]);

    listeners.detach();
  });
});
