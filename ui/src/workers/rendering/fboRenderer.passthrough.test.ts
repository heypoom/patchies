import { describe, expect, it, vi } from 'vitest';
import type { RenderGraph, RenderNode } from '$lib/rendering/types';
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

  it('uses the previous frame when wireless routing closes a feedback loop', async () => {
    vi.stubGlobal('self', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval
    });

    const { FBORenderer } = await import('./fboRenderer');
    const currentTexture = { width: 1280, height: 720 };
    const previousTexture = { width: 1280, height: 720 };
    const renderer = Object.create(FBORenderer.prototype) as FBORenderer;

    const feedback = {
      id: 'feedback',
      type: 'glsl',
      inputs: ['source', 'receive'],
      outputs: ['send'],
      inletMap: new Map([
        [0, { sourceNodeId: 'source', outletIndex: 0 }],
        [1, { sourceNodeId: 'receive', outletIndex: 0 }]
      ]),
      data: {},
      backEdgeInlets: new Set<number>()
    } as RenderNode;
    const send = {
      id: 'send',
      type: 'send.vdo',
      inputs: ['feedback'],
      outputs: [],
      inletMap: new Map([[0, { sourceNodeId: 'feedback', outletIndex: 0 }]]),
      data: { channel: 'loop' },
      backEdgeInlets: new Set<number>()
    } as RenderNode;
    const receive = {
      id: 'receive',
      type: 'recv.vdo',
      inputs: [],
      outputs: ['feedback'],
      inletMap: new Map<number, { sourceNodeId: string; outletIndex: number }>(),
      data: { channel: 'loop' },
      backEdgeInlets: new Set<number>()
    } as RenderNode;

    const baseGraph = {
      nodes: [feedback, send, receive],
      edges: [],
      sortedNodes: [],
      outputNodeId: null,
      outputOutletIndex: 0,
      backEdges: new Set<string>(),
      feedbackNodes: new Set<string>()
    } as RenderGraph;

    const mergedGraph = (
      renderer as never as {
        mergeVirtualEdges: (graph: RenderGraph, edges: RenderGraph['edges']) => RenderGraph;
      }
    ).mergeVirtualEdges(baseGraph, [
      {
        id: 'virtual-video-loop-send-receive',
        source: 'send',
        target: 'receive',
        sourceHandle: 'video-out',
        targetHandle: 'video-in-0'
      }
    ]);

    const state = renderer as unknown as {
      fboNodes: Map<string, unknown>;
      renderGraph: RenderGraph;
      videoTextures: { getDestinationTexture: () => undefined };
    };
    state.fboNodes = new Map([
      [
        'feedback',
        {
          colorAttachments: [currentTexture],
          prevTextures: [previousTexture],
          texture: currentTexture
        }
      ]
    ]);
    state.renderGraph = mergedGraph;
    state.videoTextures = { getDestinationTexture: () => undefined };

    expect(mergedGraph.feedbackNodes).toEqual(new Set(['feedback']));
    expect(send.backEdgeInlets).toEqual(new Set([0]));

    const textureMap = (
      renderer as never as { getInputTextureMap: (node: RenderNode) => Map<number, unknown> }
    ).getInputTextureMap(feedback);

    expect(textureMap.get(1)).toBe(previousTexture);
  });
});
