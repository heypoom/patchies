import { describe, expect, it, vi } from 'vitest';
import type { Node } from '@xyflow/svelte';
import { CanvasDomExpandController } from './CanvasDomExpandController';

const renderNode = (id: string, type: string): Node => ({
  id,
  type,
  data: {},
  position: { x: 0, y: 0 }
});

describe('CanvasDomExpandController', () => {
  it('uses custom overlay content and keeps the live canvas focused', () => {
    let overlayExit: (() => void) | undefined;
    let active = false;
    const focusCanvas = vi.fn();

    const overlay = {
      activate: vi.fn(
        (_nodeId: string, _nodes: { id: string; type?: string }[], onExit: () => void) => {
          overlayExit = onExit;
        }
      ),
      deactivate: vi.fn()
    };

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);

      return 0;
    });

    const controller = new CanvasDomExpandController({
      nodeId: 'canvas-dom-1',
      getNodes: () => [renderNode('canvas-dom-1', 'canvas.dom'), renderNode('glsl-1', 'glsl')],
      overlay,
      onActiveChange: (next) => {
        active = next;
      },
      focusCanvas
    });

    controller.enter();

    expect(active).toBe(true);
    expect(focusCanvas).toHaveBeenCalledOnce();

    expect(overlay.activate).toHaveBeenCalledWith(
      'canvas-dom-1',
      [
        { id: 'canvas-dom-1', type: 'canvas.dom' },
        { id: 'glsl-1', type: 'glsl' }
      ],
      expect.any(Function),
      { content: 'custom' }
    );

    (overlayExit as () => void)();

    expect(active).toBe(false);
    expect(overlay.deactivate).toHaveBeenCalledWith('canvas-dom-1');

    vi.unstubAllGlobals();
  });
});
