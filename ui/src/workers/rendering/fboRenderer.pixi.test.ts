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

describe('FBORenderer Pixi lifecycle', () => {
  it('keeps cleanup attached after reusing a Pixi renderer', async () => {
    vi.stubGlobal('self', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval
    });

    const { FBORenderer } = await import('./fboRenderer');
    const existingRenderer = {
      updateConfig: vi.fn().mockResolvedValue(undefined),
      renderFrame: vi.fn(),
      destroy: vi.fn()
    };
    const renderer = Object.create(FBORenderer.prototype) as InstanceType<typeof FBORenderer>;
    const node = {
      id: 'pixi-node',
      type: 'pixi',
      data: { code: 'stage.addChild(sprite)' }
    } as RenderNode;
    const framebuffer = {} as Parameters<typeof renderer.createPixiRenderer>[1];

    renderer.pixiByNode = new Map([['pixi-node', existingRenderer as never]]);

    const result = await renderer.createPixiRenderer(node, framebuffer);

    expect(existingRenderer.updateConfig).toHaveBeenCalledWith(
      { code: 'stage.addChild(sprite)', nodeId: 'pixi-node', runRevision: undefined },
      framebuffer
    );

    result?.cleanup();

    expect(existingRenderer.destroy).toHaveBeenCalledTimes(1);
    expect(renderer.pixiByNode.has('pixi-node')).toBe(false);
  });
});
