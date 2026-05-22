import { beforeEach, describe, expect, it, vi } from 'vitest';

const glSystemMock = vi.hoisted(() => ({
  setMouseData: vi.fn(),
  sendThreeWheelData: vi.fn(),
  zoomShaderParkOrbit: vi.fn()
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
    vi.useRealTimers();
    glSystemMock.setMouseData.mockClear();
    glSystemMock.sendThreeWheelData.mockClear();
    glSystemMock.zoomShaderParkOrbit.mockClear();
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

  it('translates preview pinch distance changes to existing wheel input', () => {
    const canvas = new FakeCanvas();
    const handler = new CanvasMouseHandler({
      type: 'shadertoy',
      nodeId: 'three-1',
      canvas: canvas as unknown as HTMLCanvasElement,
      outputWidth: 100,
      outputHeight: 50,
      wheelZoom: true,
      wheelTarget: 'threeInteraction',
      flipY: false
    });

    handler.attach();

    canvas.emit('touchstart', {
      touches: touchList(touch(1, 60, 40), touch(2, 100, 40)),
      changedTouches: touchList(touch(1, 60, 40), touch(2, 100, 40))
    });

    canvas.emit('touchmove', {
      touches: touchList(touch(1, 50, 40), touch(2, 110, 40)),
      changedTouches: touchList(touch(1, 50, 40), touch(2, 110, 40))
    });

    expect(glSystemMock.sendThreeWheelData).toHaveBeenCalledWith('three-1', {
      x: 35,
      y: 10,
      deltaX: 0,
      deltaY: -20,
      deltaMode: 0
    });

    handler.detach();
  });

  it('cancels preview drag when a second touch starts pinch zoom', () => {
    const canvas = new FakeCanvas();

    const handler = new CanvasMouseHandler({
      type: 'shadertoy',
      nodeId: 'three-1',
      canvas: canvas as unknown as HTMLCanvasElement,
      outputWidth: 100,
      outputHeight: 50,
      wheelZoom: true,
      wheelTarget: 'threeInteraction',
      flipY: false
    });

    handler.attach();
    glSystemMock.setMouseData.mockClear();

    canvas.emit('touchstart', {
      touches: touchList(touch(1, 60, 40)),
      changedTouches: touchList(touch(1, 60, 40))
    });

    canvas.emit('touchmove', {
      touches: touchList(touch(1, 60, 40)),
      changedTouches: touchList(touch(1, 60, 40))
    });

    canvas.emit('touchstart', {
      touches: touchList(touch(1, 60, 40), touch(2, 100, 40)),
      changedTouches: touchList(touch(2, 100, 40))
    });

    canvas.emit('touchmove', {
      touches: touchList(touch(1, 50, 40), touch(2, 110, 40)),
      changedTouches: touchList(touch(1, 50, 40), touch(2, 110, 40))
    });

    expect(glSystemMock.setMouseData).toHaveBeenNthCalledWith(1, 'three-1', 25, 10, 25, 10, 1);
    expect(glSystemMock.setMouseData).toHaveBeenNthCalledWith(2, 'three-1', 25, 10, 25, 10, 1);
    expect(glSystemMock.setMouseData).toHaveBeenNthCalledWith(3, 'three-1', 25, 10, -25, -10, 0);
    expect(glSystemMock.setMouseData).toHaveBeenCalledTimes(3);

    expect(glSystemMock.sendThreeWheelData).toHaveBeenCalledWith('three-1', {
      x: 35,
      y: 10,
      deltaX: 0,
      deltaY: -20,
      deltaMode: 0
    });

    handler.detach();
  });

  it('does not start preview drag when the second pinch touch arrives immediately', () => {
    vi.useFakeTimers();

    const canvas = new FakeCanvas();

    const handler = new CanvasMouseHandler({
      type: 'shadertoy',
      nodeId: 'three-1',
      canvas: canvas as unknown as HTMLCanvasElement,
      outputWidth: 100,
      outputHeight: 50,
      wheelZoom: true,
      wheelTarget: 'threeInteraction',
      flipY: false
    });

    handler.attach();
    glSystemMock.setMouseData.mockClear();

    canvas.emit('touchstart', {
      touches: touchList(touch(1, 60, 40)),
      changedTouches: touchList(touch(1, 60, 40))
    });

    expect(glSystemMock.setMouseData).not.toHaveBeenCalled();

    canvas.emit('touchstart', {
      touches: touchList(touch(1, 60, 40), touch(2, 100, 40)),
      changedTouches: touchList(touch(2, 100, 40))
    });

    vi.runAllTimers();

    canvas.emit('touchmove', {
      touches: touchList(touch(1, 50, 40), touch(2, 110, 40)),
      changedTouches: touchList(touch(1, 50, 40), touch(2, 110, 40))
    });

    expect(glSystemMock.setMouseData).not.toHaveBeenCalled();
    expect(glSystemMock.sendThreeWheelData).toHaveBeenCalledWith('three-1', {
      x: 35,
      y: 10,
      deltaX: 0,
      deltaY: -20,
      deltaMode: 0
    });

    handler.detach();
    vi.useRealTimers();
  });

  it('translates Shader Park preview pinch to orbit zoom', () => {
    const canvas = new FakeCanvas();
    const handler = new CanvasMouseHandler({
      type: 'shadertoy',
      nodeId: 'shaderpark-1',
      canvas: canvas as unknown as HTMLCanvasElement,
      outputWidth: 100,
      outputHeight: 50,
      wheelZoom: true
    });

    handler.attach();

    canvas.emit('touchstart', {
      touches: touchList(touch(1, 60, 40), touch(2, 100, 40)),
      changedTouches: touchList(touch(1, 60, 40), touch(2, 100, 40))
    });

    canvas.emit('touchmove', {
      touches: touchList(touch(1, 50, 40), touch(2, 110, 40)),
      changedTouches: touchList(touch(1, 50, 40), touch(2, 110, 40))
    });

    expect(glSystemMock.zoomShaderParkOrbit).toHaveBeenCalledWith('shaderpark-1', -20);

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

  it('translates surface pinch distance changes to wheel events', () => {
    const canvas = new FakeCanvas();
    const onWheel = vi.fn();
    const listeners = new SurfaceListeners();

    listeners.attach(canvas as unknown as HTMLCanvasElement, {
      onPointer: vi.fn(),
      onWheel,
      onTouch: null,
      onLeave: vi.fn(),
      code: '',
      nodeId: 'surface-1',
      customConsole: {} as never,
      wrapperOffset: 0
    });

    canvas.emit('touchstart', {
      touches: touchList(touch(1, 60, 40), touch(2, 100, 40)),
      changedTouches: touchList(touch(1, 60, 40), touch(2, 100, 40))
    });

    canvas.emit('touchmove', {
      touches: touchList(touch(1, 50, 40), touch(2, 110, 40)),
      changedTouches: touchList(touch(1, 50, 40), touch(2, 110, 40))
    });

    expect(onWheel).toHaveBeenCalledWith({
      x: 0.35,
      y: 0.2,
      deltaX: 0,
      deltaY: -20,
      deltaMode: 0
    });

    listeners.detach();
  });

  it('cancels surface pointer drag when a second touch starts pinch zoom', () => {
    const canvas = new FakeCanvas();
    const pointerEvents: PointerEvent_[] = [];
    const onWheel = vi.fn();
    const listeners = new SurfaceListeners();

    listeners.attach(canvas as unknown as HTMLCanvasElement, {
      onPointer: (event) => pointerEvents.push(event),
      onWheel,
      onTouch: null,
      onLeave: vi.fn(),
      code: '',
      nodeId: 'surface-1',
      customConsole: {} as never,
      wrapperOffset: 0
    });

    canvas.emit('touchstart', {
      touches: touchList(touch(1, 60, 40)),
      changedTouches: touchList(touch(1, 60, 40))
    });

    canvas.emit('touchmove', {
      touches: touchList(touch(1, 60, 40)),
      changedTouches: touchList(touch(1, 60, 40))
    });

    canvas.emit('touchstart', {
      touches: touchList(touch(1, 60, 40), touch(2, 100, 40)),
      changedTouches: touchList(touch(2, 100, 40))
    });

    canvas.emit('touchmove', {
      touches: touchList(touch(1, 50, 40), touch(2, 110, 40)),
      changedTouches: touchList(touch(1, 50, 40), touch(2, 110, 40))
    });

    expect(pointerEvents).toEqual([
      { x: 0.25, y: 0.2, pressure: 0.5, buttons: 1, down: true, type: 'down' },
      { x: 0.25, y: 0.2, pressure: 0.5, buttons: 1, down: true, type: 'move' },
      { x: 0.25, y: 0.2, pressure: 0.5, buttons: 0, down: false, type: 'up' }
    ]);

    expect(onWheel).toHaveBeenCalledWith({
      x: 0.35,
      y: 0.2,
      deltaX: 0,
      deltaY: -20,
      deltaMode: 0
    });

    listeners.detach();
  });

  it('does not start surface pointer drag when the second pinch touch arrives immediately', () => {
    vi.useFakeTimers();

    const canvas = new FakeCanvas();
    const pointerEvents: PointerEvent_[] = [];
    const onWheel = vi.fn();
    const listeners = new SurfaceListeners();

    listeners.attach(canvas as unknown as HTMLCanvasElement, {
      onPointer: (event) => pointerEvents.push(event),
      onWheel,
      onTouch: null,
      onLeave: vi.fn(),
      code: '',
      nodeId: 'surface-1',
      customConsole: {} as never,
      wrapperOffset: 0
    });

    canvas.emit('touchstart', {
      touches: touchList(touch(1, 60, 40)),
      changedTouches: touchList(touch(1, 60, 40))
    });

    expect(pointerEvents).toEqual([]);

    canvas.emit('touchstart', {
      touches: touchList(touch(1, 60, 40), touch(2, 100, 40)),
      changedTouches: touchList(touch(2, 100, 40))
    });

    vi.runAllTimers();

    canvas.emit('touchmove', {
      touches: touchList(touch(1, 50, 40), touch(2, 110, 40)),
      changedTouches: touchList(touch(1, 50, 40), touch(2, 110, 40))
    });

    expect(pointerEvents).toEqual([]);

    expect(onWheel).toHaveBeenCalledWith({
      x: 0.35,
      y: 0.2,
      deltaX: 0,
      deltaY: -20,
      deltaMode: 0
    });

    listeners.detach();
    vi.useRealTimers();
  });

  it('ignores touch-origin PointerEvents on surface so touch handling owns the gesture', () => {
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

    canvas.emit('pointerdown', {
      pointerType: 'touch',
      clientX: 60,
      clientY: 40,
      buttons: 1
    });
    canvas.emit('pointermove', {
      pointerType: 'touch',
      clientX: 110,
      clientY: 70,
      buttons: 1
    });
    canvas.emit('pointerup', {
      pointerType: 'touch',
      clientX: 110,
      clientY: 70,
      buttons: 0
    });

    expect(pointerEvents).toEqual([]);

    listeners.detach();
  });

  it('does not leak touch-origin PointerEvents while surface pinch is being disambiguated', () => {
    vi.useFakeTimers();

    const canvas = new FakeCanvas();
    const pointerEvents: PointerEvent_[] = [];
    const onWheel = vi.fn();
    const listeners = new SurfaceListeners();

    listeners.attach(canvas as unknown as HTMLCanvasElement, {
      onPointer: (event) => pointerEvents.push(event),
      onWheel,
      onTouch: null,
      onLeave: vi.fn(),
      code: '',
      nodeId: 'surface-1',
      customConsole: {} as never,
      wrapperOffset: 0
    });

    canvas.emit('pointerdown', {
      pointerType: 'touch',
      clientX: 60,
      clientY: 40,
      buttons: 1
    });

    canvas.emit('touchstart', {
      touches: touchList(touch(1, 60, 40)),
      changedTouches: touchList(touch(1, 60, 40))
    });

    canvas.emit('pointerdown', {
      pointerType: 'touch',
      clientX: 100,
      clientY: 40,
      buttons: 1
    });

    canvas.emit('touchstart', {
      touches: touchList(touch(1, 60, 40), touch(2, 100, 40)),
      changedTouches: touchList(touch(2, 100, 40))
    });

    vi.runAllTimers();

    canvas.emit('pointermove', {
      pointerType: 'touch',
      clientX: 110,
      clientY: 40,
      buttons: 1
    });

    canvas.emit('touchmove', {
      touches: touchList(touch(1, 50, 40), touch(2, 110, 40)),
      changedTouches: touchList(touch(1, 50, 40), touch(2, 110, 40))
    });

    expect(pointerEvents).toEqual([]);

    expect(onWheel).toHaveBeenCalledWith({
      x: 0.35,
      y: 0.2,
      deltaX: 0,
      deltaY: -20,
      deltaMode: 0
    });

    listeners.detach();
    vi.useRealTimers();
  });
});
