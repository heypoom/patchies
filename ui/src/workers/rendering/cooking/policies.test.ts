import { describe, expect, it } from 'vitest';
import type { RenderGraph, RenderNode } from '$lib/rendering/types';
import { createRenderNodeCookPolicy } from './policies';
import { COOK_TEST_UTILS } from './test-utils';

const { ON_DEMAND, TIME_DEPENDENT, FEEDBACK_DEPENDENT } = COOK_TEST_UTILS;

const baseGraph: RenderGraph = {
  nodes: [],
  edges: [],
  sortedNodes: [],
  outputNodeId: null,
  outputOutletIndex: 0,
  backEdges: new Set(),
  feedbackNodes: new Set()
};

const renderNode = (type: RenderNode['type'], data: RenderNode['data'] = {}): RenderNode =>
  ({
    id: `${type}-1`,
    type,
    data,
    inputs: [],
    outputs: [],
    inletMap: new Map(),
    backEdgeInlets: new Set()
  }) as RenderNode;

describe('createRenderNodeCookPolicy', () => {
  it('lets video channel passthrough nodes cook on demand', () => {
    expect(
      createRenderNodeCookPolicy(renderNode('send.vdo', { channel: 'main' }), baseGraph)
    ).toEqual(ON_DEMAND);

    expect(
      createRenderNodeCookPolicy(renderNode('recv.vdo', { channel: 'main' }), baseGraph)
    ).toEqual(ON_DEMAND);
  });

  it('lets the background output node cook on demand', () => {
    expect(createRenderNodeCookPolicy(renderNode('bg.out'), baseGraph)).toEqual(ON_DEMAND);
  });

  it('lets projection map nodes cook on demand', () => {
    expect(createRenderNodeCookPolicy(renderNode('projmap', { surfaces: [] }), baseGraph)).toEqual(
      ON_DEMAND
    );
  });

  it('uses Shader Park dependency policies', () => {
    expect(
      createRenderNodeCookPolicy(renderNode('shaderpark', { code: 'sphere(0.7);' }), baseGraph)
    ).toEqual(ON_DEMAND);

    expect(
      createRenderNodeCookPolicy(
        renderNode('shaderpark', { code: 'sphere(0.5 + sin(time));' }),
        baseGraph
      )
    ).toEqual(TIME_DEPENDENT);
  });

  it('uses SwissGL dependency policies', () => {
    expect(
      createRenderNodeCookPolicy(renderNode('swgl', { code: 'function render() {}' }), baseGraph)
    ).toEqual(ON_DEMAND);

    expect(
      createRenderNodeCookPolicy(
        renderNode('swgl', { code: 'function render({ t }) { shader({ t }); }' }),
        baseGraph
      )
    ).toEqual(TIME_DEPENDENT);
  });

  it('preserves feedback dependency for on-demand passthrough nodes', () => {
    const node = renderNode('send.vdo', { channel: 'main' });

    expect(
      createRenderNodeCookPolicy(node, {
        ...baseGraph,
        feedbackNodes: new Set([node.id])
      })
    ).toEqual(FEEDBACK_DEPENDENT);
  });
});
