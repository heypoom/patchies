<script lang="ts">
  import { X } from '@lucide/svelte/icons';
  import type { Snippet } from 'svelte';

  type SidebarView = 'files';

  let {
    open = $bindable(false),
    view = 'files',
    children
  }: {
    open: boolean;
    view?: SidebarView;
    children?: Snippet;
  } = $props();

  const viewTitles: Record<SidebarView, string> = {
    files: 'Files'
  };
</script>

{#if open}
  <div class="flex h-full w-full shrink-0 flex-col border-r border-zinc-700 bg-zinc-950 sm:w-64">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-zinc-700 px-3 py-2">
      <h2 class="font-mono text-xs font-medium tracking-wide text-zinc-400 uppercase">
        {viewTitles[view]}
      </h2>

      <button
        class="rounded p-0.5 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
        onclick={() => (open = false)}
        title="Close sidebar"
      >
        <X class="h-4 w-4" />
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto">
      {#if children}
        {@render children()}
      {/if}
    </div>
  </div>
{/if}
