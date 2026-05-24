import { describe, expect, it, vi } from 'vitest';
import type { Node } from '@xyflow/svelte';
import { CanvasPreviewExpandController } from './CanvasPreviewExpandController';
import type { SurfaceListenersOptions } from './SurfaceListeners';

const renderNode = (id: string, type: string): Node => ({
  id,
  type,
  data: {},
  position: { x: 0, y: 0 }
});

describe('CanvasPreviewExpandController', () => {
  it('pins the node, forwards overlay input to only that node, and restores the previous pin on exit', () => {
    let currentOverride: string | null = 'glsl-old';
    let active = false;
    let listenerOptions: SurfaceListenersOptions | undefined;
    let overlayExit: (() => void) | undefined;

    const canvas = {} as HTMLCanvasElement;
    const forwarder = {
      setForwardingRules: vi.fn(),
      forward: vi.fn(),
      forwardWheel: vi.fn(),
      dispose: vi.fn()
    };
    const listeners = {
      attach: vi.fn((_canvas: HTMLCanvasElement, opts: SurfaceListenersOptions) => {
        listenerOptions = opts;
      }),
      detach: vi.fn()
    };
    const overlay = {
      canvas,
      activate: vi.fn(
        (_nodeId: string, _nodes: { id: string; type?: string }[], onExit: () => void) => {
          overlayExit = onExit;
        }
      ),
      deactivate: vi.fn()
    };
    const setOverride = vi.fn((nodeId: string | null) => {
      currentOverride = nodeId;
    });

    const controller = new CanvasPreviewExpandController({
      nodeId: 'three-1',
      getNodes: () => [renderNode('three-1', 'three'), renderNode('glsl-old', 'glsl')],
      getOverrideOutputNode: () => currentOverride,
      setOverrideOutputNode: setOverride,
      overlay,
      createForwarder: () => forwarder,
      createListeners: () => listeners,
      onActiveChange: (next) => {
        active = next;
      }
    });

    controller.enter();

    expect(active).toBe(true);
    expect(setOverride).toHaveBeenCalledWith('three-1');
    expect(overlay.activate).toHaveBeenCalledWith(
      'three-1',
      [
        { id: 'three-1', type: 'three' },
        { id: 'glsl-old', type: 'glsl' }
      ],
      expect.any(Function)
    );
    expect(forwarder.setForwardingRules).toHaveBeenCalledWith({ only: ['three-1'] });
    expect(listeners.attach).toHaveBeenCalledWith(canvas, expect.any(Object));

    expect(listenerOptions).toBeDefined();
    const opts = listenerOptions as SurfaceListenersOptions;
    opts.onPointer({ x: 0.25, y: 0.5, pressure: 0, buttons: 1, down: true, type: 'down' });
    opts.onWheel({ x: 0.75, y: 0.25, deltaX: 1, deltaY: -20, deltaMode: 0 });

    expect(forwarder.forward).toHaveBeenCalledWith(0.25, 0.5, 1, 'down');
    expect(forwarder.forwardWheel).toHaveBeenCalledWith({
      x: 0.75,
      y: 0.25,
      deltaX: 1,
      deltaY: -20,
      deltaMode: 0
    });

    expect(overlayExit).toBeDefined();
    const exit = overlayExit as () => void;
    exit();

    expect(active).toBe(false);
    expect(listeners.detach).toHaveBeenCalled();
    expect(overlay.deactivate).toHaveBeenCalledWith('three-1');
    expect(forwarder.dispose).toHaveBeenCalled();
    expect(currentOverride).toBe('glsl-old');
    expect(setOverride).toHaveBeenLastCalledWith('glsl-old');
  });

  it('rolls back allocated resources and output pin when entering fails', () => {
    let currentOverride: string | null = 'glsl-old';
    let active = false;
    const error = new Error('attach failed');

    const forwarder = {
      setForwardingRules: vi.fn(),
      forward: vi.fn(),
      forwardWheel: vi.fn(),
      dispose: vi.fn()
    };
    const listeners = {
      attach: vi.fn(() => {
        throw error;
      }),
      detach: vi.fn()
    };
    const overlay = {
      canvas: {} as HTMLCanvasElement,
      activate: vi.fn(),
      deactivate: vi.fn()
    };
    const setOverride = vi.fn((nodeId: string | null) => {
      currentOverride = nodeId;
    });

    const controller = new CanvasPreviewExpandController({
      nodeId: 'three-1',
      getNodes: () => [renderNode('three-1', 'three')],
      getOverrideOutputNode: () => currentOverride,
      setOverrideOutputNode: setOverride,
      overlay,
      createForwarder: () => forwarder,
      createListeners: () => listeners,
      onActiveChange: (next) => {
        active = next;
      }
    });

    expect(() => controller.enter()).toThrow(error);

    expect(active).toBe(false);
    expect(controller.isActive).toBe(false);
    expect(listeners.detach).toHaveBeenCalled();
    expect(overlay.deactivate).toHaveBeenCalledWith('three-1');
    expect(forwarder.dispose).toHaveBeenCalled();
    expect(currentOverride).toBe('glsl-old');
    expect(setOverride).toHaveBeenLastCalledWith('glsl-old');
  });
});
