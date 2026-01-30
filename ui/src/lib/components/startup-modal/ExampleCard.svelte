<script lang="ts">
  import type { ExamplePatch } from './types';

  let { patch, onLoad }: { patch: ExamplePatch; onLoad: (id: string) => void } = $props();
</script>

<button
  onclick={() => onLoad(patch.id)}
  class="group relative cursor-pointer overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800/50 text-left transition-all hover:border-orange-500 hover:bg-zinc-800"
>
  <div class="p-3">
    <h3 class="font-medium text-zinc-100 group-hover:text-orange-500">
      {patch.name}
    </h3>
    {#if patch.description}
      <p class="mt-1 text-xs text-zinc-400">
        {patch.description}
      </p>
    {/if}
    {#if patch.author}
      <p class="mt-2 text-xs text-zinc-500">
        by {patch.author}
      </p>
    {/if}
  </div>
</button>
