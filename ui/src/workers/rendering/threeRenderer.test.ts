import { describe, expect, it, vi } from 'vitest';
import { ThreeRenderer } from './threeRenderer';

describe('ThreeRenderer', () => {
  it('resizes the Three renderer and render target when the framebuffer size changes', async () => {
    const previousFramebuffer = { width: 100, height: 50 };
    const nextFramebuffer = { width: 200, height: 100 };
    const renderer = Object.create(ThreeRenderer.prototype) as {
      updateConfig: ThreeRenderer['updateConfig'];
      config: { code: string; nodeId: string; runRevision: number };
      framebuffer: typeof previousFramebuffer;
      threeWebGLRenderer: { setSize: ReturnType<typeof vi.fn> };
      renderTarget: { setSize: ReturnType<typeof vi.fn> };
      updateCode: ReturnType<typeof vi.fn>;
    };

    renderer.config = { code: 'old code', nodeId: 'three-node', runRevision: 1 };
    renderer.framebuffer = previousFramebuffer;
    renderer.threeWebGLRenderer = { setSize: vi.fn() };
    renderer.renderTarget = { setSize: vi.fn() };
    renderer.updateCode = vi.fn().mockResolvedValue(undefined);

    await renderer.updateConfig(
      { code: 'new code', nodeId: 'three-node', runRevision: 2 },
      nextFramebuffer as unknown as Parameters<ThreeRenderer['updateConfig']>[1]
    );

    expect(renderer.threeWebGLRenderer.setSize).toHaveBeenCalledWith(200, 100, false);
    expect(renderer.renderTarget.setSize).toHaveBeenCalledWith(200, 100);
    expect(renderer.updateCode).toHaveBeenCalledTimes(1);
    expect(renderer.threeWebGLRenderer.setSize.mock.invocationCallOrder[0]).toBeLessThan(
      renderer.updateCode.mock.invocationCallOrder[0]
    );
  });
});
