import { describe, expect, test, vi } from 'vitest';
import type { Edge } from '@xyflow/svelte';
import { createEdgeInsertionPreview, showEdgeInsertionPreview } from '$lib/canvas/edge-insertion';
import { buildObjectPresetSearchIndex } from '$lib/search/object-preset-search';
import { useObjectSuggestions } from './useObjectSuggestions.svelte';

const flow = vi.hoisted(() => ({ edges: [] as Edge[] }));

vi.mock('@xyflow/svelte', () => ({
  useNodes: () => ({
    current: [{ id: 'right', type: 'object', position: { x: 0, y: 0 }, data: { name: 'out~' } }]
  }),
  useEdges: () => ({
    get current() {
      return flow.edges;
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

  test('keeps ordinary quick insert suggestions unrestricted', () => {
    flow.edges = [];

    expect(createSuggestions('').filteredSuggestions.map((item) => item.name)).toEqual([
      'map',
      'out~',
      'gain~'
    ]);

    expect(createSuggestions('out~').shouldConfirmExplicitExpression()).toBe(false);
  });
});
