<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import type AssemblyEditorImpl from './AssemblyEditorImpl.svelte';

  let props: ComponentProps<typeof AssemblyEditorImpl> = $props();
  let implementation = $state(import('./AssemblyEditorImpl.svelte'));
</script>

{#await implementation}
  <p role="status" class="text-xs text-zinc-400">Loading assembly editor…</p>
{:then module}
  <module.default {...props} />
{:catch}
  <p role="alert" class="text-xs text-zinc-400">Could not load assembly editor.</p>
  <button
    type="button"
    class="cursor-pointer text-sm underline"
    onclick={() => (implementation = import('./AssemblyEditorImpl.svelte'))}>Retry</button
  >
{/await}
