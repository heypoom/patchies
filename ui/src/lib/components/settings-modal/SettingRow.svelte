<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    description = '',
    children
  }: {
    title: string;
    description?: string;
    children: Snippet;
  } = $props();
</script>

<div class="flex items-center justify-between gap-4 border-b border-white/5 py-3 last:border-b-0">
  <div class="min-w-0 flex-1">
    <div class="text-sm text-zinc-200">{title}</div>

    {#if description}
      <div class="mt-0.5 text-xs text-zinc-500">{description}</div>
    {/if}
  </div>
  <div class="shrink-0">
    {@render children()}
  </div>
</div>
