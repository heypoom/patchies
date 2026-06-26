import { describe, expect, test } from 'vitest';
import type { Edge, Node } from '@xyflow/svelte';

import { CanvasContext } from './CanvasContext';

function createContext(initialNodes: Node[] = []): CanvasContext {
  let nodes = initialNodes;
  let edges: Edge[] = [];

  return new CanvasContext(
    {
      get: () => nodes,
      set: (next) => {
        nodes = next;
      }
    },
    {
      get: () => edges,
      set: (next) => {
        edges = next;
      }
    }
  );
}

describe('CanvasContext', () => {
  test('sets node id counter after the highest numeric suffix, not the last node', () => {
    const ctx = createContext([
      { id: 'group-4', type: 'group', position: { x: 0, y: 0 }, data: {} },
      { id: 'js-1', type: 'js', position: { x: 0, y: 0 }, data: {} }
    ]);

    ctx.setNodeIdCounterFromNodes(ctx.nodes);

    expect(ctx.nextNodeId('msg')).toBe('msg-5');
  });
});
