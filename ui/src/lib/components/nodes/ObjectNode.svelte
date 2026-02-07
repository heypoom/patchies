<script lang="ts">
  import { useEdges, useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import { onDestroy, onMount } from 'svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { nodeNames } from '$lib/nodes/node-types';
  import { getObjectNames, getObjectNameFromExpr } from '$lib/objects/object-definitions';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import { ObjectService } from '$lib/objects/v2/ObjectService';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { flattenedPresets } from '../../../stores/preset-library.store';
  import type { FlattenedPreset } from '$lib/presets/types';
  import Fuse from 'fuse.js';
  import * as Tooltip from '../ui/tooltip';
  import {
    isUnmodifiableType,
    parseObjectParamFromString,
    stringifyParamByType,
    getDecimalPrecision
  } from '$lib/objects/parse-object-param';
  import { validateMessageToObject } from '$lib/objects/validate-object-message';
  import { isScheduledMessage } from '$lib/audio/time-scheduling-types';
  import { getCombinedMetadata } from '$lib/objects/v2/get-metadata';
  import { VISUAL_NODE_DESCRIPTIONS } from '$lib/components/object-browser/get-categorized-objects';
  import { ANALYSIS_KEY } from '$lib/audio/v2/constants/fft';
  import { logger } from '$lib/utils/logger';
  import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
  import { ObjectShorthandRegistry } from '$lib/registry/ObjectShorthandRegistry';
  import { getAudioObjectNames, hasSignalPorts } from '$lib/audio/v2/audio-helpers';
  import {
    isAiFeaturesVisible,
    isObjectBrowserOpen,
    patchObjectTypes
  } from '../../../stores/ui.store';
  import {
    enabledObjects,
    enabledPresets,
    enabledPackIds,
    togglePack
  } from '../../../stores/extensions.store';
  import { Search } from '@lucide/svelte/icons';
  import { sortFuseResultsWithPrefixPriority } from '$lib/utils/sort-fuse-results';
  import { useDisabledObjectSuggestion } from '$lib/composables/useDisabledObjectSuggestion.svelte';
  import { isSidebarOpen, sidebarView } from '../../../stores/ui.store';
  import DisabledObjectSuggestionInline from './DisabledObjectSuggestionInline.svelte';
  import ObjectSuggestionDropdown from './ObjectSuggestionDropdown.svelte';
  import { getIconById } from '$lib/components/icons';

  // Common objects that should appear first in autocomplete
  // Ordered by general usage frequency
  const PRIORITY_OBJECTS = new Set([
    // UI objects - most common entry points
    'button',
    'toggle',
    'slider',
    'textbox',
    'msg',
    'peek',
    'label',

    // Code objects
    'js',
    'expr',
    'map',
    'filter',
    'tap',
    'worker',

    // UI objects
    'keyboard',
    'markdown',

    // Control objects
    'send',
    'recv',
    'delay',
    'metro',
    'counter',

    // Video objects
    'p5',
    'hydra',
    'canvas',
    'glsl',

    // Audio objects
    'dac~',
    'osc~',
    'gain~',
    'adc~'
  ]);

  // Get priority index (lower = higher priority)
  function getObjectPriority(name: string): number {
    if (PRIORITY_OBJECTS.has(name)) {
      // Return index within priority set (convert Set to array for indexOf)
      const priorityArray = Array.from(PRIORITY_OBJECTS);
      return priorityArray.indexOf(name);
    }

    return 1000; // Non-priority objects come last
  }

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: { expr: string; name: string; params: unknown[] };
    selected: boolean;
  } = $props();

  const { updateNodeData, deleteElements, updateNode, getEdges } = useSvelteFlow();

  const edgesHelper = useEdges();
  const updateNodeInternals = useUpdateNodeInternals();

  let inputElement = $state<HTMLInputElement>();
  let nodeElement = $state<HTMLDivElement>();
  let resultsContainer = $state<HTMLDivElement>();
  let expr = $state(data.expr || '');
  let isEditing = $state(!data.expr); // Start in editing mode if no name;
  let showAutocomplete = $state(false);
  let selectedSuggestion = $state(0);
  let originalName = data.expr || ''; // Store original name for escape functionality

  let isAutomated = $state<Record<number, boolean>>({});

  // Track highest precision seen per inlet for stable display width
  let stickyPrecision = $state<Record<number, number>>({});

  // Track object instance version to trigger re-evaluation of outlets
  let objectInstanceVersion = $state(0);

  let audioService = AudioService.getInstance();
  let objectService = ObjectService.getInstance();
  const messageContext = new MessageContext(nodeId);

  // Create a lookup map for presets by name (includes library info for disambiguation)
  const presetLookup = $derived.by(() => {
    const lookup = new Map<string, FlattenedPreset>();

    for (const fp of $flattenedPresets) {
      // Use preset name as key - if duplicate names exist, later ones override
      // This is acceptable since user presets should take precedence
      lookup.set(fp.preset.name, fp);
    }

    return lookup;
  });

  // Combine all searchable items (objects + shorthands + presets) with metadata
  // Objects in the current patch but not enabled are included as low priority
  const allSearchableItems = $derived.by(() => {
    const objectDefNames = getObjectNames();
    const visualNodeList = nodeNames.filter((name) => name !== 'object' && name !== 'asm.value');
    const combinedObjectNames = new Set([...visualNodeList, ...objectDefNames]);

    const items: Array<{
      name: string;
      type: 'object' | 'preset';
      libraryName?: string;
      priority: 'normal' | 'low';
    }> = [];
    const addedNames = new Set<string>();

    // Add regular objects, filtering by AI features and enabled extensions
    // Objects in the current patch are included even if not enabled (as low priority)
    Array.from(combinedObjectNames).forEach((name) => {
      // Filter out AI objects if AI features are disabled
      if (!$isAiFeaturesVisible && name.startsWith('ai.')) {
        return;
      }

      const isEnabled = $enabledObjects.has(name);
      const isInPatch = $patchObjectTypes.has(name);

      // Skip if not enabled AND not in current patch
      if (!isEnabled && !isInPatch) {
        return;
      }

      items.push({
        name,
        type: 'object',
        priority: isEnabled ? 'normal' : 'low'
      });
      addedNames.add(name);
    });

    // Add shorthands (filtered by whether target nodeType is enabled or in patch)
    const shorthandRegistry = ObjectShorthandRegistry.getInstance();
    for (const shorthand of shorthandRegistry.getShorthandsWithMetadata()) {
      // Skip if already added as a regular object
      if (addedNames.has(shorthand.name)) continue;

      const isEnabled = $enabledObjects.has(shorthand.nodeType);
      const isInPatch = $patchObjectTypes.has(shorthand.nodeType);

      // Skip if not enabled AND not in current patch
      if (!isEnabled && !isInPatch) continue;

      items.push({
        name: shorthand.name,
        type: 'object',
        priority: isEnabled ? 'normal' : 'low'
      });
      addedNames.add(shorthand.name);
    }

    // Add presets from all libraries
    // Presets are ONLY visible if their object type is enabled AND (for built-in) the preset pack is enabled
    for (const fp of $flattenedPresets) {
      // Always require the object type to be enabled
      if (!$enabledObjects.has(fp.preset.type)) {
        continue;
      }

      // For built-in presets: also require the preset to be in an enabled preset pack
      if (fp.libraryName === 'Built-in' && !$enabledPresets.has(fp.preset.name)) {
        continue;
      }

      items.push({
        name: fp.preset.name,
        type: 'preset',
        libraryName: fp.libraryName,
        priority: 'normal'
      });
    }

    return items;
  });

  // Create single Fuse instance for all items
  const allItemsFuse = $derived.by(() => {
    return new Fuse(allSearchableItems, {
      keys: ['name'],
      threshold: 0.2,
      includeScore: true,
      minMatchCharLength: 1
    });
  });

  // Composable for searching disabled objects
  const { searchDisabledObject } = useDisabledObjectSuggestion(
    () => $enabledPackIds,
    () => $isAiFeaturesVisible
  );

  // Get object definition for current name (if it exists)
  const objectMeta = $derived.by(() => {
    if (!expr || expr.trim() === '') return null;

    return getCombinedMetadata(getObjectNameFromExpr(expr));
  });

  // Dynamic inlets based on object definition
  const inlets = $derived.by(() => {
    if (!objectMeta) return [];

    return objectMeta.inlets || [];
  });

  // Update sticky precision when params change (for stable display width)
  $effect(() => {
    data.params.forEach((param, index) => {
      const inlet = inlets[index];

      if (
        inlet?.type === 'float' &&
        inlet.maxPrecision !== undefined &&
        typeof param === 'number'
      ) {
        const currentPrecision = getDecimalPrecision(param, inlet.maxPrecision);
        const existing = stickyPrecision[index] ?? 0;

        if (currentPrecision > existing) {
          stickyPrecision[index] = currentPrecision;
        }
      }
    });
  });

  // Dynamic outlets based on object definition
  // Supports objects with dynamic outlet count via instance getOutlets() method
  const outlets = $derived.by((): ObjectOutlet[] => {
    // Depend on objectInstanceVersion to re-evaluate when object is created
    void objectInstanceVersion;

    if (!objectMeta) return [];

    // Check if the object instance has a getOutlets method for dynamic outlets
    const objectInstance = objectService.getObjectById(nodeId);
    if (objectInstance?.getOutlets) {
      return objectInstance.getOutlets();
    }

    return objectMeta.outlets || [];
  });

  const filteredSuggestions = $derived.by(() => {
    if (!isEditing) return [];

    // Don't show autocomplete if there's a space (user is typing parameters)
    if (expr.includes(' ')) return [];

    // Show all items if input is empty, with objects first
    if (!expr.trim()) {
      const objects = allSearchableItems
        .filter((item) => item.type === 'object')
        .map((item) => ({ name: item.name, type: item.type, priority: item.priority }));
      const presets = allSearchableItems
        .filter((item) => item.type === 'preset')
        .map((item) => ({ name: item.name, type: item.type, priority: item.priority }));

      // Sort: normal priority first, then by object priority, then alphabetically
      const sortItems = (
        items: Array<{ name: string; type: 'object' | 'preset'; priority: 'normal' | 'low' }>
      ) =>
        items.sort((a, b) => {
          // Low priority items always come last
          if (a.priority !== b.priority) {
            return a.priority === 'normal' ? -1 : 1;
          }
          const priorityDiff = getObjectPriority(a.name) - getObjectPriority(b.name);
          if (priorityDiff !== 0) return priorityDiff;
          return a.name.localeCompare(b.name);
        });

      return [...sortItems(objects), ...sortItems(presets)];
    }

    // Fuzzy search all items (only the first word/object name)
    const results = allItemsFuse.search(expr);

    // Sort results with custom scoring: prefix matches first, then objects over presets
    const sortedResults = sortFuseResultsWithPrefixPriority(
      results,
      expr,
      (item) => item.name,
      (a, b) => {
        // Low priority items always come last
        if (a.item.priority !== b.item.priority) {
          return a.item.priority === 'normal' ? -1 : 1;
        }

        // Then sort by type (objects first)
        if (a.item.type !== b.item.type) {
          return a.item.type === 'object' ? -1 : 1;
        }

        // For similar Fuse scores (within 0.1), prioritize common objects
        const scoreDiff = (a.score || 0) - (b.score || 0);
        if (Math.abs(scoreDiff) < 0.1 && a.item.type === 'object') {
          const priorityDiff = getObjectPriority(a.item.name) - getObjectPriority(b.item.name);
          if (priorityDiff !== 0) return priorityDiff;
        }

        return 0; // Let default Fuse score sorting handle the rest
      }
    );

    return sortedResults.map((result) => ({
      name: result.item.name,
      type: result.item.type,
      priority: result.item.priority
    }));
  });

  // Find matching disabled objects when autocomplete has no results
  // Requires at least 3 characters to avoid noisy suggestions
  const suggestedDisabledObject = $derived.by(() => {
    if (!isEditing) return null;
    if (!expr.trim()) return null;
    if (expr.trim().length < 3) return null; // Minimum 3 chars to reduce noise
    if (expr.includes(' ')) return null; // User is typing parameters
    if (filteredSuggestions.length > 0) return null;

    return searchDisabledObject(expr);
  });

  function enablePackFromSuggestion(packId: string, objectName: string) {
    togglePack(packId);
    // Set the expression and exit editing mode after pack is enabled
    setTimeout(() => {
      expr = objectName;
      exitEditingMode(true);
    }, 50);
  }

  function openPacksBrowser() {
    $sidebarView = 'packs';
    $isSidebarOpen = true;
    exitEditingMode(false);
  }

  function enterEditingMode() {
    // For objects with dynamic outlets, use the stored expr directly
    // (their params configure structure, not inlet values)
    if (hasDynamicOutlets && data.expr) {
      expr = data.expr;
    } else {
      // Transform current name and parameter into editable expr
      const paramString = data.params
        .map((value, index) => stringifyParamByType(inlets[index], value, index))
        .filter((value, index) => !isUnmodifiableType(inlets[index]?.type))
        .join(' ');

      expr = `${data.name} ${paramString}`.trim();
    }

    isEditing = true;
    originalName = expr;
    showAutocomplete = true;

    // Focus input on next tick
    setTimeout(() => inputElement?.focus(), 10);
  }

  function exitEditingMode(save: boolean = true) {
    isEditing = false;
    showAutocomplete = false;
    stickyPrecision = {};

    if (!save) {
      // Restore original name on escape
      expr = originalName;

      // If the original name was empty, delete the node
      if (!originalName.trim()) {
        deleteElements({ nodes: [{ id: nodeId }] });
        return;
      }
    }

    if (save) {
      if (expr.trim()) {
        handleNameChange();
      } else {
        // If trying to save with empty name, delete the node
        deleteElements({ nodes: [{ id: nodeId }] });
      }
    }

    // Restore focus to the node element after editing
    setTimeout(() => nodeElement?.focus(), 0);
  }

  function updateParamByIndex(index: number, value: unknown) {
    const nextParams = [...data.params];
    nextParams[index] = value;
    updateNodeData(nodeId, { params: nextParams });

    isAutomated = { ...isAutomated, [index]: false };
  }

  const handleObjectMessage: MessageCallbackFn = (message, meta) => {
    if (!objectMeta || !objectMeta.inlets || meta?.inlet === undefined) return;

    const inlet = objectMeta.inlets[meta.inlet];
    if (!inlet) return;

    const isAudioObject = hasSignalPorts(objectMeta);

    // Validate message types against inlet specification
    if (!validateMessageToObject(message, inlet)) {
      // We already do this in `ObjectService.dispatchMessage` for text objects.
      if (isAudioObject) {
        logger.warn(
          `invalid message type for audio object "${data.name}" at inlet "${inlet.name}": expected "${inlet.type}"`,
          { message, spec: inlet }
        );
      }

      return;
    }

    const isScheduled = isScheduledMessage(message);
    const isSetImmediate = isScheduled && message.type === 'set' && message.time === undefined;

    if (!isUnmodifiableType(inlet.type) && !isScheduled) {
      // Do not update parameter if it is a unmodifiable type or a scheduled message.
      updateParamByIndex(meta.inlet, message);
    } else if (isSetImmediate) {
      // Update parameters for a simple `set` message.
      updateParamByIndex(meta.inlet, message.value);
    } else if (isScheduled) {
      // Mark parameter as being automated.
      isAutomated = { ...isAutomated, [meta.inlet]: true };
    }

    // Route audio object messages to audio service
    if (inlet.name && isAudioObject) {
      audioService.send(nodeId, inlet.name, message);
      return;
    }
  };

  function handleNameChange() {
    if (tryCreatePreset()) return;
    if (tryTransformToVisualNode()) return;
    if (tryCreateAudioObject()) return;

    tryCreatePlainObject();
  }

  function getNameAndParams() {
    const parts = expr.trim().split(' ');
    const name = parts[0]?.toLowerCase();
    const rawParams = parts.slice(1);

    return {
      name,
      rawParams,
      params: parseObjectParamFromString(name, rawParams)
    };
  }

  function tryCreatePlainObject() {
    const { name, params, rawParams } = getNameAndParams();

    updateNodeData(nodeId, { expr, name, params });

    if (objectService.isV2ObjectType(name)) {
      objectService.removeObjectById(nodeId);

      objectService.createObject(nodeId, name, messageContext, params, rawParams).then(() => {
        objectInstanceVersion++;
        updateNodeInternals(nodeId);
      });
    }
  }

  function tryCreatePreset(): boolean {
    if (!expr.trim()) return false;

    // Check if the expression exactly matches a preset name
    const flatPreset = presetLookup.get(expr.trim());

    if (!flatPreset) {
      return false; // Not a preset
    }

    // Transform to the preset's node type with its data
    changeNode(flatPreset.preset.type, flatPreset.preset.data as Record<string, unknown>);
    return true;
  }

  function syncAudioService(name: string, params: unknown[]) {
    audioService.removeNodeById(nodeId);
    audioService.createNode(nodeId, name, params);
    audioService.updateEdges(getEdges());
  }

  function tryCreateAudioObject() {
    if (!expr.trim()) return false;

    const { name, params } = getNameAndParams();
    updateNodeData(nodeId, { expr, name, params });

    if (!getAudioObjectNames().includes(name)) return false;

    syncAudioService(name, params);
    objectInstanceVersion++;

    return true;
  }

  const changeNode = (type: string, data: Record<string, unknown>) => {
    const nodeNumber = parseInt(nodeId.replace('object-', ''));
    const nextId = `${type}-${nodeNumber}`;

    updateNode(nodeId, { id: nextId, type, data });

    edgesHelper.update((edges) =>
      edges.map((edge) => {
        if (edge.source === nodeId) return { ...edge, source: nextId };
        if (edge.target === nodeId) return { ...edge, target: nextId };

        return edge;
      })
    );

    updateNodeInternals(nextId);
  };

  function tryTransformToVisualNode() {
    const result = ObjectShorthandRegistry.getInstance().tryTransform(expr);

    if (result) {
      changeNode(result.nodeType, result.data);
      return true;
    }

    return false;
  }

  function handleInput() {
    if (isEditing) {
      // Keep autocomplete visible - template handles showing suggestions or disabled object hint
      showAutocomplete = true;
      selectedSuggestion = 0;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isEditing) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      exitEditingMode(false);
      return;
    }

    if (!showAutocomplete) {
      if (event.key === 'Enter') {
        event.preventDefault();
        exitEditingMode(true);
      }
      return;
    }

    match(event.key)
      .with('ArrowDown', () => {
        event.preventDefault();
        selectedSuggestion = Math.min(selectedSuggestion + 1, filteredSuggestions.length - 1);
        scrollToSelectedItem();
      })
      .with('ArrowUp', () => {
        event.preventDefault();
        selectedSuggestion = Math.max(selectedSuggestion - 1, 0);
        scrollToSelectedItem();
      })
      .with('Enter', () => {
        event.preventDefault();
        if (filteredSuggestions[selectedSuggestion]) {
          expr = filteredSuggestions[selectedSuggestion].name;
          showAutocomplete = false;
        }
        exitEditingMode(true);
      })
      .with('Tab', () => {
        event.preventDefault();

        if (filteredSuggestions[selectedSuggestion]) {
          expr = filteredSuggestions[selectedSuggestion].name;
          showAutocomplete = false;
        }
      })
      .with('Escape', () => {
        event.preventDefault();
        exitEditingMode(false);
      });
  }

  function selectSuggestion(suggestion: {
    name: string;
    type: 'object' | 'preset';
    priority: 'normal' | 'low';
  }) {
    expr = suggestion.name;
    showAutocomplete = false;
    exitEditingMode(true);

    // Try transformation after setting the name
    setTimeout(() => tryTransformToVisualNode(), 0);
  }

  function scrollToSelectedItem() {
    if (!resultsContainer) return;

    const selectedElement = resultsContainer.children[selectedSuggestion] as HTMLElement;
    if (!selectedElement) return;

    const containerRect = resultsContainer.getBoundingClientRect();
    const elementRect = selectedElement.getBoundingClientRect();

    // Check if element is below the visible area
    if (elementRect.bottom > containerRect.bottom) {
      selectedElement.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }
    // Check if element is above the visible area
    else if (elementRect.top < containerRect.top) {
      selectedElement.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }

  function handleBlur() {
    if (!isEditing) return;

    // Delay to allow clicks on suggestions
    setTimeout(() => {
      // If input is empty, delete the node
      if (!expr.trim()) {
        deleteElements({ nodes: [{ id: nodeId }] });
      } else {
        exitEditingMode(true);
      }
    }, 200);
  }

  function handleDoubleClick() {
    if (!isEditing) {
      enterEditingMode();
    }
  }

  const containerClass = $derived(
    selected
      ? 'border-zinc-400 bg-zinc-800/80 shadow-glow-md'
      : 'border-zinc-700 bg-zinc-900/80 hover:shadow-glow-sm'
  );

  onMount(() => {
    if (isEditing) {
      setTimeout(() => {
        inputElement?.focus();
        showAutocomplete = true;
      }, 10);
    }

    if (getAudioObjectNames().includes(data.name)) {
      syncAudioService(data.name, data.params);
      objectInstanceVersion++;
    }

    // Create V2 text object if applicable
    if (objectService.isV2ObjectType(data.name)) {
      // Extract raw params from expr for V2 objects
      const rawParams = (data.expr || '').trim().split(' ').slice(1);
      const parsedParams = parseObjectParamFromString(data.name, rawParams);

      objectService
        .createObject(nodeId, data.name, messageContext, parsedParams, rawParams)
        .then(() => {
          // Trigger re-evaluation of outlets after object is created
          objectInstanceVersion++;
          updateNodeInternals(nodeId);
        });
    }

    messageContext.queue.addCallback(handleObjectMessage);
  });

  onDestroy(() => {
    audioService.removeNodeById(nodeId);
    objectService.removeObjectById(nodeId);
  });

  // Calculate minimum width based on port count (inlets or outlets, whichever is larger)
  const minWidthStyle = $derived.by(() => {
    const maxPorts = Math.max(inlets.length, outlets.length);
    if (maxPorts <= 2) return '';

    // ~20px per port to ensure handles don't overlap
    const minWidth = maxPorts * 20;

    return `min-width: ${minWidth}px`;
  });

  // Check if this object has dynamic outlets (needs to show raw params instead of parsed)
  const hasDynamicOutlets = $derived.by(() => {
    void objectInstanceVersion;
    const objectInstance = objectService.getObjectById(nodeId);
    return !!objectInstance?.getOutlets;
  });

  // Get raw params from expr for display (used for objects with dynamic outlets)
  const rawParamsFromExpr = $derived.by(() => {
    const parts = (data.expr || '').trim().split(' ');
    return parts.slice(1).join(' ');
  });

  const getInletTypeHoverClass = (inletIndex: number) => {
    const type = inlets[inletIndex]?.type;

    if (isAutomated[inletIndex]) {
      return 'hover:text-pink-500 cursor-pointer hover:underline';
    }

    return match(type)
      .with('float', () => 'hover:text-yellow-500 cursor-pointer hover:underline')
      .with('int', () => 'hover:text-yellow-500 cursor-pointer hover:underline')
      .with('string', () => 'hover:text-blue-500 cursor-pointer hover:underline')
      .with('bool', () => 'hover:text-violet-500 cursor-pointer hover:underline')
      .otherwise(() => 'hover:text-zinc-400');
  };

  const getInletHint = (inletIndex: number) => {
    const inlet = inlets[inletIndex];
    if (!inlet) return 'unknown inlet';

    if (inlet.type === 'string' && inlet.options) {
      return `${inlet.name} (${inlet.options.join(', ')})`;
    }

    return `${inlet.name} (${inlet.type})`;
  };

  const getShortInletName = (inletIndex: number) => inlets[inletIndex]?.name?.slice(0, 4) || 'auto';

  const getPortType = (port: ObjectInlet | ObjectOutlet) =>
    match(port.type)
      .with('signal', () => 'audio' as const)
      .with(ANALYSIS_KEY, () => ANALYSIS_KEY)
      .otherwise(() => 'message' as const);

  const selectedDescription = $derived.by(() => {
    const current = filteredSuggestions[selectedSuggestion];
    if (!current) return null;

    if (current.type === 'preset') {
      const flatPreset = presetLookup.get(current.name);
      if (!flatPreset) return null;

      const { preset, libraryName } = flatPreset;
      const desc = preset.description || `using ${preset.type}`;

      return `${libraryName} > ${current.name}: ${desc}`;
    }

    if (current.type === 'object') {
      const metadata = getCombinedMetadata(current.name);

      if (metadata) {
        return metadata.description ?? null;
      }

      // Fall back to visual node descriptions
      const visualDescription = VISUAL_NODE_DESCRIPTIONS[current.name];
      if (visualDescription) {
        return visualDescription;
      }
    }

    return null;
  });

  // Get dynamic icon for audio nodes that support it (e.g., oscillator waveform icons)
  const dynamicIconComponent = $derived.by(() => {
    // Re-evaluate when params change or when audio node is created
    void data.params;
    void objectInstanceVersion;

    const audioNode = audioService.getNodeById(nodeId);
    if (!audioNode?.getIcon) return null;

    const iconId = audioNode.getIcon();
    if (!iconId) return null;

    return getIconById(iconId);
  });

  // Get the param index that the icon represents (to hide it from display)
  const iconParamIndex = $derived.by(() => {
    void data.params;
    void objectInstanceVersion;

    const audioNode = audioService.getNodeById(nodeId);
    return audioNode?.getIconParamIndex?.() ?? null;
  });
</script>

<div class="relative">
  <div class="group relative">
    <div class="flex flex-col gap-2">
      <div class="relative">
        <!-- Dynamic inlets -->
        {#if inlets}
          {#each inlets as inlet, index}
            <StandardHandle
              port="inlet"
              type={getPortType(inlet)}
              id={index}
              title={inlet.name || `Inlet ${index}`}
              total={inlets.length}
              {index}
              class="top-0"
              {nodeId}
              isAudioParam={inlet.isAudioParam}
            />
          {/each}
        {:else}
          <!-- Fallback generic inlet for objects without definitions -->
          <StandardHandle port="inlet" type="message" total={1} index={0} {nodeId} />
        {/if}

        <div class="relative">
          {#if isEditing}
            <!-- Editing state: show input field -->
            <div class={['w-fit rounded-lg border', containerClass]} style={minWidthStyle}>
              <input
                bind:this={inputElement}
                bind:value={expr}
                oninput={handleInput}
                onblur={handleBlur}
                onkeydown={handleKeydown}
                placeholder="<name>"
                class="nodrag bg-transparent px-3 py-2 font-mono text-xs text-zinc-200 placeholder-zinc-500 outline-none"
              />
            </div>

            <!-- Autocomplete dropdown -->
            {#if showAutocomplete && (filteredSuggestions.length > 0 || suggestedDisabledObject)}
              <div class="nopan nodrag nowheel absolute top-full left-0 z-50 flex flex-col">
                {#if filteredSuggestions.length > 0}
                  <ObjectSuggestionDropdown
                    suggestions={filteredSuggestions}
                    bind:selectedIndex={selectedSuggestion}
                    {presetLookup}
                    description={selectedDescription}
                    onSelect={selectSuggestion}
                    bind:resultsContainerRef={resultsContainer}
                  />
                {:else if suggestedDisabledObject}
                  <DisabledObjectSuggestionInline
                    name={suggestedDisabledObject.name}
                    packName={suggestedDisabledObject.packName}
                    packIcon={suggestedDisabledObject.packIcon}
                    onBrowsePacks={openPacksBrowser}
                    onEnableAndAdd={() => {
                      enablePackFromSuggestion(
                        suggestedDisabledObject.packId,
                        suggestedDisabledObject.name
                      );
                    }}
                  />
                {/if}

                <!-- Browse objects link -->
                <button
                  type="button"
                  class="mt-1.5 flex w-fit cursor-pointer items-center gap-1 text-left font-mono text-[8px] text-zinc-500 underline-offset-2 hover:text-blue-300 hover:underline"
                  onclick={() => ($isObjectBrowserOpen = true)}
                  title="Discover objects by categories (Ctrl+O)"
                >
                  <Search class="h-2.5 w-2.5" />
                  Browse objects
                </button>
              </div>
            {/if}
          {:else}
            <!-- Locked state: show read-only text -->
            <div
              bind:this={nodeElement}
              class={['w-full cursor-pointer rounded-lg border px-3 py-2', containerClass]}
              style={minWidthStyle}
              ondblclick={handleDoubleClick}
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === 'Enter' && handleDoubleClick()}
            >
              <div class="flex items-center gap-1.5 font-mono text-xs">
                <span class={[!getCombinedMetadata(data.name) ? 'text-red-300' : 'text-zinc-200']}
                  >{data.name}</span
                >

                {#if hasDynamicOutlets && rawParamsFromExpr}
                  <!-- For objects with dynamic outlets, show the raw params from expr -->
                  <span class="text-zinc-400">{rawParamsFromExpr}</span>
                {:else}
                  {#each data.params as param, index}
                    {#if index === iconParamIndex && dynamicIconComponent}
                      <!-- Render icon in place of the param text -->
                      {@const IconComponent = dynamicIconComponent}
                      <Tooltip.Root>
                        <Tooltip.Trigger class="flex">
                          <div
                            class={[
                              'inline-flex cursor-pointer justify-end text-zinc-400 underline-offset-2',
                              getInletTypeHoverClass(index)
                            ]}
                          >
                            <IconComponent class="h-3.5 w-3.5" />
                          </div>
                        </Tooltip.Trigger>
                        <Tooltip.Content>
                          <p>{getInletHint(index)}</p>
                          {#if inlets[index]?.description}
                            <p class="text-xs text-zinc-500">{inlets[index].description}</p>
                          {/if}
                        </Tooltip.Content>
                      </Tooltip.Root>
                    {:else if !isUnmodifiableType(inlets[index]?.type)}
                      <Tooltip.Root>
                        <Tooltip.Trigger>
                          <span
                            class={[
                              'text-zinc-400 underline-offset-2',
                              getInletTypeHoverClass(index)
                            ]}
                          >
                            {#if isAutomated[index]}
                              {getShortInletName(index)}
                            {:else}
                              {stringifyParamByType(inlets[index], param, index, {
                                stickyPrecision: stickyPrecision[index]
                              })}
                            {/if}
                          </span>
                        </Tooltip.Trigger>

                        <Tooltip.Content>
                          <p>{getInletHint(index)}</p>

                          {#if inlets[index]?.description}
                            <p class="text-xs text-zinc-500">{inlets[index].description}</p>
                          {/if}

                          {#if isAutomated[index]}
                            <p class="text-xs text-pink-500">inlet is automated</p>
                          {/if}
                        </Tooltip.Content>
                      </Tooltip.Root>
                    {/if}
                  {/each}
                {/if}
              </div>
            </div>
          {/if}
        </div>

        <!-- Dynamic outlets -->
        {#if outlets}
          {#each outlets as outlet, index}
            <StandardHandle
              port="outlet"
              type={getPortType(outlet)}
              id={index}
              title={outlet.name || `Outlet ${index}`}
              total={outlets.length}
              {index}
              class="bottom-0"
              {nodeId}
            />
          {/each}
        {/if}
      </div>
    </div>
  </div>
</div>
