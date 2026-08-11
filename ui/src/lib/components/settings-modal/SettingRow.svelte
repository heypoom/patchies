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

<div
  class="setting-row flex items-center justify-between gap-5 border-b border-white/6 px-4 py-4 last:border-b-0 max-[520px]:items-start max-[520px]:gap-4"
>
  <div class="min-w-0 flex-1">
    <div class="text-[13px] leading-5 font-medium text-zinc-100">{title}</div>

    {#if description}
      <div class="mt-0.5 max-w-[34rem] text-[11px] leading-[1.45] text-zinc-500">
        {description}
      </div>
    {/if}
  </div>
  <div class="min-w-0 shrink-0 pt-0.5">
    {@render children()}
  </div>
</div>
