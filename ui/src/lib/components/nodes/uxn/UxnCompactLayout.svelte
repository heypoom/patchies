<script lang="ts">
  import {
    Code,
    EllipsisVertical,
    FolderOpen,
    Monitor,
    Pause,
    Play,
    Terminal
  } from '@lucide/svelte/icons';
  import * as Popover from '../../ui/popover';
  import StandardHandle from '../../StandardHandle.svelte';

  let {
    nodeId,
    selected,
    isPaused,
    hasError = false,
    showConsole,
    showEditor,
    onTogglePause,
    onOpenFileDialog,
    onToggleConsole,
    onToggleEditor,
    onShowScreen
  }: {
    nodeId: string;
    selected: boolean;
    isPaused: boolean;
    hasError?: boolean;
    showConsole: boolean;
    showEditor: boolean;
    onTogglePause: () => void;
    onOpenFileDialog: () => void;
    onToggleConsole: () => void;
    onToggleEditor: () => void;
    onShowScreen: () => void;
  } = $props();

  // Match CodeBlockBase border color logic
  const borderColor = $derived.by(() => {
    // Error state - red border
    if (hasError) {
      return selected ? 'border-red-500' : 'border-red-400';
    }

    // Running (not paused) - emerald border (long-running task style)
    if (!isPaused && selected) return 'border-emerald-300';
    if (!isPaused) return 'border-emerald-500';

    // Paused/stopped state
    if (selected) return 'border-zinc-400';
    return 'border-zinc-600';
  });

  // Match CodeBlockBase width: 70 + max(2, 2) * 15 = 100px for 1 inlet + 1 outlet
  const minContainerWidth = 100;
</script>

<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
  <div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
    <div class="font-mono text-xs font-medium text-zinc-400">uxn</div>
  </div>

  <Popover.Root>
    <Popover.Trigger>
      <button
        class="cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
        title="Menu"
      >
        <EllipsisVertical class="h-4 w-4 text-zinc-300" />
      </button>
    </Popover.Trigger>

    <Popover.Content class="w-40 p-1" align="end">
      <button
        class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-700"
        onclick={onOpenFileDialog}
      >
        <FolderOpen class="h-4 w-4" />
        Load ROM
      </button>

      <button
        class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-700"
        onclick={onToggleConsole}
      >
        <Terminal class="h-4 w-4" />
        {showConsole ? 'Hide Console' : 'Show Console'}
      </button>

      <button
        class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-700"
        onclick={onToggleEditor}
      >
        <Code class="h-4 w-4" />
        {showEditor ? 'Hide Editor' : 'Edit Code'}
      </button>

      <button
        class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-700"
        onclick={onShowScreen}
        title="ROM will be reloaded"
      >
        <Monitor class="h-4 w-4" />
        Show Screen
      </button>
    </Popover.Content>
  </Popover.Root>
</div>

<div class="relative">
  <StandardHandle
    port="inlet"
    type="message"
    id={0}
    title="ROM input"
    total={1}
    index={0}
    {nodeId}
  />

  <!-- Match CodeBlockBase button styling -->
  <button
    class={[
      'nodrag flex w-full cursor-pointer justify-center rounded-md border py-3 text-zinc-300 hover:bg-zinc-700',
      borderColor,
      selected ? 'shadow-glow-md bg-zinc-800' : 'hover:shadow-glow-sm bg-zinc-900'
    ]}
    style="min-width: {minContainerWidth}px"
    onclick={onTogglePause}
    title={isPaused ? 'Resume' : 'Pause'}
  >
    {#if isPaused}
      <Play size="16px" />
    {:else}
      <Pause size="16px" />
    {/if}
  </button>

  <StandardHandle
    port="outlet"
    type="message"
    id={0}
    title="Console output"
    total={1}
    index={0}
    {nodeId}
  />
</div>
