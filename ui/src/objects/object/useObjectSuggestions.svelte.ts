import { useEdges, useNodes } from '@xyflow/svelte';
import { SvelteSet } from 'svelte/reactivity';
import { getEdgeInsertionObjectName } from '$lib/canvas/edge-insertion-adapters';
import { logger } from '$lib/utils/logger';
import { getQuickInsertEdge, retireEdgeInsertionPreview } from '$lib/canvas/edge-insertion';
import {
  getObjectAutocompleteQuery,
  shouldSuppressObjectAutocomplete
} from '$lib/search/object-autocomplete-query';
import type { ObjectPresetSearchIndex } from '$lib/search/object-preset-search';
import type { DisabledObjectInfo } from '$lib/composables/useDisabledObjectSuggestion.svelte';
import { canInsertSuggestionIntoEdge } from './edge-insertion-suggestions';
import { useEnabledPresetPacks } from '$lib/presets/use-enabled-preset-packs.svelte';

/** Owns autocomplete and explicit confirmation during contextual edge insertion. */
export function useObjectSuggestions({
  getNodeId,
  getExpr,
  getIsEditing,
  getSearchIndex,
  searchDisabledObject
}: {
  getNodeId: () => string;
  getExpr: () => string;
  getIsEditing: () => boolean;
  getSearchIndex: () => ObjectPresetSearchIndex;
  searchDisabledObject: (query: string) => DisabledObjectInfo | null;
}) {
  const edgesHelper = useEdges();
  const nodesHelper = useNodes();

  useEnabledPresetPacks(getIsEditing);

  const insertionEdge = $derived(getQuickInsertEdge(edgesHelper.current, getNodeId()));

  const compatibleSuggestionNames = $derived.by(() => {
    if (!insertionEdge) return null;

    const index = getSearchIndex();
    const targetNode = nodesHelper.current.find((node) => node.id === insertionEdge.target);

    return new SvelteSet(
      index.allSearchableItems
        .filter((item) =>
          canInsertSuggestionIntoEdge({ item, index, edge: insertionEdge, targetNode })
        )
        .map((item) => item.name)
    );
  });

  const filteredSuggestions = $derived.by(() => {
    if (!getIsEditing()) return [];
    if (isEditingObjectArguments) return [];

    const query = getObjectAutocompleteQuery(getExpr());
    const compatibleNames = compatibleSuggestionNames;

    const options = compatibleNames
      ? { filter: (item: { name: string }) => compatibleNames.has(item.name) }
      : undefined;

    if (!query) {
      return getSearchIndex().getDefaultObjectSuggestions(options);
    }

    return getSearchIndex().searchObjectSuggestions(query, options);
  });

  // Find matching disabled objects when autocomplete has no results
  // Requires at least 3 characters to avoid noisy suggestions
  const suggestedDisabledObject = $derived.by(() => {
    if (!getIsEditing()) return null;
    if (isEditingObjectArguments) return null;

    const query = getObjectAutocompleteQuery(getExpr());
    if (!query) return null;

    // Allow short signal operators like +~, *~, etc. but require 3 chars for general queries
    if (query.length < 3 && !query.endsWith('~')) return null;
    if (filteredSuggestions.length > 0) return null;

    const suggestion = searchDisabledObject(query);

    if (suggestion && insertionEdge) {
      const targetNode = nodesHelper.current.find((node) => node.id === insertionEdge.target);

      const compatible = canInsertSuggestionIntoEdge({
        item: { name: suggestion.name, type: 'object', priority: 'normal' },
        index: getSearchIndex(),
        edge: insertionEdge,
        targetNode
      });

      if (!compatible) {
        return null;
      }
    }

    return suggestion;
  });

  const isEditingObjectArguments = $derived.by(() => {
    const objectNames = getSearchIndex()
      .allSearchableItems.filter((item) => item.type === 'object')
      .map((item) => item.name);

    return shouldSuppressObjectAutocomplete(getExpr(), objectNames);
  });

  const shouldConfirmExplicitExpression = () => {
    if (!compatibleSuggestionNames) return false;

    const expression = getExpr().trim().toLowerCase();
    const name = expression.split(' ')[0];
    const items = getSearchIndex().allSearchableItems;

    const explicitItem =
      items.find((item) => item.name.toLowerCase() === expression) ??
      items.find((item) => item.name.toLowerCase() === name);

    return !!explicitItem && !compatibleSuggestionNames.has(explicitItem.name);
  };

  const prepareConfirmation = () => {
    const expression = getExpr();
    const name = expression.trim().toLowerCase();
    const pipeName = insertionEdge ? getEdgeInsertionObjectName(name) : name;
    const resolvedExpression = pipeName === name ? expression : pipeName;

    edgesHelper.update((edges) => retireEdgeInsertionPreview(edges, getNodeId()));

    return resolvedExpression;
  };

  return {
    get filteredSuggestions() {
      return filteredSuggestions;
    },
    get suggestedDisabledObject() {
      return suggestedDisabledObject;
    },
    shouldConfirmExplicitExpression,
    prepareConfirmation
  };
}
