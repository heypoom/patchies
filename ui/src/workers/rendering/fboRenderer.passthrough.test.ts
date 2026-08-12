import { describe, expect, it, vi } from 'vitest';
import type regl from 'regl';
import type { RenderNode, RenderParams } from '$lib/rendering/types';
import type { FBORenderer } from './fboRenderer';

vi.mock('./hydraRenderer', () => ({ HydraRenderer: class {} }));
vi.mock('./canvasRenderer', () => ({ CanvasRenderer: class {} }));
vi.mock('./textmodeRenderer', () => ({ TextmodeRenderer: class {} }));
vi.mock('./threeRenderer', () => ({ ThreeRenderer: class {} }));
vi.mock('./reglRenderer', () => ({ ReglRenderer: class {} }));
vi.mock('./swglRenderer', () => ({ SwissGLRenderer: class {} }));
vi.mock('./shaderParkThreeRenderer', () => ({ ShaderParkThreeRenderer: class {} }));
vi.mock('$lib/projmap/ProjectionMapRenderer', () => ({ ProjectionMapRenderer: class {} }));

describe('send.vdo passthrough', () => {
  it('copies a directly connected external video texture', async () => {
    vi.stubGlobal('self', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval
    });

    const { FBORenderer } = await import('./fboRenderer');

    const bindFramebuffer = vi.fn();
    const blitFramebuffer = vi.fn();

    const sourceTexture = { width: 640, height: 480 };
    const sourceFramebuffer = { _framebuffer: { framebuffer: 'webcam-fbo' } };
    const destinationTexture = { width: 1280, height: 720 };
    const renderer = Object.create(FBORenderer.prototype) as FBORenderer;

    const state = renderer as unknown as {
      fboNodes: Map<string, { texture: typeof destinationTexture; framebuffer: object }>;
      videoTextures: {
        getDestinationTexture: (nodeId: string) => typeof sourceTexture | undefined;
        getDestinationFBO: (nodeId: string) => typeof sourceFramebuffer | undefined;
      };
      gl: WebGL2RenderingContext;
    };

    state.fboNodes = new Map([
      [
        'send',
        { texture: destinationTexture, framebuffer: { _framebuffer: { framebuffer: 'send-fbo' } } }
      ]
    ]);

    state.videoTextures = {
      getDestinationTexture: (nodeId) => (nodeId === 'webcam' ? sourceTexture : undefined),
      getDestinationFBO: (nodeId) => (nodeId === 'webcam' ? sourceFramebuffer : undefined)
    };

    state.gl = {
      READ_FRAMEBUFFER: 1,
      DRAW_FRAMEBUFFER: 2,
      FRAMEBUFFER: 3,
      COLOR_BUFFER_BIT: 4,
      LINEAR: 5,
      bindFramebuffer,
      blitFramebuffer
    } as unknown as WebGL2RenderingContext;

    const node = {
      id: 'send',
      inletMap: new Map([[0, { sourceNodeId: 'webcam', outletIndex: 0 }]])
    } as RenderNode;

    renderer
      .createPassthroughRenderer(node, {
        _framebuffer: { framebuffer: 'send-fbo' }
      } as unknown as regl.Framebuffer2D)
      .render({} as RenderParams);

    expect(bindFramebuffer).toHaveBeenNthCalledWith(1, 1, 'webcam-fbo');
    expect(blitFramebuffer).toHaveBeenCalledWith(0, 0, 640, 480, 0, 0, 1280, 720, 4, 5);
  });
});
