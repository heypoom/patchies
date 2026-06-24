<script lang="ts">
  import { Activity } from '@lucide/svelte/icons';
  import * as Tooltip from './ui/tooltip';
  import type { RenderCookStatus } from '$lib/rendering/types';

  let {
    enabled = false,
    visible = false,
    cookStatus = undefined
  }: {
    enabled?: boolean;
    visible?: boolean;
    cookStatus?: RenderCookStatus;
  } = $props();

  let showCookDebug = $state(visible);

  $effect(() => {
    showCookDebug = visible;
  });

  const HIDDEN_COOK_REASONS = new Set(['first-frame', 'renderer-policy']);

  const cookStatusLabel = $derived(cookStatus?.status ?? 'cached');
  let lastVisibleCookReasons = $state<string[]>([]);

  $effect(() => {
    const visibleReasons = (cookStatus?.lastCookReasons ?? []).filter(
      (reason) => !HIDDEN_COOK_REASONS.has(reason)
    );

    if (visibleReasons.length > 0) {
      lastVisibleCookReasons = visibleReasons;
    } else if (cookStatus?.status !== 'cooked') {
      lastVisibleCookReasons = [];
    }
  });

  const cookReasons = $derived.by(() => {
    return lastVisibleCookReasons.join(', ') || 'none';
  });
  const cookTime = $derived(
    cookStatus?.lastCookTimeMs == null ? '--' : `${cookStatus.lastCookTimeMs.toFixed(2)}ms`
  );
  const cookStatusClass = $derived.by(() => {
    if (cookStatusLabel === 'cooked') return 'text-emerald-300';
    if (cookStatusLabel === 'paused') return 'text-amber-300';

    return 'text-zinc-300';
  });
</script>

{#if enabled}
  <div class="absolute right-1 bottom-1 flex items-end gap-1">
    {#if showCookDebug}
      <div
        class="rounded border border-zinc-700/80 bg-zinc-950/90 px-2 py-1 font-mono text-[10px] leading-tight text-zinc-400 shadow"
      >
        <div class="flex gap-2">
          <span class={cookStatusClass}>{cookStatusLabel}</span>
          <span>{cookTime}</span>
        </div>
        <div class="max-w-48 truncate">reason: {cookReasons}</div>
        <div>{cookStatus?.cookedFrames ?? 0} cooks</div>
      </div>
    {/if}

    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          class={[
            'cursor-pointer rounded border border-zinc-700/80 bg-zinc-950/80 p-1 shadow hover:bg-zinc-800',
            showCookDebug ? 'text-emerald-300' : 'text-zinc-300'
          ]}
          aria-label={showCookDebug ? 'Hide cook debug' : 'Show cook debug'}
          onclick={() => (showCookDebug = !showCookDebug)}
        >
          <Activity class="h-3.5 w-3.5" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>{showCookDebug ? 'Hide cook debug' : 'Show cook debug'}</Tooltip.Content>
    </Tooltip.Root>
  </div>
{/if}
