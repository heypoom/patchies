<script lang="ts">
  import { Search, X } from '@lucide/svelte';

  interface Props {
    value: string;
    placeholder?: string;
    class?: string;
  }

  let { value = $bindable(), placeholder = 'Search...', class: className = '' }: Props = $props();
</script>

<div class="border-b border-zinc-800 p-2 {className}">
  <div class="relative">
    <Search class="absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2 text-zinc-500" />
    <input
      type="text"
      bind:value
      {placeholder}
      class="w-full rounded border border-zinc-700 bg-zinc-900 py-1.5 pr-6 pl-7 text-[11px] text-zinc-200 placeholder-zinc-500 outline-none focus:border-zinc-600"
    />
    {#if value}
      <button
        onclick={() => (value = '')}
        class="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-zinc-500 hover:text-zinc-300"
      >
        <X class="h-3 w-3" />
      </button>
    {/if}
  </div>
</div>
