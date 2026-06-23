import type { Migration } from '../types';

type TapMode = 'wave' | 'xy';

/**
 * Migration 014: Convert tap~ text objects to dedicated UI nodes.
 *
 * Before: tap~ was a generic `object` node with expression params.
 * After: tap~ has a compact Svelte UI and stores its settings in node data.
 */
export const migration014: Migration = {
  version: 14,
  name: 'tap-to-ui-node',

  migrate(patch) {
    if (!patch.nodes) return patch;

    const migratedNodeIds = new Set<string>();

    const migratedNodes = patch.nodes.map((node) => {
      if (node.type !== 'object') return node;

      const data = node.data as { expr?: string; name?: string; params?: unknown[] } | undefined;
      const exprName = typeof data?.expr === 'string' ? data.expr.trim().split(/\s+/)[0] : '';
      if (data?.name !== 'tap~' && exprName !== 'tap~') return node;

      migratedNodeIds.add(node.id);

      return {
        ...node,
        type: 'tap~',
        data: getTapSettings(data)
      };
    });

    const migratedEdges = patch.edges?.map((edge) => {
      let nextEdge = edge;

      if (migratedNodeIds.has(edge.target)) {
        nextEdge = {
          ...nextEdge,
          targetHandle: rewriteTapInletHandle(edge.targetHandle)
        };
      }

      if (migratedNodeIds.has(edge.source)) {
        nextEdge = {
          ...nextEdge,
          sourceHandle: rewriteTapOutletHandle(edge.sourceHandle)
        };
      }

      return nextEdge;
    });

    return { ...patch, nodes: migratedNodes, edges: migratedEdges };
  }
};

function getTapSettings(data: { expr?: string; params?: unknown[] } | undefined) {
  const params = Array.isArray(data?.params) ? data.params : [];
  const exprParts = typeof data?.expr === 'string' ? data.expr.trim().split(/\s+/).slice(1) : [];
  const hasSignalParamPlaceholders = params[0] === null && params[1] === null;

  const compactParams = hasSignalParamPlaceholders ? params.slice(2) : params;
  const compactExprParts = exprParts;

  return {
    bufferSize: parseBufferSize(compactParams[0] ?? compactExprParts[0]),
    mode: parseMode(compactParams[1] ?? compactExprParts[1]),
    fps: parseFps(compactParams[2] ?? compactExprParts[2]),
    zeroCrossing: parseZeroCrossing(compactParams[3] ?? compactExprParts[3])
  };
}

function parseBufferSize(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 64 || parsed > 2048) return 512;

  return Math.round(parsed);
}

function parseMode(value: unknown): TapMode {
  return value === 'xy' ? 'xy' : 'wave';
}

function parseFps(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 120) return 0;

  return parsed;
}

function parseZeroCrossing(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'false' || value === 'off' || value === 'none') return false;

  return true;
}

function rewriteTapInletHandle(handle: string | null | undefined): string | null | undefined {
  if (handle === 'audio-in' || handle === 'signal-in' || handle === 'signal-in-0') {
    return 'audio-in-0';
  }

  if (handle === 'signal-in-1') {
    return 'audio-in-1';
  }

  return handle;
}

function rewriteTapOutletHandle(handle: string | null | undefined): string | null | undefined {
  if (handle === 'message-out') return 'message-out-0';

  return handle;
}
