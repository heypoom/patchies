<script lang="ts">
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import { match } from 'ts-pattern';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { CircleQuestionMark } from '@lucide/svelte/icons';
  import { isSidebarOpen, sidebarView, selectedNodeInfo } from '../../../stores/ui.store';
  import {
    normalizeMessageType,
    getTypedOutput,
    type MessageType
  } from '$lib/messages/message-types';
  import {
    TRIGGER_TYPE_SPECS,
    getTriggerTypeSpec,
    type TriggerTypeKey
  } from '$lib/objects/schemas/trigger';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: {
      types: string[];
      shorthand: boolean;
    };
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  let messageContext: MessageContext;
  let isEditing = $state(false);
  let editValue = $state('');
  let inputElement = $state<HTMLInputElement>();
  let nodeElement = $state<HTMLDivElement>();
  let showAutocomplete = $state(false);
  let selectedSuggestion = $state(0);
  let resultsContainer = $state<HTMLDivElement>();

  // Normalize types to full MessageType names for processing
  const normalizedTypes = $derived.by((): MessageType[] => {
    return data.types
      .map((t) => normalizeMessageType(t))
      .filter((t): t is MessageType => t !== undefined);
  });

  // Display name based on shorthand flag
  const displayName = $derived(data.shorthand ? 't' : 'trigger');

  // Container styling
  const containerClass = $derived(
    selected
      ? 'border-zinc-400 bg-zinc-800/80 shadow-glow-md'
      : 'border-zinc-700 bg-zinc-900/80 hover:shadow-glow-sm'
  );

  // Type specifier metadata imported from centralized schema
  // Note: hoverColor must be full class name for Tailwind to detect at build time
  const getTypeSpec = (type: string) => {
    const spec = getTriggerTypeSpec(type);

    return {
      name: spec.name,
      desc: spec.description,
      color: spec.color,
      hoverColor: spec.hoverColor
    };
  };

  // Generate autocomplete items: all shorthands first, then all full names
  const allTypeItems = [
    // Shorthands first
    ...Object.entries(TRIGGER_TYPE_SPECS).map(([short, spec]) => ({
      value: short,
      label: short,
      desc: spec.description,
      color: spec.color
    })),

    // Full names second
    ...Object.entries(TRIGGER_TYPE_SPECS).map(([, spec]) => ({
      value: spec.name,
      label: spec.name,
      desc: spec.description,
      color: spec.color
    }))
  ];

  // Get current word being typed (last word after space)
  const currentWord = $derived.by(() => {
    const parts = editValue.split(/\s+/);
    return parts[parts.length - 1] || '';
  });

  // Filter suggestions based on current word
  const filteredSuggestions = $derived.by(() => {
    if (!isEditing || !showAutocomplete) return [];

    const word = currentWord.toLowerCase();
    if (!word) return allTypeItems;

    return allTypeItems.filter(
      (item) =>
        item.value.toLowerCase().startsWith(word) || item.label.toLowerCase().startsWith(word)
    );
  });

  // Handle incoming messages - fire outlets right-to-left
  const handleMessage: MessageCallbackFn = (message, meta) => {
    if (meta?.inlet !== undefined && meta.inlet !== 0) return;

    // Fire outputs right-to-left (highest outlet index first)
    for (let i = normalizedTypes.length - 1; i >= 0; i--) {
      const output = getTypedOutput(normalizedTypes[i], message);
      if (output !== undefined) {
        messageContext.send(output, { to: i });
      }
    }
  };

  function enterEditingMode() {
    editValue = data.types.join(' ');
    isEditing = true;
    showAutocomplete = true;
    selectedSuggestion = 0;
    setTimeout(() => inputElement?.focus(), 10);
  }

  function exitEditingMode(save: boolean = true) {
    isEditing = false;
    showAutocomplete = false;

    if (save && editValue.trim()) {
      const newTypes = editValue
        .trim()
        .split(/\s+/)
        .filter((t) => normalizeMessageType(t) !== undefined);

      if (newTypes.length > 0) {
        updateNodeData(nodeId, { types: newTypes });
        setTimeout(() => updateNodeInternals(nodeId), 10);
      }
    }

    setTimeout(() => nodeElement?.focus(), 0);
  }

  function selectSuggestion(suggestion: (typeof allTypeItems)[0]) {
    // Replace the current word with the selected suggestion
    const parts = editValue.split(/\s+/);
    parts[parts.length - 1] = suggestion.value;
    editValue = parts.join(' ');
    showAutocomplete = true;
    selectedSuggestion = 0;
    inputElement?.focus();
  }

  function scrollToSelectedItem() {
    if (!resultsContainer) return;
    const selectedElement = resultsContainer.children[selectedSuggestion] as HTMLElement;
    if (!selectedElement) return;

    const containerRect = resultsContainer.getBoundingClientRect();
    const elementRect = selectedElement.getBoundingClientRect();

    if (elementRect.bottom > containerRect.bottom) {
      selectedElement.scrollIntoView({ block: 'end', behavior: 'smooth' });
    } else if (elementRect.top < containerRect.top) {
      selectedElement.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isEditing) return;

    match(event.key)
      .with('ArrowDown', () => {
        if (!showAutocomplete || filteredSuggestions.length === 0) return;
        event.preventDefault();
        selectedSuggestion = Math.min(selectedSuggestion + 1, filteredSuggestions.length - 1);
        scrollToSelectedItem();
      })
      .with('ArrowUp', () => {
        if (!showAutocomplete || filteredSuggestions.length === 0) return;
        event.preventDefault();
        selectedSuggestion = Math.max(selectedSuggestion - 1, 0);
        scrollToSelectedItem();
      })
      .with('Tab', () => {
        if (showAutocomplete && filteredSuggestions[selectedSuggestion]) {
          event.preventDefault();
          selectSuggestion(filteredSuggestions[selectedSuggestion]);
        }
      })
      .with('Enter', () => {
        event.preventDefault();
        if (showAutocomplete && filteredSuggestions[selectedSuggestion]) {
          selectSuggestion(filteredSuggestions[selectedSuggestion]);
          showAutocomplete = false;
        }
        exitEditingMode(true);
      })
      .with('Escape', () => {
        event.preventDefault();
        exitEditingMode(false);
      });
  }

  function handleInput() {
    showAutocomplete = true;
    selectedSuggestion = 0;
  }

  function handleBlur() {
    if (!isEditing) return;
    setTimeout(() => exitEditingMode(true), 100);
  }

  function handleDoubleClick() {
    if (!isEditing) {
      enterEditingMode();
    }
  }

  function openHelp() {
    isSidebarOpen.set(true);
    sidebarView.set('help');
    selectedNodeInfo.set({ type: 'trigger', id: nodeId });
  }

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);
  });

  onDestroy(() => {
    messageContext.queue.removeCallback(handleMessage);
    messageContext.destroy();
  });

  // Calculate minimum width based on outlet count
  const minWidthStyle = $derived.by(() => {
    const maxPorts = Math.max(1, data.types.length);
    if (maxPorts <= 2) return '';

    const minWidth = maxPorts * 24;
    return `min-width: ${minWidth}px`;
  });
