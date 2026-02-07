<script lang="ts">
  import { X } from '@lucide/svelte/icons';

  let { onClose }: { onClose: () => void } = $props();

  // Type specifier metadata for help panel
  const TYPE_SPECS = {
    b: { color: 'text-orange-400' },
    a: { color: 'text-green-400' },
    s: { color: 'text-blue-400' },
    n: { color: 'text-yellow-400' },
    i: { color: 'text-amber-400' },
    l: { color: 'text-purple-400' }
  } as const;

  const HELP_TYPES = [
    { key: 'b', label: 'b', desc: 'bang (always fires)' },
    { key: 'a', label: 'a', desc: 'any (pass through)' },
    { key: 's', label: 's', desc: 'symbol/string' },
    { key: 'n', label: 'n/f', desc: 'number/float' },
    { key: 'i', label: 'i', desc: 'integer' },
    { key: 'l', label: 'l', desc: 'list/array' }
  ] as const;
</script>

<div class="absolute -top-7 right-0">
  <button onclick={onClose} class="rounded p-1 hover:bg-zinc-700">
    <X class="h-4 w-4 text-zinc-300" />
  </button>
</div>

<div
  class="w-64 rounded-lg border border-zinc-600 bg-zinc-900 p-3 text-xs font-light text-zinc-300 shadow-xl"
>
  <h3 class="mb-2 font-semibold text-zinc-100">Trigger object</h3>

  <p class="mb-3 text-zinc-400">
    Sends messages through multiple outlets in <strong class="text-zinc-200">right-to-left</strong>
    order.
  </p>

  <div class="mb-3">
    <h4 class="mb-1 font-medium text-zinc-200">Why right-to-left?</h4>
    <p class="text-zinc-400">
      We need to set up values <em>before</em> triggering an action. Right-to-left firing ensures downstream
      nodes receive data in the correct order.
    </p>
  </div>

  <div class="mb-3">
    <h4 class="mb-1 font-medium text-zinc-200">Type specifiers</h4>
    <ul class="space-y-1 text-zinc-400">
      {#each HELP_TYPES as { key, label, desc }}
        <li><code class={TYPE_SPECS[key].color}>{label}</code> - {desc}</li>
      {/each}
    </ul>
  </div>

  <div class="rounded bg-zinc-800 p-2">
    <p class="text-zinc-400">
      <code class="text-zinc-200">t b a</code>: on <i>42</i>, it sends <i>42</i> from outlet 1, then
      <i>bang</i> from outlet 0.
    </p>
  </div>
</div>
