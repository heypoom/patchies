import { describe, expect, test, vi } from 'vitest';
import type { Edge } from '@xyflow/svelte';
import { createEdgeInsertionPreview, showEdgeInsertionPreview } from '$lib/canvas/edge-insertion';
import { PRESETS } from '$lib/presets/presets';
import { buildObjectPresetSearchIndex } from '$lib/search/object-preset-search';
import { useObjectSuggestions } from './useObjectSuggestions.svelte';

const flow = vi.hoisted(() => ({ edges: [] as Edge[] }));

vi.mock('$lib/presets/use-enabled-preset-packs.svelte', () => ({
  useEnabledPresetPacks: vi.fn()
}));

vi.mock('@xyflow/svelte', () => ({
  useNodes: () => ({
    current: [{ id: 'right', type: 'object', position: { x: 0, y: 0 }, data: { name: 'out~' } }]
  }),
  useEdges: () => ({
    get current() {
      return flow.edges;
    },
    update(updateFn: (edges: Edge[]) => Edge[]) {
      flow.edges = updateFn(flow.edges);
    }
  })
}));

vi.mock('$lib/registry/ObjectShorthandRegistry', () => ({
  ObjectShorthandRegistry: { getInstance: () => ({ tryTransform: () => null }) }
}));

const index = buildObjectPresetSearchIndex({
  presets: [],
  objectNames: ['gain~', 'out~', 'map'],
  shorthands: [],
  enabledObjectNames: new Set(['gain~', 'out~', 'map']),
  enabledPresetNames: new Set(),
  patchObjectTypeNames: new Set(),
  aiFeaturesVisible: true
});

const createSuggestions = (expr: string) =>
  useObjectSuggestions({
    getNodeId: () => 'quick-add',
    getExpr: () => expr,
    getIsEditing: () => true,
    getSearchIndex: () => index,
    searchDisabledObject: () => null
  });

describe('ObjectNode suggestions', () => {
  test('retires the preview synchronously before the selected object replaces its handles', () => {
    const edge: Edge = {
      id: 'live',
      source: 'left',
      sourceHandle: 'audio-out-0',
      target: 'right',
      targetHandle: 'audio-in-0'
    };

    flow.edges = showEdgeInsertionPreview(
      [edge],
      edge,
      createEdgeInsertionPreview(edge, 'quick-add', ['preview-left', 'preview-right'])
    );

    const suggestions = createSuggestions('gain~');
    suggestions.prepareConfirmation();

    expect(
      flow.edges.map((candidate) => [candidate.source, candidate.target, candidate.hidden])
    ).toEqual([
      ['left', 'right', true],
      ['left', 'right', true],
      ['left', 'right', true]
    ]);
  });

  test('filters autocomplete and lets explicitly incompatible names override it', () => {
    const edge: Edge = {
      id: 'live',
      source: 'left',
      sourceHandle: 'audio-out',
      target: 'right',
      targetHandle: 'audio-in-0'
    };

    flow.edges = showEdgeInsertionPreview(
      [edge],
      edge,
      createEdgeInsertionPreview(edge, 'quick-add', ['preview-left', 'preview-right'])
    );

    expect(createSuggestions('').filteredSuggestions.map((item) => item.name)).toEqual(['gain~']);
    expect(createSuggestions('out~').shouldConfirmExplicitExpression()).toBe(true);
    expect(createSuggestions('gain~').shouldConfirmExplicitExpression()).toBe(false);
  });

  test.each(['js', 'js>'])('resolves %s to the collapsed pipe preset before mounting', (expr) => {
    const edge: Edge = {
      id: 'live',
      source: 'left',
      sourceHandle: 'message-out',
      target: 'right',
      targetHandle: 'message-in'
    };

    flow.edges = showEdgeInsertionPreview(
      [edge],
      edge,
      createEdgeInsertionPreview(edge, 'quick-add', ['preview-left', 'preview-right'])
    );

    const expression = createSuggestions(expr).prepareConfirmation();
    expect(expression).toBe('js>');
    expect(PRESETS[expression]?.data).toMatchObject({ showConsole: false });
  });

  test('preserves custom preset names and object arguments during edge confirmation', () => {
    const edge: Edge = {
      id: 'live',
      source: 'left',
      sourceHandle: 'message-out',
      target: 'right',
      targetHandle: 'message-in'
    };

    for (const expression of ['My Processor', 'map 0 1']) {
      flow.edges = showEdgeInsertionPreview(
        [edge],
        edge,
        createEdgeInsertionPreview(edge, 'quick-add', ['preview-left', 'preview-right'])
      );

      expect(createSuggestions(expression).prepareConfirmation()).toBe(expression);
    }
  });

  test('keeps ordinary quick insert suggestions unrestricted', () => {
    flow.edges = [];

    expect(createSuggestions('').filteredSuggestions.map((item) => item.name)).toEqual([
      'map',
      'out~',
      'gain~'
    ]);

    expect(createSuggestions('out~').shouldConfirmExplicitExpression()).toBe(false);
    expect(createSuggestions('js').prepareConfirmation()).toBe('js');
  });
});
