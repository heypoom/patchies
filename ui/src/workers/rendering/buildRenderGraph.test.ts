import { describe, expect, it, vi } from 'vitest';

import type { FBONode, RenderGraph, RenderNode } from '$lib/rendering/types';
import { buildRenderGraph } from './buildRenderGraph';

describe('buildRenderGraph shader fallback', () => {
  it('keeps the last working FBO when replacement shader compilation fails', async () => {
    const render = vi.fn();
    const existingFbo = {
      id: 'glsl-1',
      texture: { width: 640, height: 480 },
      colorAttachments: [{ width: 640, height: 480 }],
      framebuffer: {},
      render,
      dataFingerprint: '{"code":"working"}',
      nodeType: 'glsl',
      fboFormat: 'rgba8',
      previewSize: [160, 120]
    } as unknown as FBONode;

    const node = {
      id: 'glsl-1',
      type: 'glsl',
      data: { code: 'broken', glUniformDefs: [] },
      inputs: [],
      outputs: [],
      inletMap: new Map(),
      backEdgeInlets: new Set()
    } as unknown as RenderNode;

    const graph = {
      nodes: [node],
      edges: [],
      sortedNodes: ['glsl-1'],
      outputNodeId: null,
      outputOutletIndex: 0,
      backEdges: new Set(),
      feedbackNodes: new Set()
    } as unknown as RenderGraph;

    const host = {
      connectedVideoOutputNodeIds: new Set(),
      renderGraph: graph,
      fboNodes: new Map([['glsl-1', existingFbo]]),
      cookState: {
        markDirty: vi.fn(),
        removeNode: vi.fn()
      },
      lastCookStatusSignatures: new Map(),
      videoChannelRegistry: {
        unsubscribeAll: vi.fn(),
        getVirtualEdges: () => []
      },
      previewRenderer: {
        removeNode: vi.fn(),
        setPreviewEnabled: vi.fn(),
        hasPreviewState: () => true,
        hasEnabledPreviews: () => true
      },
      cleanupExpensiveTextmodeRenderers: vi.fn(),
      rebuildCookingPolicies: vi.fn(),
      resolveNodeSize: () => [640, 480],
      computeNodeFingerprint: () => '{"code":"broken"}',
      hasReusableRenderer: () => false,
      createRenderer: async () => null,
      destroyFboNode: vi.fn(),
      destroyFeedbackResources: vi.fn(),
      reportCookStatuses: vi.fn(),
      resumeViewportManagedRenderers: vi.fn(),
      shouldProcessPreviews: false,
      outputNodeId: null,
      outputOutletIndex: 0,
      gl: {
        MAX_DRAW_BUFFERS: 1,
        MAX_COLOR_ATTACHMENTS: 2,
        getParameter: () => 4
      },
      regl: {}
    };

    await buildRenderGraph(host as never, graph);

    expect(host.fboNodes.get('glsl-1')).toBe(existingFbo);
    expect(host.fboNodes.get('glsl-1')?.render).toBe(render);
    expect(host.destroyFboNode).not.toHaveBeenCalled();
  });
});
