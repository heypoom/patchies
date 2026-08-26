import { describe, expect, it, vi } from 'vitest';

import type { RenderNode } from '$lib/rendering/types';

vi.mock('./hydraRenderer', () => ({ HydraRenderer: class {} }));
vi.mock('./canvasRenderer', () => ({ CanvasRenderer: class {} }));
vi.mock('./textmodeRenderer', () => ({ TextmodeRenderer: class {} }));
vi.mock('./threeRenderer', () => ({ ThreeRenderer: class {} }));
vi.mock('./pixiRenderer', () => ({ PixiRenderer: class {} }));
vi.mock('./reglRenderer', () => ({ ReglRenderer: class {} }));
vi.mock('./swglRenderer', () => ({ SwissGLRenderer: class {} }));
vi.mock('./shaderParkThreeRenderer', () => ({ ShaderParkThreeRenderer: class {} }));

vi.mock('$lib/projmap/ProjectionMapRenderer', () => ({ ProjectionMapRenderer: class {} }));

describe('NodeRendererRegistry Pixi lifecycle', () => {
  it('keeps cleanup attached after reusing a Pixi renderer', async () => {
    vi.stubGlobal('self', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval
    });

    const { NodeRendererRegistry } = await import('./NodeRendererRegistry');

    const existingRenderer = {
      updateConfig: vi.fn().mockResolvedValue(undefined),
      renderFrame: vi.fn(),
      destroy: vi.fn()
    };

    const pixiByNode = new Map([['pixi-node', existingRenderer as never]]);

    const registry = new NodeRendererRegistry({} as never, {
      hydraByNode: new Map(),
      canvasByNode: new Map(),
      textmodeByNode: new Map(),
      threeByNode: new Map(),
      pixiByNode,
      reglByNode: new Map(),
      projmapByNode: new Map(),
      swglByNode: new Map()
    });

    const node = {
      id: 'pixi-node',
      type: 'pixi',
      data: { code: 'stage.addChild(sprite)' }
    } as RenderNode;

    const framebuffer = {} as never;
    const result = await registry.create(node, framebuffer);

    expect(existingRenderer.updateConfig).toHaveBeenCalledWith(
      { code: 'stage.addChild(sprite)', nodeId: 'pixi-node', runRevision: undefined },
      framebuffer
    );

    result?.cleanup();

    expect(existingRenderer.destroy).toHaveBeenCalledTimes(1);
    expect(pixiByNode.has('pixi-node')).toBe(false);
  });
});
