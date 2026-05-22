import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Node } from '@xyflow/svelte';

const glSystemMock = vi.hoisted(() => ({
  outputSize: [100, 50] as [number, number],
  setMouseData: vi.fn(),
  sendThreeWheelData: vi.fn(),
  zoomShaderParkOrbit: vi.fn()
}));

const eventBusMock = vi.hoisted(() => {
  const listeners = new Map<string, ((event: { type: string; nodes?: Node[] }) => void)[]>();

  return {
    listeners,
    dispatch: vi.fn((event: { type: string; nodes?: Node[] }) => {
      for (const listener of listeners.get(event.type) ?? []) {
        listener(event);
      }
    }),
    addEventListener: vi.fn(
      (type: string, listener: (event: { type: string; nodes?: Node[] }) => void) => {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      }
    ),
    removeEventListener: vi.fn(
      (type: string, listener: (event: { type: string; nodes?: Node[] }) => void) => {
        listeners.set(
          type,
          (listeners.get(type) ?? []).filter((candidate) => candidate !== listener)
        );
      }
    )
  };
});

vi.mock('./GLSystem', () => ({
  GLSystem: { getInstance: () => glSystemMock }
}));

vi.mock('$lib/eventbus/PatchiesEventBus', () => ({
  PatchiesEventBus: { getInstance: () => eventBusMock }
}));

import { SurfaceMouseForwarder } from './SurfaceMouseForwarder';

describe('SurfaceMouseForwarder', () => {
  beforeEach(() => {
    glSystemMock.setMouseData.mockClear();
    glSystemMock.sendThreeWheelData.mockClear();
    glSystemMock.zoomShaderParkOrbit.mockClear();
    eventBusMock.listeners.clear();
    eventBusMock.dispatch.mockClear();
    eventBusMock.addEventListener.mockClear();
    eventBusMock.removeEventListener.mockClear();
  });

  const renderNode = (id: string, type: string, data: Record<string, unknown> = {}): Node => ({
    id,
    type,
    data,
    position: { x: 0, y: 0 }
  });

  it('refreshes pointer forwarding targets when graph change event fires', () => {
    const nodes = [renderNode('glsl-1', 'glsl')];
    const forwarder = new SurfaceMouseForwarder(() => nodes);

    nodes.push(renderNode('hydra-1', 'hydra'));
    eventBusMock.dispatch({ type: 'surfaceMouseForwardingGraphChanged', nodes });

    forwarder.forward(0.5, 0.25, 0, 'move');

    expect(glSystemMock.setMouseData).toHaveBeenCalledWith('hydra-1', 50, 12.5, 0, 0);
    forwarder.dispose();
  });

  it('refreshes wheel forwarding targets when graph change event fires', () => {
    const nodes = [renderNode('three-1', 'three')];
    const forwarder = new SurfaceMouseForwarder(() => nodes);

    nodes.push(renderNode('shaderpark-1', 'shaderpark', { renderMode: '3d' }));
    eventBusMock.dispatch({ type: 'surfaceMouseForwardingGraphChanged', nodes });

    forwarder.forwardWheel({ x: 0.5, y: 0.25, deltaX: 0, deltaY: -20, deltaMode: 0 });

    expect(glSystemMock.sendThreeWheelData).toHaveBeenCalledWith('three-1', {
      x: 50,
      y: 12.5,
      deltaX: 0,
      deltaY: -20,
      deltaMode: 0
    });

    expect(glSystemMock.zoomShaderParkOrbit).toHaveBeenCalledWith('shaderpark-1', -20);
    forwarder.dispose();
  });
});
