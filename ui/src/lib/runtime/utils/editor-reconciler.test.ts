import { describe, expect, it, vi } from 'vitest';
import { createEdgeInsertionPreview, showEdgeInsertionPreview } from '$lib/canvas/edge-insertion';

import {
  setRuntimeGraphFromEditorGraph,
  setRuntimeConnectionsFromEditorEdges
} from './editor-reconciler';

const createFakeEditorRuntime = () => ({
  setGraph: vi.fn(async () => {}),
  setObjects: vi.fn(async () => {}),
  setConnections: vi.fn(async () => {})
});

describe('Quick Insert runtime routing', () => {
  it.each(['audio', 'video', 'message'])(
    'preserves the %s route while Quick Insert remains unconfirmed',
    async (type) => {
      const runtime = createFakeEditorRuntime();

      const edge = {
        id: 'live-route',
        source: 'left',
        sourceHandle: `${type}-out`,
        target: 'right',
        targetHandle: `${type}-in`
      };

      const edges = showEdgeInsertionPreview(
        [edge],
        edge,
        createEdgeInsertionPreview(edge, 'object-1', ['preview-left', 'preview-right'])
      );

      const expectedConnection = {
        id: 'live-route',
        source: 'left',
        outlet: `${type}-out`,
        target: 'right',
        inlet: `${type}-in`
      };

      await setRuntimeGraphFromEditorGraph(
        runtime,
        [
          {
            id: 'object-1',
            type: 'object',
            position: { x: 0, y: 0 },
            data: { name: '', expr: '', params: [] }
          }
        ],
        edges
      );

      expect(runtime.setGraph).toHaveBeenCalledWith({
        objects: [],
        connections: [expectedConnection]
      });

      await setRuntimeConnectionsFromEditorEdges(runtime, edges);

      expect(runtime.setConnections).toHaveBeenCalledWith([expectedConnection]);
    }
  );
});
