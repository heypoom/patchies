<script lang="ts">
  import { Check, Minus, X } from '@lucide/svelte/icons';
  import { match } from 'ts-pattern';

  /**
   * Tri-state checkbox that cycles through: auto (undefined) → show (true) → hide (false)
   *
   * Visual states:
   * - Auto (undefined): empty box with dash
   * - Show (true): checkmark
   * - Hide (false): X mark
   */
  let {
    value = undefined,
    onchange,
    class: className = ''
  }: {
    value: boolean | undefined;
    onchange: (value: boolean | undefined) => void;
    class?: string;
  } = $props();

  function cycle() {
    // undefined → true → false → undefined
    const next = match(value)
      .with(undefined, () => true as const)
      .with(true, () => false as const)
      .with(false, () => undefined)
      .exhaustive();
    onchange(next);
  }

  const bgClass = $derived(
    match(value)
      .with(true, () => 'bg-blue-600 border-blue-600')
      .with(false, () => 'bg-zinc-800 border-zinc-600')
      .with(undefined, () => 'bg-zinc-700 border-zinc-600')
      .exhaustive()
  );

  const title = $derived(
    match(value)
      .with(true, () => 'Always show (click for auto-hide)')
      .with(false, () => 'Always hide (click for auto)')
      .with(undefined, () => 'Auto-hide (click for always show)')
      .exhaustive()
  );
</script>

<button
  type="button"
  onclick={cycle}
  class={[
    'flex h-4 w-4 cursor-pointer items-center justify-center rounded border transition-colors',
    bgClass,
    className
  ]}
  {title}
>
  {#if value === true}
    <Check class="h-3 w-3 text-white" />
  {:else if value === false}
    <X class="h-3 w-3 text-zinc-400" />
  {:else}
    <Minus class="h-3 w-3 text-zinc-500" />
  {/if}
</button>
