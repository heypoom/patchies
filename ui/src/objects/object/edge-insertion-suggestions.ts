import type { Edge, Node } from '@xyflow/svelte';
import { planEdgeInsertion } from '$lib/canvas/edge-insertion';
import {
  applyEdgeInsertionPipePreset,
  prepareNodeForEdgeInsertion
} from '$lib/canvas/edge-insertion-adapters';
import { objectSchemas } from '$lib/objects/schemas';
import { ObjectShorthandRegistry } from '$lib/registry/ObjectShorthandRegistry';
import type {
  ObjectPresetSearchIndex,
  ObjectPresetSearchItem
} from '$lib/search/object-preset-search';

/**
 * Checks node suggestions using the same node preparation and wiring rules as confirmation.
 **/
export function canInsertSuggestionIntoEdge({
  item,
  index,
  edge,
  targetNode
}: {
  item: ObjectPresetSearchItem;
  index: ObjectPresetSearchIndex;
  edge: Edge;
  targetNode: Node | undefined;
}): boolean {
  const preset = index.getPresetByName(item.name)?.preset;
  const shorthand = preset ? null : ObjectShorthandRegistry.getInstance().tryTransform(item.name);

  const data = preset?.data ??
    shorthand?.data ?? {
      name: item.name,
      expr: item.name,
      params: []
    };

  const node: Node = {
    id: 'insertion-candidate',
    position: { x: 0, y: 0 },
    type: preset?.type ?? shorthand?.nodeType ?? 'object',
    data: data as Record<string, unknown>
  };

  const preparedNode = prepareNodeForEdgeInsertion(
    applyEdgeInsertionPipePreset(node, item.name),
    edge
  );

  return (
    planEdgeInsertion(edge, preparedNode, targetNode, objectSchemas, (candidate) =>
      candidate.type === 'object' ? (candidate.data.name as string) : candidate.type
    ) !== null
  );
}
