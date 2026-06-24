import { describe, expect, it } from 'vitest';
import type { RenderGraph, RenderNode } from '$lib/rendering/types';
import { createRenderNodeCookPolicy } from './renderNode';

const baseGraph: RenderGraph = {
  nodes: [],
  edges: [],
  sortedNodes: [],
  outputNodeId: null,
  outputOutletIndex: 0,
  backEdges: new Set(),
  feedbackNodes: new Set()
};

function renderNode(type: RenderNode['type'], data: RenderNode['data'] = {}): RenderNode {
  return {
    id: `${type}-1`,
    type,
    data,
    inputs: [],
    outputs: [],
    inletMap: new Map(),
    backEdgeInlets: new Set()
  } as RenderNode;
}

describe('createRenderNodeCookPolicy', () => {
  it('lets video channel passthrough nodes cook on demand', () => {
    expect(
      createRenderNodeCookPolicy(renderNode('send.vdo', { channel: 'main' }), baseGraph)
    ).toEqual({ mode: 'on-demand' });
    expect(
      createRenderNodeCookPolicy(renderNode('recv.vdo', { channel: 'main' }), baseGraph)
    ).toEqual({ mode: 'on-demand' });
  });

  it('lets the background output node cook on demand', () => {
    expect(createRenderNodeCookPolicy(renderNode('bg.out'), baseGraph)).toEqual({
      mode: 'on-demand'
    });
  });

  it('lets projection map nodes cook on demand', () => {
    expect(createRenderNodeCookPolicy(renderNode('projmap', { surfaces: [] }), baseGraph)).toEqual({
      mode: 'on-demand'
    });
  });
});
