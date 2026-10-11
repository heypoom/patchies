import { expect, test } from 'vitest';
import type { Edge, Node } from '@xyflow/svelte';
import { HistoryManager } from '$lib/history/HistoryManager';
import { CanvasContext } from '$lib/services/CanvasContext';
import { recordCanvasDeletion } from './record-canvas-deletion';

function createCanvas() {
  let nodes: Node[] = ['left', 'right', 'other'].map((id) => ({
    id,
    position: { x: 0, y: 0 },
    data: {}
  }));

  let edges: Edge[] = [
    { id: 'clicked', source: 'left', target: 'right' },
    { id: 'selected', source: 'right', target: 'other', selected: true }
  ];

  return new CanvasContext(
    { get: () => nodes, set: (value) => (nodes = value) },
    { get: () => edges, set: (value) => (edges = value) },
    new HistoryManager()
  );
}

test('deleting one edge preserves other selected edges through undo and redo', () => {
  const context = createCanvas();
  const originalEdges = [...context.edges];

  expect(recordCanvasDeletion(context, [], [context.edges[0]])).toBe(true);
  context.edges = context.edges.filter((edge) => edge.id !== 'clicked');

  expect(context.edges.map((edge) => edge.id)).toEqual(['selected']);

  context.historyManager.undo();
  expect(context.edges).toEqual(expect.arrayContaining(originalEdges));
  expect(context.edges).toHaveLength(2);

  context.historyManager.redo();
  expect(context.edges.map((edge) => edge.id)).toEqual(['selected']);
});

test('undoing mixed node and edge deletion restores each edge once', () => {
  const context = createCanvas();

  recordCanvasDeletion(context, [context.nodes[0]], context.edges);
  context.nodes = context.nodes.filter((node) => node.id !== 'left');
  context.edges = [];

  context.historyManager.undo();

  expect(context.nodes).toHaveLength(3);
  expect(context.edges.map((edge) => edge.id).sort()).toEqual(['clicked', 'selected']);

  context.historyManager.redo();

  expect(context.nodes.map((node) => node.id)).toEqual(['right', 'other']);
  expect(context.edges).toEqual([]);
});
