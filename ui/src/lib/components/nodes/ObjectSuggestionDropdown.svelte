<script lang="ts">
  import type { FlattenedPreset } from '$lib/presets/types';

  export type Suggestion = {
    name: string;
    type: 'object' | 'preset';
    priority: 'normal' | 'low';
  };

  let {
    suggestions,
    selectedIndex = $bindable(0),
    presetLookup,
    description,
    onSelect,
    resultsContainerRef = $bindable<HTMLDivElement | undefined>(undefined)
  }: {
    suggestions: Suggestion[];
    selectedIndex: number;
    presetLookup: Map<string, FlattenedPreset>;
    description: string | null;
    onSelect: (suggestion: Suggestion) => void;
    resultsContainerRef?: HTMLDivElement | undefined;
  } = $props();
</script>

<div class="flex">
  <div class="mt-1 w-full min-w-48 rounded-md border border-zinc-800 bg-zinc-900 shadow-xl">
    <!-- Results List -->
    <div bind:this={resultsContainerRef} class="max-h-60 overflow-y-auto rounded-t-md">
      {#each suggestions as suggestion, index}
        <button
          type="button"
          onclick={() => onSelect(suggestion)}
          onmouseenter={() => (selectedIndex = index)}
          class={[
            'w-full cursor-pointer border-l-2 px-3 py-2 text-left font-mono text-xs transition-colors',
            index === selectedIndex
              ? 'border-zinc-400 bg-zinc-700/40 text-zinc-100'
              : 'border-transparent text-zinc-300 hover:bg-zinc-800/80',
            suggestion.priority === 'low' && 'opacity-50'
          ]}
        >
          <span class="font-mono">{suggestion.name}</span>

          {#if suggestion.type === 'preset'}
            {@const preset = presetLookup.get(suggestion.name)}

            {#if preset}
              <span class="text-[10px] text-zinc-500">{preset.preset.type}</span>
            {/if}
          {/if}

          {#if suggestion.priority === 'low'}
            <span class="text-[10px] text-zinc-600">(disabled)</span>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Footer with keyboard hints -->
    <div class="rounded-b-md border-zinc-700 px-2 py-1 text-[8px] text-zinc-600">
      <span>↑↓ navigate • Enter select • Esc cancel</span>
    </div>
  </div>

  <div class="mt-2 ml-3 min-w-48 font-mono">
    <div class="text-xs">
      {description}
    </div>
  </div>
</div>
