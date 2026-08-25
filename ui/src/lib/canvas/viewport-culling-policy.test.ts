import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/svelte';
import { ViewportCullingManager } from './ViewportCullingManager';
import { getViewportPersistentDomNodeIds } from './viewport-culling-policy';

const p5Node = (): Node => ({
  id: 'p5-1',
  type: 'p5',
  position: { x: 0, y: 0 },
  data: {}
});

const domVideoNode = (id: string, type: string): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: {}
});

const videoEdge: Edge = {
  id: 'p5-to-glsl',
  source: 'p5-1',
  target: 'glsl-1',
  sourceHandle: 'video-out-0',
  targetHandle: 'video-in-0'
};

const domVideoEdge = (source: string): Edge => ({
  id: `${source}-to-glsl`,
  source,
  target: 'glsl-1',
  sourceHandle: 'video-out-0',
  targetHandle: 'video-in-0'
});

describe('getViewportPersistentDomNodeIds', () => {
  it('keeps a connected p5 node live while global output or an output override is enabled', () => {
    expect(getViewportPersistentDomNodeIds([p5Node()], [videoEdge], true)).toEqual(
      new Set(['p5-1'])
    );
  });

  it('does not keep p5 live without an active output or video connection', () => {
    expect(getViewportPersistentDomNodeIds([p5Node()], [videoEdge], false)).toEqual(new Set());
    expect(getViewportPersistentDomNodeIds([p5Node()], [], true)).toEqual(new Set());
  });

  it('uses the video edge rather than inspecting p5 code', () => {
    const node = { ...p5Node(), data: { code: 'setVideoOutput(false)' } };

    expect(getViewportPersistentDomNodeIds([node], [videoEdge], true)).toEqual(new Set(['p5-1']));
  });

  it.each(['canvas.dom', 'pixi.dom', 'three.dom', 'textmode.dom'])(
    'keeps %s live when its video output is connected',
    (type) => {
      const node = domVideoNode(`${type}-1`, type);

      expect(getViewportPersistentDomNodeIds([node], [domVideoEdge(node.id)], true)).toEqual(
        new Set([node.id])
      );
    }
  );

  it('keeps a directly overridden DOM renderer live without a video edge', () => {
    const node = domVideoNode('canvas-dom-1', 'canvas.dom');

    expect(getViewportPersistentDomNodeIds([node], [], true, node.id)).toEqual(new Set([node.id]));
  });

  it('does not keep an unsupported directly overridden node live', () => {
    const node = domVideoNode('glsl-1', 'glsl');

    expect(getViewportPersistentDomNodeIds([node], [], true, node.id)).toEqual(new Set());
  });

  it('updates DOM visibility immediately when a p5 becomes persistent', () => {
    const manager = new ViewportCullingManager({ throttleMs: 1_000 });
    const viewport = { x: 0, y: 0, zoom: 1 };
    const offscreenP5 = { ...p5Node(), position: { x: 2_000, y: 2_000 } };

    manager.updateVisibleNodes(viewport, [offscreenP5], 1_000, 1_000);
    manager.updateVisibleNodes(viewport, [offscreenP5], 1_000, 1_000, new Set(['p5-1']));

    expect(manager.getVisibleDomNodes()).toEqual(new Set(['p5-1']));
  });
});
