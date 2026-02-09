<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    nodeLabel,
    channel,
    selected = false,
    borderColorClass = '',
    labelColorClass = 'text-zinc-200',
    channelColorClass = 'text-zinc-400',
    onChannelChange,
    inlets,
    outlets
  }: {
    nodeLabel: string;
    channel: string;
    selected?: boolean;
    borderColorClass?: string;
    labelColorClass?: string;
    channelColorClass?: string;
    onChannelChange: (newChannel: string) => void;
    inlets?: Snippet;
    outlets?: Snippet;
  } = $props();

  let isEditing = $state(false);
  let inputElement = $state<HTMLInputElement>();
  let nodeElement = $state<HTMLDivElement>();
  let editValue = $state('');

  function enterEditingMode() {
    editValue = channel;
    isEditing = true;
    setTimeout(() => inputElement?.focus(), 10);
  }

  function exitEditingMode(save: boolean = true) {
    isEditing = false;

    if (save && editValue.trim()) {
      onChannelChange(editValue.trim());
    }

    setTimeout(() => nodeElement?.focus(), 0);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      exitEditingMode(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      exitEditingMode(false);
    }
  }

  function handleBlur() {
    setTimeout(() => exitEditingMode(true), 100);
  }

  const containerClass = $derived.by(() => {
    const base = 'rounded-lg border bg-zinc-900/80';
    const glow = selected ? 'shadow-glow-md' : 'hover:shadow-glow-sm';
    const border = borderColorClass || (selected ? 'border-zinc-400' : 'border-zinc-700');

    return [base, glow, border].join(' ');
  });
</script>

<div class="relative">
  <div class="group relative">
    <div class="flex flex-col gap-2">
      <div class="relative">
        {@render inlets?.()}

        <div class="relative">
          {#if isEditing}
            <div class={['w-fit', containerClass]}>
              <input
                bind:this={inputElement}
                bind:value={editValue}
                onblur={handleBlur}
                onkeydown={handleKeydown}
                placeholder="channel"
                class="nodrag bg-transparent px-3 py-2 font-mono text-xs text-zinc-200 placeholder-zinc-500 outline-none"
              />
            </div>
          {:else}
            <div
              bind:this={nodeElement}
              class={['w-full cursor-pointer px-3 py-2', containerClass]}
              ondblclick={enterEditingMode}
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === 'Enter' && enterEditingMode()}
            >
              <div class="flex items-center gap-1.5 font-mono text-xs">
                <span class={labelColorClass}>{nodeLabel}</span>
                <span class={channelColorClass}>{channel}</span>
              </div>
            </div>
          {/if}
        </div>

        {@render outlets?.()}
      </div>
    </div>
  </div>
</div>