</script>

<div class="relative flex gap-x-3">
  <div class="group relative">
    <div class="flex flex-col gap-2">
      <!-- Help button above node -->
      <div class="absolute -top-7 right-0 flex items-center">
        <button
          class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
          onclick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openHelp();
          }}
          title="Show help"
        >
          <CircleQuestionMark class="h-4 w-4 text-zinc-300" />
        </button>
      </div>

      <div class="relative">
        <!-- Single inlet -->
        <StandardHandle
          port="inlet"
          type="message"
          title="Input - any message triggers outputs"
          total={1}
          index={0}
          class="top-0"
          {nodeId}
        />

        {#if isEditing}
          <!-- Editing mode -->
          <div class={['w-fit rounded-lg border', containerClass]} style={minWidthStyle}>
            <input
              bind:this={inputElement}
              bind:value={editValue}
              onblur={handleBlur}
              onkeydown={handleKeydown}
              oninput={handleInput}
              placeholder="b n"
              class="nodrag bg-transparent px-3 py-2 font-mono text-xs text-zinc-200 placeholder-zinc-500 outline-none"
            />
          </div>

          <!-- Autocomplete dropdown -->
          {#if showAutocomplete && filteredSuggestions.length > 0}
            <div
              bind:this={resultsContainer}
              class="nopan nodrag nowheel absolute top-full left-0 z-50 mt-1 max-h-48 w-fit min-w-40 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-lg"
            >
              {#each filteredSuggestions as suggestion, index}
                <button
                  type="button"
                  class={[
                    'flex w-full cursor-pointer flex-col px-3 py-1.5 text-left',
                    index === selectedSuggestion ? 'bg-zinc-800' : 'hover:bg-zinc-800'
                  ]}
                  onmousedown={(e) => {
                    e.preventDefault();
                    selectSuggestion(suggestion);
                  }}
                  onmouseenter={() => (selectedSuggestion = index)}
                >
                  <span class={['font-mono text-[10px]', suggestion.color]}>
                    {suggestion.label}
                  </span>

                  <span class="text-[8px] text-zinc-500">{suggestion.desc}</span>
                </button>
              {/each}
            </div>
          {/if}
        {:else}
          <!-- Display mode -->
          <div
            bind:this={nodeElement}
            class={['w-fit cursor-pointer rounded-lg border px-3 py-2', containerClass]}
            style={minWidthStyle}
            ondblclick={handleDoubleClick}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && handleDoubleClick()}
          >
            <div class="flex items-center gap-1.5 font-mono text-xs">
              <span class="text-zinc-200">{displayName}</span>

              {#each data.types as type, index (index)}
                {@const spec = getTypeSpec(type)}

                <Tooltip.Root>
                  <Tooltip.Trigger>
                    <span
                      class={[
                        'cursor-pointer text-zinc-400 underline-offset-2 hover:underline',
                        spec.hoverColor
                      ]}
                    >
                      {type}
                    </span>
                  </Tooltip.Trigger>

                  <Tooltip.Content>
                    <p class="font-semibold">{spec.name}</p>
                    <p class="text-xs text-zinc-600">{spec.desc}</p>
                    <p class="mt-1 text-xs text-zinc-800">Outlet {index} (fires right-to-left)</p>
                  </Tooltip.Content>
                </Tooltip.Root>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Dynamic outlets based on types -->
        {#each data.types as type, index (index)}
          {@const spec = getTypeSpec(type)}

          <StandardHandle
            port="outlet"
            type="message"
            id={index}
            title={`${spec.name} output ${index}`}
            total={data.types.length}
            {index}
            class="bottom-0"
            {nodeId}
          />
        {/each}
      </div>
    </div>
  </div>
</div>
