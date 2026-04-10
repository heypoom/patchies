<script lang="ts">
  import { Cable, CirclePlus, PanelLeftOpen, Play } from '@lucide/svelte/icons';

  let { isMac }: { isMac: boolean } = $props();

  const mod = $derived(isMac ? 'Cmd' : 'Ctrl');
  let expanded = $state(false);
</script>

<div class="rounded-lg border border-white/[0.06] bg-white/[0.015] px-4 py-3.5">
  <div class="grid grid-cols-2 gap-x-6 gap-y-2.5 max-[460px]:grid-cols-1 max-[460px]:gap-y-2">
    <div class="flex min-w-0 items-center justify-between gap-2">
      <span class="shrink-0 font-[Syne] text-xs text-zinc-500">Add object</span>
      <kbd class="tip-key">Enter</kbd>
    </div>

    <div class="flex min-w-0 items-center justify-between gap-2">
      <span class="shrink-0 font-[Syne] text-xs text-zinc-500">Browse objects</span>
      <span class="inline-flex shrink-0 items-center gap-1">
        <CirclePlus class="tip-icon" />
        <span class="font-mono text-[10px] text-zinc-900">/</span>
        <kbd class="tip-key">{mod} + O</kbd>
      </span>
    </div>

    <div class="flex min-w-0 items-center justify-between gap-2">
      <span class="shrink-0 font-[Syne] text-xs text-zinc-500">Open sidebar</span>
      <span class="inline-flex shrink-0 items-center gap-1">
        <PanelLeftOpen class="tip-icon" />
        <span class="font-mono text-[10px] text-zinc-900">/</span>
        <kbd class="tip-key">{mod} + B</kbd>
      </span>
    </div>

    <div
      class="collapsible flex min-w-0 items-center justify-between gap-2"
      class:collapsed={!expanded}
    >
      <span class="shrink-0 font-[Syne] text-xs text-zinc-500">Command palette</span>
      <kbd class="tip-key">{mod} + K</kbd>
    </div>

    <div
      class="collapsible flex min-w-0 items-center justify-between gap-2"
      class:collapsed={!expanded}
    >
      <span class="shrink-0 font-[Syne] text-xs text-zinc-500">Run code</span>
      <span class="inline-flex shrink-0 items-center gap-1">
        <Play class="tip-icon" />
        <span class="font-mono text-[10px] text-zinc-900">/</span>
        <kbd class="tip-key">Shift + Enter</kbd>
      </span>
    </div>

    <div
      class="collapsible flex min-w-0 items-center justify-between gap-2"
      class:collapsed={!expanded}
    >
      <span class="shrink-0 font-[Syne] text-xs text-zinc-500">Connect</span>
      <span class="inline-flex shrink-0 items-center gap-1">
        <span class="font-mono text-[10px] tracking-[0.03em] text-zinc-600">drag handle</span>
        <span class="font-mono text-[10px] text-zinc-900">/</span>
        <Cable class="tip-icon" />
      </span>
    </div>
  </div>

  <button
    class="mt-2.5 w-full cursor-pointer bg-transparent font-mono text-[10px] tracking-[0.1em] text-zinc-600 min-[461px]:hidden"
    onclick={() => (expanded = !expanded)}
  >
    {expanded ? '↑ less' : '+ more shortcuts'}
  </button>
</div>

<style>
  :global(.tip-icon) {
    width: 12px;
    height: 12px;
    color: #3f3f46;
    flex-shrink: 0;
  }

  .tip-key {
    display: inline-flex;
    align-items: center;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.03em;
    color: #71717a;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    padding: 2px 7px;
    white-space: nowrap;
  }

  @media (max-width: 460px) {
    .collapsible.collapsed {
      display: none;
    }
  }
</style>
