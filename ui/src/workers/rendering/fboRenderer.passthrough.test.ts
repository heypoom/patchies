import { describe, expect, it, vi } from 'vitest';
import type { RenderGraph, RenderNode } from '$lib/rendering/types';
import type { FBORenderer } from './fboRenderer';
import { CookStateManager } from './CookStateManager';

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

    const sourceTexture = { width: 1080, height: 1920 };
    const sourceFramebuffer = {};
    const renderer = Object.create(FBORenderer.prototype) as FBORenderer;

    const state = renderer as unknown as {
      fboNodes: Map<string, unknown>;
      renderGraph: { nodes: RenderNode[] };
      videoTextures: {
        getDestinationTexture: (nodeId: string) => typeof sourceTexture | undefined;
        getDestinationFBO: (nodeId: string) => typeof sourceFramebuffer | undefined;
      };
    };

    state.fboNodes = new Map();

    state.videoTextures = {
      getDestinationTexture: (nodeId) => (nodeId === 'webcam' ? sourceTexture : undefined),
      getDestinationFBO: (nodeId) => (nodeId === 'webcam' ? sourceFramebuffer : undefined)
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

    const source = (
      renderer as never as {
        resolveVideoSource: (
          nodeId: string
        ) => { texture: unknown; width: number; height: number } | null;
      }
    ).resolveVideoSource('receive');

    const textureMap = (
      renderer as never as { getInputTextureMap: (node: RenderNode) => Map<number, unknown> }
    ).getInputTextureMap(consumer);

    expect(source).toEqual({ texture: sourceTexture, width: 1080, height: 1920 });
    expect(textureMap.get(0)).toBe(sourceTexture);

    const captureSource = (
      renderer as never as {
        resolveCaptureSource: (
          nodeId: string
        ) => { framebuffer: unknown; width: number; height: number } | null;
      }
    ).resolveCaptureSource('receive');

    expect(captureSource).toMatchObject({
      framebuffer: sourceFramebuffer,
      width: 1080,
      height: 1920
    });
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

    const virtualEdge = {
      id: 'virtual-video-loop-send-receive',
      source: 'send',
      target: 'receive',
      sourceHandle: 'video-out',
      targetHandle: 'video-in-0'
    };

    const baseGraph = {
      nodes: [send, feedback, receive],
      edges: [virtualEdge],
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
    ).mergeVirtualEdges(baseGraph, [virtualEdge]);

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
    expect(mergedGraph.edges).toHaveLength(1);

    const textureMap = (
      renderer as never as { getInputTextureMap: (node: RenderNode) => Map<number, unknown> }
    ).getInputTextureMap(feedback);

    expect(textureMap.get(1)).toBe(previousTexture);
  });

  it('releases obsolete feedback resources', async () => {
    const { FBORenderer } = await import('./fboRenderer');
    const renderer = Object.create(FBORenderer.prototype) as FBORenderer;
    const framebuffer = { destroy: vi.fn() };
    const texture = { destroy: vi.fn() };
    const fboNode = { prevFramebuffers: [framebuffer], prevTextures: [texture] };

    (
      renderer as never as {
        destroyFeedbackResources: (node: typeof fboNode) => void;
      }
    ).destroyFeedbackResources(fboNode);

    expect(framebuffer.destroy).toHaveBeenCalledOnce();
    expect(texture.destroy).toHaveBeenCalledOnce();
    expect(fboNode.prevFramebuffers).toBeUndefined();
    expect(fboNode.prevTextures).toBeUndefined();
  });

  it('propagates live-source invalidation past FBO-less routing nodes', async () => {
    const { FBORenderer } = await import('./fboRenderer');

    const renderer = Object.create(FBORenderer.prototype) as FBORenderer;
    const cookState = new CookStateManager();

    const source = {
      id: 'source',
      type: 'hydra',
      inputs: [],
      outputs: ['send'],
      inletMap: new Map(),
      data: { code: 'osc(10).out()' },
      backEdgeInlets: new Set<number>()
    } as RenderNode;

    const send = {
      id: 'send',
      type: 'send.vdo',
      inputs: ['source'],
      outputs: ['receive'],
      inletMap: new Map([[0, { sourceNodeId: 'source', outletIndex: 0 }]]),
      data: { channel: 'live' },
      backEdgeInlets: new Set<number>()
    } as RenderNode;

    const receive = {
      id: 'receive',
      type: 'recv.vdo',
      inputs: ['send'],
      outputs: ['consumer'],
      inletMap: new Map([[0, { sourceNodeId: 'send', outletIndex: 0 }]]),
      data: { channel: 'live' },
      backEdgeInlets: new Set<number>()
    } as RenderNode;

    const consumer = {
      id: 'consumer',
      type: 'glsl',
      inputs: ['receive'],
      outputs: [],
      inletMap: new Map([[0, { sourceNodeId: 'receive', outletIndex: 0 }]]),
      data: {
        code: 'void mainImage(out vec4 c, in vec2 p) { c = vec4(1.0); }',
        glUniformDefs: []
      },
      backEdgeInlets: new Set<number>()
    } as RenderNode;

    const cookable = renderer as unknown as {
      cookState: CookStateManager;
      rebuildCookingPolicies: (graph: RenderGraph) => void;
    };

    cookable.cookState = cookState;

    const graph = {
      nodes: [source, send, receive, consumer],
      edges: [],
      sortedNodes: ['source', 'send', 'receive', 'consumer'],
      outputNodeId: 'consumer',
      outputOutletIndex: 0,
      backEdges: new Set<string>(),
      feedbackNodes: new Set<string>()
    } as RenderGraph;

    cookable.rebuildCookingPolicies(graph);

    cookState.beginFrame({ transportTime: 0, prevTransportTime: 0, isTransportPlaying: true });
    cookState.markCooked('source', ['first-frame'], 0);
    cookState.markCooked('consumer', ['first-frame'], 0);

    cookState.beginFrame({ transportTime: 1, prevTransportTime: 0, isTransportPlaying: true });
    cookState.markCooked('source', ['time'], 0);

    expect(cookState.shouldCook('consumer')).toMatchObject({
      shouldCook: true,
      reasons: expect.arrayContaining(['input'])
    });
  });
});
