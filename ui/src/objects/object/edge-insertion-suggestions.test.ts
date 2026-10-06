import { describe, expect, test, vi } from 'vitest';
import type { Edge, Node } from '@xyflow/svelte';
import { PRESETS as BUILTIN_PRESETS } from '$lib/presets/presets';
import { buildObjectPresetSearchIndex } from '$lib/search/object-preset-search';
import { canInsertSuggestionIntoEdge } from './edge-insertion-suggestions';

// Avoid mounting the complete editor component registry in these schema-based tests.
vi.mock('$lib/registry/ObjectShorthandRegistry', () => ({
  ObjectShorthandRegistry: {
    getInstance: () => ({
      tryTransform: (name: string) => (name === 'glsl' ? { nodeType: 'glsl', data: {} } : null)
    })
  }
}));

const PRESETS = [
  {
    path: ['builtin', 'js>'],
    libraryId: 'builtin',
    libraryName: 'Built-in',
    preset: { ...BUILTIN_PRESETS['js>']!, name: 'js>' }
  },
  {
    path: ['user', 'video processor'],
    libraryId: 'user',
    libraryName: 'User',
    preset: {
      name: 'video processor',
      type: 'glsl',
      description: '',
      data: { code: 'uniform sampler2D image;' }
    }
  }
];

const index = buildObjectPresetSearchIndex({
  presets: PRESETS,
  objectNames: ['js', 'glsl', 'osc~', 'gain~', 'out~', 'map', 'button'],
  shorthands: [],
  enabledObjectNames: new Set(['js', 'glsl', 'osc~', 'gain~', 'out~', 'map', 'button']),
  enabledPresetNames: new Set(['js>']),
  patchObjectTypeNames: new Set(),
  aiFeaturesVisible: true
});

const targetNode: Node = { id: 'right', type: 'glsl', position: { x: 0, y: 0 }, data: {} };

describe('edge insertion suggestions', () => {
  test.each([
    ['audio', 'gain~', true],
    ['audio', 'osc~', true],
    ['audio', 'out~', false],
    ['audio', 'button', false],
    ['video', 'glsl', true],
    ['video', 'video processor', true],
    ['video', 'gain~', false],
    ['message', 'js', true],
    ['message', 'js>', true],
    ['audio', 'js', false],
    ['video', 'js>', false],
    ['message', 'map', true],
    ['message', 'button', true]
  ])('%s edge permits %s: %s', (type, name, expected) => {
    const edge: Edge = {
      id: 'edge',
      source: 'left',
      sourceHandle: `${type}-out`,
      target: 'right',
      targetHandle: `${type}-in`
    };

    const item = index.allSearchableItems.find((candidate) => candidate.name === name)!;

    expect(canInsertSuggestionIntoEdge({ item, index, edge, targetNode })).toBe(expected);
  });
});
