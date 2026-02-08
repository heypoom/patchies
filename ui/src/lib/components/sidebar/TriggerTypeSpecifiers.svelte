<script lang="ts">
  import { TRIGGER_TYPE_SPECS } from '$lib/objects/schemas/trigger';
</script>

<div class="mb-4">
  <h3 class="mb-2 text-xs font-medium tracking-wider text-zinc-500 uppercase">Type Specifiers</h3>

  <p class="mb-2 text-[11px] text-zinc-400">
    Outlets are created based on type specifiers. Use shorthand or full names:
  </p>

  <div class="grid grid-cols-2 gap-1.5">
    {#each Object.entries(TRIGGER_TYPE_SPECS) as [short, spec]}
      <div class="rounded border border-zinc-800 bg-zinc-900/50 px-2 py-1.5">
        <div class="flex items-center gap-1.5">
          <span class={['font-mono text-xs', spec.color]}>{short}</span>
          <span class="text-[10px] text-zinc-500">({spec.name})</span>
        </div>
        <div class="mt-0.5 text-[10px] text-zinc-500">{spec.description}</div>
      </div>
    {/each}
  </div>
</div>
