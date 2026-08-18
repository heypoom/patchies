import { describe, expect, it, vi } from 'vitest';
import type { RenderNode } from '$lib/rendering/types';
import type { FBORenderer } from './fboRenderer';

vi.mock('./hydraRenderer', () => ({ HydraRenderer: class {} }));
vi.mock('./canvasRenderer', () => ({ CanvasRenderer: class {} }));
vi.mock('./textmodeRenderer', () => ({ TextmodeRenderer: class {} }));
vi.mock('./threeRenderer', () => ({ ThreeRenderer: class {} }));
vi.mock('./reglRenderer', () => ({ ReglRenderer: class {} }));
vi.mock('./swglRenderer', () => ({ SwissGLRenderer: class {} }));
vi.mock('./shaderParkThreeRenderer', () => ({ ShaderParkThreeRenderer: class {} }));
vi.mock('$lib/projmap/ProjectionMapRenderer', () => ({ ProjectionMapRenderer: class {} }));

describe('send.vdo and recv.vdo routing', () => {
  it('binds the original external texture after wireless routing', async () => {
    vi.stubGlobal('self', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval
    });

    const { FBORenderer } = await import('./fboRenderer');

    const sourceTexture = { width: 640, height: 480 };
    const renderer = Object.create(FBORenderer.prototype) as FBORenderer;

    const state = renderer as unknown as {
      fboNodes: Map<string, unknown>;
      renderGraph: { nodes: RenderNode[] };
      videoTextures: {
        getDestinationTexture: (nodeId: string) => typeof sourceTexture | undefined;
      };
    };

    state.fboNodes = new Map();

    state.videoTextures = {
      getDestinationTexture: (nodeId) => (nodeId === 'webcam' ? sourceTexture : undefined)
    };

    const send = {
      id: 'send',
      type: 'send.vdo',
      inletMap: new Map([[0, { sourceNodeId: 'webcam', outletIndex: 0 }]])
    } as RenderNode;

    const receive = {
      id: 'receive',
      type: 'recv.vdo',
      inletMap: new Map([[0, { sourceNodeId: 'send', outletIndex: 0 }]])
    } as RenderNode;

    const consumer = {
      id: 'consumer',
      type: 'glsl',
      inletMap: new Map([[0, { sourceNodeId: 'receive', outletIndex: 0 }]])
    } as RenderNode;

    state.renderGraph = { nodes: [send, receive, consumer] };

    const textureMap = (
      renderer as never as { getInputTextureMap: (node: RenderNode) => Map<number, unknown> }
    ).getInputTextureMap(consumer);

    expect(textureMap.get(0)).toBe(sourceTexture);
  });
});
