import type { Edge, Node } from '@xyflow/svelte';

const OUTPUT_PERSISTENT_DOM_TYPES = new Set([
  'p5',
  'canvas.dom',
  'pixi.dom',
  'three.dom',
  'textmode.dom'
]);

/**
 * Returns DOM renderer IDs that must keep running while offscreen because they
 * provide frames to an active global output.
 */
export function getViewportPersistentDomNodeIds(
  nodes: Node[],
  edges: Edge[],
  isGlobalOutputEnabled: boolean,
  overrideOutputNodeId: string | null = null
): Set<string> {
  if (!isGlobalOutputEnabled) return new Set();

  const connectedVideoSourceIds = new Set<string>();

  for (const edge of edges) {
    if (edge.sourceHandle?.startsWith('video-out') === true) {
      connectedVideoSourceIds.add(edge.source);
    }
  }

  const persistentNodeIds = new Set<string>();

  for (const node of nodes) {
    if (!node.type || !OUTPUT_PERSISTENT_DOM_TYPES.has(node.type)) continue;
    if (node.id !== overrideOutputNodeId && !connectedVideoSourceIds.has(node.id)) continue;

    persistentNodeIds.add(node.id);
  }

  return persistentNodeIds;
}
