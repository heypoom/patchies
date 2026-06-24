import { describe, expect, it } from 'vitest';
import type { RenderGraph, RenderNode } from '$lib/rendering/types';
import { createRenderNodeCookPolicy } from './policies';
import { COOK_TEST_UTILS } from './test-utils';

const { ALWAYS, ON_DEMAND, TIME_DEPENDENT, FFT_DEPENDENT, FEEDBACK_DEPENDENT } = COOK_TEST_UTILS;

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

    expect(
      createRenderNodeCookPolicy(
        renderNode('swgl', { code: 'function render() { shader({ amp: fft().a[0] }); }' }),
        baseGraph
      )
    ).toEqual(FFT_DEPENDENT);
  });

  it('uses Canvas dependency policies', () => {
    expect(
      createRenderNodeCookPolicy(
        renderNode('canvas', { code: 'ctx.fillRect(0, 0, width, height);' }),
        baseGraph
      )
    ).toEqual(ON_DEMAND);

    expect(
      createRenderNodeCookPolicy(
        renderNode('canvas', { code: 'ctx.fillText(clock.time, 0, 20);' }),
        baseGraph
      )
    ).toEqual(TIME_DEPENDENT);
  });

  it('uses Regl dependency policies', () => {
    expect(
      createRenderNodeCookPolicy(
        renderNode('regl', { code: 'function render(time) { draw(); }' }),
        baseGraph
      )
    ).toEqual(ON_DEMAND);

    expect(
      createRenderNodeCookPolicy(
        renderNode('regl', { code: 'function render(time) { draw({ time }); }' }),
        baseGraph
      )
    ).toEqual(TIME_DEPENDENT);
  });

  it('uses the conservative fallback policy for Three', () => {
    expect(
      createRenderNodeCookPolicy(
        renderNode('three', { code: 'function draw(time) { renderer.render(scene, camera); }' }),
        baseGraph
      )
    ).toEqual(ALWAYS);

    expect(
      createRenderNodeCookPolicy(
        renderNode('three', { code: 'const controls = new OrbitControls(camera, renderer);' }),
        baseGraph
      )
    ).toEqual(ALWAYS);
  });

  it('uses Textmode dependency policies', () => {
    expect(
      createRenderNodeCookPolicy(
        renderNode('textmode', { code: 't.draw(() => t.text("hi", 0, 0));' }),
        baseGraph
      )
    ).toEqual(ON_DEMAND);

    expect(
      createRenderNodeCookPolicy(
        renderNode('textmode', { code: 't.draw(() => t.text(fft().a[0], 0, 0));' }),
        baseGraph
      )
    ).toEqual(FFT_DEPENDENT);
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

  it('does not add feedback dependency to always-cooked policies', () => {
    const node = renderNode('hydra', { code: 'osc(() => Math.random()).out()' });

    expect(
      createRenderNodeCookPolicy(node, {
        ...baseGraph,
        feedbackNodes: new Set([node.id])
      })
    ).toEqual(ALWAYS);
  });
});
