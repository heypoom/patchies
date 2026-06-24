import { describe, expect, it } from 'vitest';
import { getViewportCookRequiredNodeIds, shouldSkipCookForViewport } from './renderEligibility';
import type { RenderNode } from '$lib/rendering/types';

const renderNode = (id: string, inputs: string[] = [], outputs: string[] = []): RenderNode =>
  ({
    id,
    type: 'glsl',
    inputs,
    outputs,
    data: { code: '', glUniformDefs: [] },
    inletMap: new Map(),
    backEdgeInlets: new Set()
  }) as RenderNode;

const hiddenNode = renderNode('glsl-1');

describe('shouldSkipCookForViewport', () => {
  it('skips nodes that are hidden, disconnected, and not the effective output', () => {
    const requiredNodeIds = getViewportCookRequiredNodeIds({
      nodes: [hiddenNode],
      visibleNodeIds: new Set(['hydra-1']),
      connectedVideoOutputNodeIds: new Set(),
      effectiveOutputNodeId: null
    });

    expect(
      shouldSkipCookForViewport({
        node: hiddenNode,
        requiredNodeIds
      })
    ).toBe(true);
  });

  it('does not skip when viewport visibility has not been initialized', () => {
    const requiredNodeIds = getViewportCookRequiredNodeIds({
      nodes: [hiddenNode],
      visibleNodeIds: null,
      connectedVideoOutputNodeIds: new Set(),
      effectiveOutputNodeId: null
    });

    expect(
      shouldSkipCookForViewport({
        node: hiddenNode,
        requiredNodeIds
      })
    ).toBe(false);
  });

  it('does not skip visible nodes', () => {
    const requiredNodeIds = getViewportCookRequiredNodeIds({
      nodes: [hiddenNode],
      visibleNodeIds: new Set(['glsl-1']),
      connectedVideoOutputNodeIds: new Set(),
      effectiveOutputNodeId: null
    });

    expect(
      shouldSkipCookForViewport({
        node: hiddenNode,
        requiredNodeIds
      })
    ).toBe(false);
  });

  it('skips hidden upstream nodes when their only downstream FBO consumer is hidden', () => {
    const hydra = renderNode('hydra-1', [], ['glsl-1']);
    const glsl = renderNode('glsl-1', ['hydra-1']);

    const requiredNodeIds = getViewportCookRequiredNodeIds({
      nodes: [hydra, glsl],
      visibleNodeIds: new Set(),
      connectedVideoOutputNodeIds: new Set(),
      effectiveOutputNodeId: null
    });

    expect(
      shouldSkipCookForViewport({
        node: hydra,
        requiredNodeIds
      })
    ).toBe(true);
  });

  it('does not skip hidden upstream nodes when a downstream FBO consumer is visible', () => {
    const hydra = renderNode('hydra-1', [], ['glsl-1']);
    const glsl = renderNode('glsl-1', ['hydra-1']);

    const requiredNodeIds = getViewportCookRequiredNodeIds({
      nodes: [hydra, glsl],
      visibleNodeIds: new Set(['glsl-1']),
      connectedVideoOutputNodeIds: new Set(),
      effectiveOutputNodeId: null
    });

    expect(
      shouldSkipCookForViewport({
        node: hydra,
        requiredNodeIds
      })
    ).toBe(false);
  });

  it('does not skip transitive hidden upstream nodes needed by a visible FBO consumer', () => {
    const hydra = renderNode('hydra-1', [], ['glsl-1']);
    const glsl = renderNode('glsl-1', ['hydra-1'], ['shaderpark-1']);
    const shaderpark = renderNode('shaderpark-1', ['glsl-1']);

    const requiredNodeIds = getViewportCookRequiredNodeIds({
      nodes: [hydra, glsl, shaderpark],
      visibleNodeIds: new Set(['shaderpark-1']),
      connectedVideoOutputNodeIds: new Set(),
      effectiveOutputNodeId: null
    });

    expect(
      shouldSkipCookForViewport({
        node: hydra,
        requiredNodeIds
      })
    ).toBe(false);
  });

  it('does not skip sources connected to external video consumers', () => {
    const requiredNodeIds = getViewportCookRequiredNodeIds({
      nodes: [hiddenNode],
      visibleNodeIds: new Set(),
      connectedVideoOutputNodeIds: new Set(['glsl-1']),
      effectiveOutputNodeId: null
    });

    expect(shouldSkipCookForViewport({ node: hiddenNode, requiredNodeIds })).toBe(false);
  });

  it('does not skip the effective background output node or its inputs', () => {
    const hydra = renderNode('hydra-1', [], ['glsl-1']);
    const glsl = renderNode('glsl-1', ['hydra-1']);

    const requiredNodeIds = getViewportCookRequiredNodeIds({
      nodes: [hydra, glsl],
      visibleNodeIds: new Set(),
      connectedVideoOutputNodeIds: new Set(),
      effectiveOutputNodeId: 'glsl-1'
    });

    expect(shouldSkipCookForViewport({ node: glsl, requiredNodeIds })).toBe(false);
    expect(shouldSkipCookForViewport({ node: hydra, requiredNodeIds })).toBe(false);
  });
});
