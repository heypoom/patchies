import { describe, expect, it } from 'vitest';
import { shouldSkipCookForViewport } from './renderEligibility';

const hiddenNode = { id: 'glsl-1', outputs: [] };

describe('shouldSkipCookForViewport', () => {
  it('skips nodes that are hidden, disconnected, and not the effective output', () => {
    expect(
      shouldSkipCookForViewport({
        node: hiddenNode,
        visibleNodeIds: new Set(['hydra-1']),
        connectedVideoOutputNodeIds: new Set(),
        effectiveOutputNodeId: null
      })
    ).toBe(true);
  });

  it('does not skip when viewport visibility has not been initialized', () => {
    expect(
      shouldSkipCookForViewport({
        node: hiddenNode,
        visibleNodeIds: null,
        connectedVideoOutputNodeIds: new Set(),
        effectiveOutputNodeId: null
      })
    ).toBe(false);
  });

  it('does not skip visible nodes', () => {
    expect(
      shouldSkipCookForViewport({
        node: hiddenNode,
        visibleNodeIds: new Set(['glsl-1']),
        connectedVideoOutputNodeIds: new Set(),
        effectiveOutputNodeId: null
      })
    ).toBe(false);
  });

  it('does not skip graph-connected video sources', () => {
    expect(
      shouldSkipCookForViewport({
        node: { id: 'glsl-1', outputs: ['hydra-1'] },
        visibleNodeIds: new Set(),
        connectedVideoOutputNodeIds: new Set(),
        effectiveOutputNodeId: null
      })
    ).toBe(false);
  });

  it('does not skip sources connected to non-FBO video consumers', () => {
    expect(
      shouldSkipCookForViewport({
        node: hiddenNode,
        visibleNodeIds: new Set(),
        connectedVideoOutputNodeIds: new Set(['glsl-1']),
        effectiveOutputNodeId: null
      })
    ).toBe(false);
  });

  it('does not skip the effective background output node', () => {
    expect(
      shouldSkipCookForViewport({
        node: hiddenNode,
        visibleNodeIds: new Set(),
        connectedVideoOutputNodeIds: new Set(),
        effectiveOutputNodeId: 'glsl-1'
      })
    ).toBe(false);
  });
});
